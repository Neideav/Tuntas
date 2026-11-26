<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\ProjectInvitation;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\User;
use App\Services\PermissionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProjectMemberController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * List members and current user's effective permissions for the project.
     */
    public function index(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasProjectPermission($user, $project, 'members.view') &&
            !$this->permissionService->userHasProjectPermission($user, $project, 'project.view')) {
            abort(403, 'Unauthorized to view project members.');
        }

        // Ensure project owner is in project_members
        $this->ensureOwnerMember($project);

        $members = ProjectMember::with(['user:id,name,email', 'projectRole'])
            ->where('project_id', $project->id)
            ->get()
            ->map(function ($member) use ($project) {
                $isOwner = $member->user_id === $project->user_id;
                $roleName = $member->projectRole?->name ?? ucfirst($member->role);
                $roleColor = $member->projectRole?->color ?? '#6366F1';
                $roleSlug = $member->projectRole?->slug ?? $member->role;

                return [
                    'id' => $member->id,
                    'user_id' => $member->user_id,
                    'name' => $member->user->name ?? 'Unknown User',
                    'email' => $member->user->email ?? '',
                    'role_id' => $member->role_id,
                    'role' => $roleSlug,
                    'role_name' => $roleName,
                    'role_color' => $roleColor,
                    'is_owner' => $isOwner,
                    'is_builtin' => $member->projectRole?->is_builtin ?? true,
                    'joined_at' => $member->joined_at ? $member->joined_at->toIso8601String() : $member->created_at->toIso8601String(),
                ];
            });

        $effectivePermissions = $this->permissionService->getUserEffectivePermissions($user, $project);
        $userRole = $this->permissionService->getUserProjectRole($user, $project);

        return response()->json([
            'success' => true,
            'data' => [
                'members' => $members,
                'current_user' => [
                    'is_owner' => $project->user_id === $user->id,
                    'role' => $userRole?->slug ?? ($project->user_id === $user->id ? 'owner' : 'viewer'),
                    'permissions' => $effectivePermissions,
                ],
            ],
        ]);
    }

    /**
     * Invite a new member by email and role.
     */
    public function invite(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$this->permissionService->canManageMember($user, $project, null, 'invite')) {
            abort(403, 'Unauthorized to invite project members.');
        }

        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'role_id' => [
                'nullable',
                Rule::exists('project_roles', 'id')->where('project_id', $project->id),
            ],
            'role' => 'nullable|string',
        ]);

        $email = strtolower(trim($validated['email']));

        // Check if user is already an active member
        $existingUser = User::where('email', $email)->first();
        if ($existingUser) {
            $isAlreadyMember = ProjectMember::where('project_id', $project->id)
                ->where('user_id', $existingUser->id)
                ->exists();

            if ($isAlreadyMember || $project->user_id === $existingUser->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pengguna dengan email ini sudah menjadi anggota proyek.',
                ], 422);
            }
        }

        // Resolve role
        $roleId = $validated['role_id'] ?? null;
        $roleSlug = $validated['role'] ?? 'member';

        if ($roleId) {
            $roleObj = ProjectRole::where('id', $roleId)->where('project_id', $project->id)->first();
            if ($roleObj) {
                $roleSlug = $roleObj->slug;
            }
        } else {
            $roleObj = ProjectRole::where('project_id', $project->id)->where('slug', $roleSlug)->first();
            if ($roleObj) {
                $roleId = $roleObj->id;
            }
        }

        // Privilege escalation check: Non-owners cannot invite someone as Owner
        if ($roleSlug === ProjectRole::ROLE_OWNER && $project->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pemilik proyek yang dapat menugaskan peran Pemilik.',
            ], 403);
        }

        // Check for existing pending invitation for same email
        $invitation = ProjectInvitation::where('project_id', $project->id)
            ->where('email', $email)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->first();

        if ($invitation) {
            // Refresh token & expiration instead of duplicating
            $invitation->role_id = $roleId;
            $invitation->role = $roleSlug;
            $invitation->expires_at = now()->addDays(7);
            $invitation->save();
        } else {
            $invitation = ProjectInvitation::create([
                'project_id' => $project->id,
                'inviter_id' => $user->id,
                'email' => $email,
                'role_id' => $roleId,
                'role' => $roleSlug,
                'token' => Str::random(48),
                'status' => 'pending',
                'expires_at' => now()->addDays(7),
            ]);
        }

        AuditLog::create([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'action' => 'members.invited',
            'auditable_type' => ProjectInvitation::class,
            'auditable_id' => (string) $invitation->id,
            'payload' => [
                'email' => $email,
                'role' => $roleSlug,
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Undangan berhasil dibuat untuk {$email}.",
            'data' => [
                'invitation' => $invitation->load(['projectRole', 'inviter:id,name,email']),
                'invite_token' => $invitation->token,
            ],
        ], 201);
    }

    /**
     * List pending invitations for the project.
     */
    public function invitations(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasProjectPermission($user, $project, 'members.view') &&
            !$this->permissionService->userHasProjectPermission($user, $project, 'members.invite')) {
            abort(403, 'Unauthorized.');
        }

        $invitations = ProjectInvitation::with(['projectRole', 'inviter:id,name,email'])
            ->where('project_id', $project->id)
            ->where('status', 'pending')
            ->where('expires_at', '>', now())
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $invitations,
        ]);
    }

    /**
     * Cancel / revoke an invitation.
     */
    public function cancelInvitation(Request $request, Project $project, ProjectInvitation $invitation)
    {
        $user = $request->user();

        if (!$this->permissionService->canManageMember($user, $project, null, 'invite')) {
            abort(403, 'Unauthorized to manage invitations.');
        }

        if ($invitation->project_id !== $project->id) {
            abort(404, 'Undangan tidak ditemukan di proyek ini.');
        }

        $invitation->status = 'declined';
        $invitation->save();

        AuditLog::create([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'action' => 'members.invitation_cancelled',
            'auditable_type' => ProjectInvitation::class,
            'auditable_id' => (string) $invitation->id,
            'payload' => ['email' => $invitation->email],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Undangan berhasil dibatalkan.',
        ]);
    }

    /**
     * Accept invitation via token.
     */
    public function acceptInvitation(Request $request, string $token)
    {
        $user = $request->user();

        $invitation = ProjectInvitation::where('token', $token)->first();

        if (!$invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Token undangan tidak valid atau tidak ditemukan.',
            ], 404);
        }

        if ($invitation->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'Undangan ini sudah pernah digunakan atau telah ditolak.',
            ], 422);
        }

        if ($invitation->isExpired()) {
            $invitation->update(['status' => 'expired']);
            return response()->json([
                'success' => false,
                'message' => 'Masa berlaku undangan ini telah kedaluwarsa.',
            ], 422);
        }

        // Attach user to project
        $project = Project::find($invitation->project_id);
        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'Proyek tujuan undangan sudah tidak ada.',
            ], 404);
        }

        $member = DB::transaction(function () use ($project, $user, $invitation) {
            // Check if already a member
            $member = ProjectMember::firstOrCreate(
                [
                    'project_id' => $project->id,
                    'user_id' => $user->id,
                ],
                [
                    'role_id' => $invitation->role_id,
                    'role' => $invitation->role ?? 'member',
                    'joined_at' => now(),
                ]
            );

            $invitation->update([
                'status' => 'accepted',
            ]);

            AuditLog::create([
                'user_id' => $user->id,
                'project_id' => $project->id,
                'action' => 'members.joined',
                'auditable_type' => ProjectMember::class,
                'auditable_id' => (string) $member->id,
                'payload' => [
                    'email' => $user->email,
                    'role' => $member->role,
                ],
                'created_at' => now(),
            ]);

            return $member;
        });

        return response()->json([
            'success' => true,
            'message' => "Anda telah berhasil bergabung dengan proyek '{$project->title}'.",
            'data' => [
                'project_id' => $project->id,
                'project_title' => $project->title,
                'role' => $member->role,
            ],
        ]);
    }

    /**
     * Update an existing member's role.
     */
    public function updateRole(Request $request, Project $project, User $user)
    {
        $currentUser = $request->user();

        if (!$this->permissionService->canManageMember($currentUser, $project, $user, 'manage')) {
            abort(403, 'Unauthorized to update member role.');
        }

        // Cannot modify project creator / owner role
        if ($user->id === $project->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Peran Pemilik proyek dilindungi dan tidak dapat diubah.',
            ], 403);
        }

        $validated = $request->validate([
            'role_id' => [
                'nullable',
                Rule::exists('project_roles', 'id')->where('project_id', $project->id),
            ],
            'role' => 'nullable|string',
        ]);

        $roleId = $validated['role_id'] ?? null;
        $roleSlug = $validated['role'] ?? 'member';

        if ($roleId) {
            $roleObj = ProjectRole::where('id', $roleId)->where('project_id', $project->id)->first();
            if ($roleObj) {
                $roleSlug = $roleObj->slug;
            }
        } else {
            $roleObj = ProjectRole::where('project_id', $project->id)->where('slug', $roleSlug)->first();
            if ($roleObj) {
                $roleId = $roleObj->id;
            }
        }

        // Non-owners cannot promote someone to Owner
        if ($roleSlug === ProjectRole::ROLE_OWNER && $currentUser->id !== $project->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya pemilik proyek yang dapat menetapkan peran Pemilik.',
            ], 403);
        }

        $member = ProjectMember::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $member->update([
            'role_id' => $roleId,
            'role' => $roleSlug,
        ]);

        AuditLog::create([
            'user_id' => $currentUser->id,
            'project_id' => $project->id,
            'action' => 'members.role_updated',
            'auditable_type' => ProjectMember::class,
            'auditable_id' => (string) $member->id,
            'payload' => [
                'target_user_id' => $user->id,
                'new_role' => $roleSlug,
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Peran anggota berhasil diperbarui.',
            'data' => $member->load(['user:id,name,email', 'projectRole']),
        ]);
    }

    /**
     * Remove a member from the project.
     */
    public function destroy(Request $request, Project $project, User $user)
    {
        $currentUser = $request->user();

        if (!$this->permissionService->canManageMember($currentUser, $project, $user, 'remove')) {
            abort(403, 'Unauthorized to remove members.');
        }

        // Cannot remove project owner
        if ($user->id === $project->user_id) {
            return response()->json([
                'success' => false,
                'message' => 'Pemilik proyek tidak dapat dikeluarkan dari proyek.',
            ], 403);
        }

        $member = ProjectMember::where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Anggota tidak ditemukan di proyek ini.',
            ], 404);
        }

        $member->delete();

        // Unassign user from any tasks in this project
        $project->tasks()->where('assigned_to', $user->id)->update(['assigned_to' => null]);

        AuditLog::create([
            'user_id' => $currentUser->id,
            'project_id' => $project->id,
            'action' => 'members.removed',
            'auditable_type' => User::class,
            'auditable_id' => (string) $user->id,
            'payload' => [
                'removed_user_id' => $user->id,
                'removed_user_name' => $user->name,
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Anggota berhasil dikeluarkan dari proyek.',
        ]);
    }

    /**
     * Ensure project owner is present in project_members table.
     */
    private function ensureOwnerMember(Project $project): void
    {
        $ownerRole = ProjectRole::firstOrCreate(
            [
                'project_id' => $project->id,
                'slug' => ProjectRole::ROLE_OWNER,
            ],
            [
                'name' => 'Owner',
                'description' => 'Full administrative control over project, members, roles, and settings.',
                'color' => '#6366F1',
                'is_builtin' => true,
                'permissions' => ['*'],
            ]
        );

        ProjectMember::firstOrCreate(
            [
                'project_id' => $project->id,
                'user_id' => $project->user_id,
            ],
            [
                'role_id' => $ownerRole->id,
                'role' => ProjectRole::ROLE_OWNER,
                'joined_at' => $project->created_at ?? now(),
            ]
        );
    }
}
