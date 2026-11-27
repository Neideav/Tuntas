<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\ProjectRole;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProjectRoleController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * Get centralized permission catalog.
     */
    public function catalog()
    {
        return response()->json([
            'success' => true,
            'data' => ProjectRole::PERMISSION_CATALOG,
        ]);
    }

    /**
     * List all roles (built-in and custom) for a project with member counts.
     */
    public function index(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$this->permissionService->userHasProjectPermission($user, $project, 'roles.view') &&
            !$this->permissionService->userHasProjectPermission($user, $project, 'project.view')) {
            abort(403, 'Unauthorized.');
        }

        // Ensure built-in roles exist for this project
        ProjectRole::ensureBuiltinRolesForProject($project);

        $roles = ProjectRole::where('project_id', $project->id)
            ->withCount('members')
            ->orderBy('is_builtin', 'desc')
            ->orderBy('id', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'roles' => $roles,
                'catalog' => ProjectRole::PERMISSION_CATALOG,
            ],
        ]);
    }

    /**
     * Create a new custom role for a project.
     */
    public function store(Request $request, Project $project)
    {
        $user = $request->user();

        if (!$this->permissionService->canManageRole($user, $project, null, 'create')) {
            abort(403, 'Unauthorized to create roles in this project.');
        }

        $allKeys = ProjectRole::allPermissionKeys();

        $validated = $request->validate([
            'name' => 'required|string|max:50',
            'slug' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:30',
            'permissions' => 'required|array',
            'permissions.*' => ['string', Rule::in($allKeys)],
        ]);

        $name = trim($validated['name']);
        $rawSlug = !empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($name);

        // Disallow reserved built-in role slugs
        if (in_array($rawSlug, ProjectRole::BUILTIN_ROLES, true)) {
            return response()->json([
                'success' => false,
                'message' => "Slug peran '{$rawSlug}' merupakan nama peran bawaan sistem dan tidak dapat digunakan.",
            ], 422);
        }

        // Check uniqueness of slug within this project
        $exists = ProjectRole::where('project_id', $project->id)
            ->where('slug', $rawSlug)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => "Peran dengan slug '{$rawSlug}' sudah ada dalam proyek ini.",
            ], 422);
        }

        // Security check: Reject protected owner privileges (e.g. project.delete) from custom roles
        if (in_array('project.delete', $validated['permissions'], true)) {
            return response()->json([
                'success' => false,
                'message' => "Izin 'project.delete' merupakan izin khusus Pemilik proyek dan tidak dapat diberikan kepada peran kustom.",
            ], 422);
        }

        $permissions = array_values(array_unique($validated['permissions']));

        $role = ProjectRole::create([
            'project_id' => $project->id,
            'name' => $name,
            'slug' => $rawSlug,
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'] ?? '#6366F1',
            'is_builtin' => false,
            'permissions' => $permissions,
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'action' => 'roles.created',
            'auditable_type' => ProjectRole::class,
            'auditable_id' => (string) $role->id,
            'payload' => [
                'role_name' => $role->name,
                'slug' => $role->slug,
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Peran '{$role->name}' berhasil dibuat.",
            'data' => $role->loadCount('members'),
        ], 201);
    }

    /**
     * Show role details.
     */
    public function show(Request $request, Project $project, ProjectRole $role)
    {
        $user = $request->user();

        if ($role->project_id !== $project->id) {
            abort(404, 'Peran tidak ditemukan di proyek ini.');
        }

        if (!$this->permissionService->userHasProjectPermission($user, $project, 'roles.view') &&
            !$this->permissionService->userHasProjectPermission($user, $project, 'project.view')) {
            abort(403, 'Unauthorized.');
        }

        return response()->json([
            'success' => true,
            'data' => $role->loadCount('members'),
        ]);
    }

    /**
     * Update an existing role.
     */
    public function update(Request $request, Project $project, ProjectRole $role)
    {
        $user = $request->user();

        if ($role->project_id !== $project->id) {
            abort(404, 'Peran tidak ditemukan di proyek ini.');
        }

        if (!$this->permissionService->canManageRole($user, $project, $role, 'update')) {
            abort(403, 'Unauthorized to update this role.');
        }

        // Built-in Owner role is strictly protected from modification
        if ($role->slug === ProjectRole::ROLE_OWNER) {
            return response()->json([
                'success' => false,
                'message' => 'Izin dan konfigurasi peran Pemilik (Owner) dilindungi dan tidak dapat diubah.',
            ], 403);
        }

        $allKeys = ProjectRole::allPermissionKeys();

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:50',
            'description' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:30',
            'permissions' => 'sometimes|required|array',
            'permissions.*' => ['string', Rule::in($allKeys)],
        ]);

        $updateData = [];

        // If custom role, allow updating name, description, color, permissions
        if (!$role->is_builtin) {
            if (isset($validated['name'])) {
                $updateData['name'] = trim($validated['name']);
            }
        }

        if (isset($validated['description'])) {
            $updateData['description'] = $validated['description'];
        }

        if (isset($validated['color'])) {
            $updateData['color'] = $validated['color'];
        }

        if (isset($validated['permissions'])) {
            // Reject project.delete if attempted on custom/non-owner roles
            if (in_array('project.delete', $validated['permissions'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => "Izin 'project.delete' merupakan izin khusus Pemilik proyek dan tidak dapat diberikan kepada peran kustom.",
                ], 422);
            }
            $updateData['permissions'] = array_values(array_unique($validated['permissions']));
        }

        $role->update($updateData);

        AuditLog::create([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'action' => 'roles.updated',
            'auditable_type' => ProjectRole::class,
            'auditable_id' => (string) $role->id,
            'payload' => [
                'role_name' => $role->name,
                'slug' => $role->slug,
            ],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Peran '{$role->name}' berhasil diperbarui.",
            'data' => $role->fresh()->loadCount('members'),
        ]);
    }

    /**
     * Delete a custom role.
     */
    public function destroy(Request $request, Project $project, ProjectRole $role)
    {
        $user = $request->user();

        if ($role->project_id !== $project->id) {
            abort(404, 'Peran tidak ditemukan di proyek ini.');
        }

        if (!$this->permissionService->canManageRole($user, $project, $role, 'delete')) {
            abort(403, 'Unauthorized to delete this role.');
        }

        // Built-in roles cannot be deleted
        if ($role->is_builtin || in_array($role->slug, ProjectRole::BUILTIN_ROLES, true)) {
            return response()->json([
                'success' => false,
                'message' => 'Peran bawaan sistem tidak dapat dihapus.',
            ], 422);
        }

        // Check if role has active assigned members
        if ($role->members()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Peran tidak dapat dihapus karena masih memiliki anggota aktif. Harap alihkan peran anggota terlebih dahulu.',
            ], 422);
        }

        $roleName = $role->name;
        $role->delete();

        AuditLog::create([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'action' => 'roles.deleted',
            'auditable_type' => ProjectRole::class,
            'auditable_id' => (string) $role->id,
            'payload' => ['role_name' => $roleName],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Peran '{$roleName}' berhasil dihapus.",
        ]);
    }
}
