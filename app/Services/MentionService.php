<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Events\RoleMentioned;
use App\Events\UserMentioned;
use App\Models\Mention;
use App\Models\Notification;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\User;
use App\Models\UserSetting;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * MentionService — handles structured mention extraction, validation,
 * cross-project isolation, role resolution, duplicate prevention, and
 * notification dispatch for every mention context in Tuntas.
 */
class MentionService
{
    public function __construct(
        private readonly NotificationService $notificationService
    ) {}

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Process structured mentions from a TipTap/ProseMirror JSON doc or plain text.
     * Validates context membership, removes duplicates, fires notifications.
     *
     * @param  User         $mentioner      The user who authored the content
     * @param  Model        $mentionable    The model the content belongs to (Note, Task, WorkReport, NoteComment…)
     * @param  string|array $content        Raw content (JSON string, array, or plain text)
     * @param  string       $contextType    'workspace' | 'project' | 'task' | 'note' | 'report' | 'comment'
     * @param  int          $contextId      Primary key of the context model
     * @param  string       $contextTitle   Human-readable title for notification messages
     * @param  int|null     $projectId      Project scope for membership validation
     */
    public function processMentions(
        User   $mentioner,
        Model  $mentionable,
        string|array $content,
        string $contextType,
        int    $contextId,
        string $contextTitle,
        ?int   $projectId = null
    ): void {
        $extracted = $this->extractFromContent($content, $projectId);

        DB::transaction(function () use (
            $mentioner, $mentionable, $extracted,
            $contextType, $contextId, $contextTitle, $projectId
        ) {
            // Clear old mentions for this model — will recreate fresh
            $mentionable->mentions()->delete();

            // --- User mentions ---
            $this->processUserMentions(
                $mentioner, $mentionable, $extracted['user_ids'],
                $contextType, $contextId, $contextTitle, $projectId
            );

            // --- Role mentions ---
            if ($projectId) {
                $this->processRoleMentions(
                    $mentioner, $mentionable, $extracted['role_ids'],
                    $contextType, $contextId, $contextTitle, $projectId
                );
            }
        });
    }

    /**
     * Return autocomplete candidates for a project context.
     * Returns members (users) and roles in one payload.
     */
    public function getAutocompleteCandidates(?int $projectId, string $query = ''): array
    {
        $users = [];
        $roles = [];

        if ($projectId) {
            // Project members (not removed)
            $members = ProjectMember::with('user', 'projectRole')
                ->where('project_id', $projectId)
                ->get();

            foreach ($members as $m) {
                $u = $m->user;
                if (!$u) {
                    continue;
                }
                if ($query && !str_contains(mb_strtolower($u->name), mb_strtolower($query))
                    && !str_contains(mb_strtolower($u->email ?? ''), mb_strtolower($query))) {
                    continue;
                }
                $users[] = [
                    'id'       => $u->id,
                    'name'     => $u->name,
                    'email'    => $u->email,
                    'avatar'   => $this->avatarInitials($u->name),
                    'role'     => $m->projectRole?->name ?? $m->role,
                ];
            }

            // Project roles
            $projectRoles = ProjectRole::where('project_id', $projectId)->get();
            foreach ($projectRoles as $r) {
                if ($query && !str_contains(mb_strtolower($r->name), mb_strtolower($query))
                    && !str_contains(mb_strtolower($r->slug), mb_strtolower($query))) {
                    continue;
                }
                $roles[] = [
                    'id'          => $r->id,
                    'name'        => $r->name,
                    'slug'        => $r->slug,
                    'color'       => $r->color ?? '#6366f1',
                    'member_count' => ProjectMember::where('project_id', $projectId)
                        ->where('role_id', $r->id)->count(),
                ];
            }
        } else {
            // Workspace: all users (no project filter — author can @mention anyone they can see)
            // Limit to 20 for performance
            $userQuery = User::query();
            if ($query) {
                $userQuery->where(function ($q) use ($query) {
                    $q->where('name', 'like', "%{$query}%")
                      ->orWhere('email', 'like', "%{$query}%");
                });
            }
            foreach ($userQuery->limit(20)->get() as $u) {
                $users[] = [
                    'id'     => $u->id,
                    'name'   => $u->name,
                    'email'  => $u->email,
                    'avatar' => $this->avatarInitials($u->name),
                    'role'   => null,
                ];
            }
        }

        return ['users' => $users, 'roles' => $roles];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Extract mentioned user IDs and role IDs from content.
     * Supports:
     *   - Structured JSON: {"type":"mention","attrs":{"id":5,"mentionType":"user"}}
     *   - Structured JSON: {"type":"mention","attrs":{"id":3,"mentionType":"role"}}
     *   - Plain text: @username  or  @role:slug
     */
    public function extractFromContent(string|array $content, ?int $projectId = null): array
    {
        $userIds  = [];
        $roleIds  = [];

        if (is_array($content)) {
            // TipTap JSON doc
            $this->walkJsonDoc($content, $userIds, $roleIds);
        } else {
            // Try to decode as JSON first
            $decoded = json_decode($content, true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $this->walkJsonDoc($decoded, $userIds, $roleIds);
            } else {
                // Plain text fallback
                $this->extractFromPlainText($content, $userIds, $roleIds, $projectId);
            }
        }

        return [
            'user_ids' => array_values(array_unique($userIds)),
            'role_ids' => array_values(array_unique($roleIds)),
        ];
    }

    private function walkJsonDoc(array $node, array &$userIds, array &$roleIds): void
    {
        if (($node['type'] ?? '') === 'mention') {
            $attrs = $node['attrs'] ?? [];
            $mentionType = $attrs['mentionType'] ?? $attrs['type'] ?? 'user';
            $id          = (int) ($attrs['id'] ?? 0);
            if ($id > 0) {
                if ($mentionType === 'role') {
                    $roleIds[] = $id;
                } else {
                    $userIds[] = $id;
                }
            }
        }
        foreach ($node['content'] ?? [] as $child) {
            $this->walkJsonDoc($child, $userIds, $roleIds);
        }
    }

    private function extractFromPlainText(string $text, array &$userIds, array &$roleIds, ?int $projectId): void
    {
        // Role mentions: @role:slug
        if (preg_match_all('/@role:([a-z0-9_\-]+)/i', $text, $matches)) {
            if ($projectId) {
                $roles = ProjectRole::where('project_id', $projectId)
                    ->whereIn('slug', $matches[1])
                    ->pluck('id')
                    ->toArray();
                $roleIds = array_merge($roleIds, $roles);
            }
        }
        // User mentions: @username or @email or @user@domain
        if (preg_match_all('/@([a-zA-Z0-9_.@\-]+)/', $text, $matches)) {
            foreach ($matches[1] as $handle) {
                if (str_starts_with($handle, 'role:')) {
                    continue; // already handled above
                }
                // Strip trailing punctuation if matched
                $cleanHandle = rtrim($handle, '.,!?:;');
                $user = User::where('name', $cleanHandle)
                    ->orWhere('email', $cleanHandle)
                    ->orWhere('name', 'like', "%{$cleanHandle}%")
                    ->first();
                if ($user) {
                    $userIds[] = $user->id;
                }
            }
        }
    }

    private function processUserMentions(
        User   $mentioner,
        Model  $mentionable,
        array  $userIds,
        string $contextType,
        int    $contextId,
        string $contextTitle,
        ?int   $projectId
    ): void {
        foreach ($userIds as $userId) {
            if ($userId === $mentioner->id) {
                continue; // Don't notify yourself
            }

            $mentionedUser = User::find($userId);
            if (!$mentionedUser) {
                continue;
            }

            // Cross-project isolation: if project-scoped, user must be a project member
            if ($projectId && !$this->isProjectMember($userId, $projectId)) {
                continue;
            }

            // Respect notification preferences
            if (!$this->userWantsMentionNotification($mentionedUser)) {
                continue;
            }

            // Persist the mention record
            $mention = $mentionable->mentions()->create([
                'mentioner_id'      => $mentioner->id,
                'mentioned_user_id' => $userId,
                'project_id'        => $projectId,
                'context_type'      => $contextType,
            ]);

            // Idempotent notification: don't create duplicate within 5 min
            $actionUrl = $this->buildActionUrl($contextType, $contextId, $projectId);
            $idempotencyKey = "mention.user.{$userId}.{$contextType}.{$contextId}.{$mentioner->id}";

            $notification = $this->notificationService->createIdempotent(
                userId:          $userId,
                title:           "{$mentioner->name} menandai Anda",
                message:         "{$mentioner->name} menyebut Anda dalam {$this->contextLabel($contextType)} \"{$contextTitle}\".",
                type:            'user_mentioned',
                actionUrl:       $actionUrl,
                idempotencyKey:  $idempotencyKey,
                meta:            [
                    'mentioner_id'  => $mentioner->id,
                    'context_type'  => $contextType,
                    'context_id'    => $contextId,
                    'project_id'    => $projectId,
                ]
            );

            // Broadcast (best-effort — log driver is fine in dev)
            if ($notification) {
                try {
                    event(new UserMentioned(
                        $mentionedUser, $mentioner, $mention,
                        $contextType, $contextId, $contextTitle, $projectId
                    ));
                } catch (\Throwable $e) {
                    Log::warning("UserMentioned broadcast failed: {$e->getMessage()}");
                }
            }
        }
    }

    private function processRoleMentions(
        User   $mentioner,
        Model  $mentionable,
        array  $roleIds,
        string $contextType,
        int    $contextId,
        string $contextTitle,
        int    $projectId
    ): void {
        foreach ($roleIds as $roleId) {
            // SECURITY: role must belong to the SAME project (cross-project isolation)
            $role = ProjectRole::where('id', $roleId)
                ->where('project_id', $projectId)
                ->first();

            if (!$role) {
                continue; // Cross-project role mention rejected
            }

            // Persist role mention record
            $mentionable->mentions()->create([
                'mentioner_id'      => $mentioner->id,
                'mentioned_role_id' => $roleId,
                'project_id'        => $projectId,
                'context_type'      => $contextType,
            ]);

            // Resolve role to active members in this project
            $members = ProjectMember::with('user')
                ->where('project_id', $projectId)
                ->where('role_id', $roleId)
                ->get();

            foreach ($members as $member) {
                $user = $member->user;
                if (!$user || $user->id === $mentioner->id) {
                    continue;
                }

                // Respect notification preferences
                if (!$this->userWantsMentionNotification($user)) {
                    continue;
                }

                $actionUrl = $this->buildActionUrl($contextType, $contextId, $projectId);
                $idempotencyKey = "mention.role.{$user->id}.{$roleId}.{$contextType}.{$contextId}.{$mentioner->id}";

                $notification = $this->notificationService->createIdempotent(
                    userId:         $user->id,
                    title:          "{$mentioner->name} menyebut @{$role->name}",
                    message:        "{$mentioner->name} menyebut peran \"{$role->name}\" dalam {$this->contextLabel($contextType)} \"{$contextTitle}\".",
                    type:           'role_mentioned',
                    actionUrl:      $actionUrl,
                    idempotencyKey: $idempotencyKey,
                    meta:           [
                        'mentioner_id'  => $mentioner->id,
                        'role_id'       => $roleId,
                        'role_name'     => $role->name,
                        'context_type'  => $contextType,
                        'context_id'    => $contextId,
                        'project_id'    => $projectId,
                    ]
                );

                if ($notification) {
                    try {
                        event(new RoleMentioned(
                            $user, $mentioner, $role,
                            $contextType, $contextId, $contextTitle, $projectId
                        ));
                    } catch (\Throwable $e) {
                        Log::warning("RoleMentioned broadcast failed: {$e->getMessage()}");
                    }
                }
            }
        }
    }

    private function isProjectMember(int $userId, int $projectId): bool
    {
        return ProjectMember::where('project_id', $projectId)
            ->where('user_id', $userId)
            ->exists();
    }

    private function userWantsMentionNotification(User $user): bool
    {
        $settings = UserSetting::where('user_id', $user->id)->first();
        if (!$settings) {
            return true; // Default: opt-in
        }
        if (!(bool) $settings->in_app_notifications) {
            return false;
        }
        $prefs = $settings->preferences ?? [];
        return (bool) ($prefs['mention_notifications'] ?? true);
    }

    private function buildActionUrl(string $contextType, int $contextId, ?int $projectId): string
    {
        return match ($contextType) {
            'task'    => "/tasks/{$contextId}",
            'project' => "/projects/{$contextId}",
            'note'    => "/notes/{$contextId}",
            'report'  => "/reports/{$contextId}",
            'comment' => $projectId ? "/projects/{$projectId}" : "/notes/{$contextId}",
            default   => '/notifications',
        };
    }

    private function contextLabel(string $contextType): string
    {
        return match ($contextType) {
            'task'    => 'tugas',
            'project' => 'proyek',
            'note'    => 'catatan',
            'report'  => 'laporan',
            'comment' => 'komentar',
            default   => 'konten',
        };
    }

    private function avatarInitials(string $name): string
    {
        $parts = explode(' ', trim($name));
        $initials = '';
        foreach (array_slice($parts, 0, 2) as $p) {
            $initials .= strtoupper($p[0] ?? '');
        }
        return $initials ?: 'U';
    }
}
