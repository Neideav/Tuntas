<?php

namespace App\Services;

use App\Models\Note;
use App\Models\WorkReport;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectRole;
use App\Models\Task;
use App\Models\User;

class PermissionService
{
    /**
     * Check if a user has a specific permission on a project.
     */
    public function userHasProjectPermission(User $user, Project $project, string $permission): bool
    {
        // 1. Direct project creator/owner always has full wildcard access
        if ($project->user_id === $user->id) {
            return true;
        }

        // 2. Check project membership
        $member = ProjectMember::with('projectRole')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return false;
        }

        return $member->hasPermission($permission);
    }

    /**
     * Check if a user has a specific permission on a task.
     * Differentiates tasks.view, tasks.update, tasks.complete, tasks.delete.
     * Enforces that project tasks strictly follow project role permissions.
     * Restricts personal task assignees from performing destructive actions.
     */
    public function userHasTaskPermission(User $user, Task $task, string $permission): bool
    {
        $normalizedPerm = match ($permission) {
            'task:view', 'tasks:view' => 'tasks.view',
            'task:update', 'tasks:update' => 'tasks.update',
            'task:complete', 'tasks:complete' => 'tasks.complete',
            'task:delete', 'tasks:delete' => 'tasks.delete',
            'task:assign', 'tasks:assign' => 'tasks.assign',
            default => str_replace(':', '.', $permission),
        };

        // 1. If task belongs to a project, evaluate strictly against project membership and roles
        if ($task->project_id) {
            $project = $task->project ?? Project::find($task->project_id);
            if (!$project) {
                return false;
            }

            // Project creator/primary owner always has full wildcard access
            if ($project->user_id === $user->id) {
                return true;
            }

            // User must be an active project member
            $member = ProjectMember::with('projectRole')
                ->where('project_id', $project->id)
                ->where('user_id', $user->id)
                ->first();

            if (!$member) {
                // Removed or non-member has NO access to project tasks
                return false;
            }

            // Check member's role permissions for the requested action
            return $member->hasPermission($normalizedPerm);
        }

        // 2. Personal task (no project attached)
        // Valid task-level permissions that can be exercised on personal tasks
        $validPersonalTaskPerms = [
            'tasks.view',
            'tasks.update',
            'tasks.complete',
            'tasks.delete',
            'tasks.assign',
            'tasks.create',
            'notes.view',
            'notes.create',
        ];

        // Do not allow personal task context to grant arbitrary unrelated permissions
        if (!in_array($normalizedPerm, $validPersonalTaskPerms, true)) {
            return false;
        }

        // 2a. Task Creator / Owner: has full legitimate task control over their own personal task
        if ($task->user_id === $user->id) {
            return true;
        }

        // 2b. Task Assignee: strictly restricted to viewing and completing the task
        if ($task->assigned_to === $user->id) {
            return in_array($normalizedPerm, ['tasks.view', 'tasks.complete', 'notes.view'], true);
        }

        return false;
    }

    /**
     * Get all project IDs where user has a specific permission.
     */
    public function getUserProjectsWithPermission(User $user, string $permission): array
    {
        $ownedProjectIds = Project::where('user_id', $user->id)->pluck('id')->toArray();

        $members = ProjectMember::with('projectRole')
            ->where('user_id', $user->id)
            ->get();

        $memberProjectIds = [];
        foreach ($members as $member) {
            if ($member->hasPermission($permission)) {
                $memberProjectIds[] = (int) $member->project_id;
            }
        }

        return array_values(array_unique(array_merge($ownedProjectIds, $memberProjectIds)));
    }

    /**
     * Check if a user has a specific permission on a note.
     * Enforces that project notes require active project membership/ownership.
     */
    public function userHasNotePermission(User $user, Note $note, string $permission): bool
    {
        $normalizedPerm = str_replace(':', '.', $permission);

        // 1. Project context note: strictly bound to project authorization
        if ($note->project_id) {
            $project = $note->project ?? Project::find($note->project_id);
            if (!$project) {
                return false;
            }

            // Project owner has full rights
            if ($project->user_id === $user->id) {
                return true;
            }

            // User must be an active project member
            $member = ProjectMember::with('projectRole')
                ->where('project_id', $project->id)
                ->where('user_id', $user->id)
                ->first();

            if (!$member) {
                // Removed member has NO access to project notes, even if authored by them
                return false;
            }

            return $member->hasPermission($normalizedPerm);
        }

        // 2. Task context note: bound to task permission
        if ($note->task_id) {
            $task = $note->task ?? Task::find($note->task_id);
            if ($task) {
                return $this->userHasTaskPermission($user, $task, $normalizedPerm);
            }
            return false;
        }

        // 3. Workspace/Personal note:
        // 3a. Author always has full rights on their personal/workspace note
        if ($note->user_id === $user->id) {
            return true;
        }

        // 3b. Workspace context note: viewing allowed if visibility is public or team
        if (in_array($normalizedPerm, ['notes.view'], true) && in_array($note->visibility, [Note::VISIBILITY_TEAM, Note::VISIBILITY_PUBLIC], true)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a user has a specific permission on a work report.
     * Enforces strict separation: Author cannot approve or review their own report.
     * Enforces that project reports require active project membership.
     */
    public function userHasReportPermission(User $user, WorkReport $report, string $permission): bool
    {
        $normalizedPerm = str_replace(':', '.', $permission);

        // STRICT RULE: Author CANNOT approve, review, request revision, or reject their own report
        if ($report->user_id === $user->id && in_array($normalizedPerm, ['reports.approve', 'reports.review', 'reports.request_revision', 'reports.reject'], true)) {
            return false;
        }

        // 1. Project context report
        if ($report->project_id) {
            $project = $report->project ?? Project::find($report->project_id);
            if (!$project) {
                return false;
            }

            // Project owner has all permissions on project reports EXCEPT approving their own (handled above)
            if ($project->user_id === $user->id) {
                return true;
            }

            // Must be an active member
            $member = ProjectMember::with('projectRole')
                ->where('project_id', $project->id)
                ->where('user_id', $user->id)
                ->first();

            if (!$member) {
                // Removed member has NO access to project reports
                return false;
            }

            return $member->hasPermission($normalizedPerm);
        }

        // 2. Task context report
        if ($report->task_id) {
            $task = $report->task ?? Task::find($report->task_id);
            if ($task) {
                if ($task->project_id) {
                    $project = $task->project ?? Project::find($task->project_id);
                    if ($project) {
                        if ($project->user_id === $user->id) {
                            return true;
                        }
                        return $this->userHasProjectPermission($user, $project, $normalizedPerm);
                    }
                }

                // Personal task: task owner can view or review if assigned
                if ($task->user_id === $user->id && $report->user_id !== $user->id) {
                    return true;
                }
            }
        }

        // 3. Workspace report author permissions on their own report (view, submit, update, delete)
        if ($report->user_id === $user->id) {
            return in_array($normalizedPerm, ['reports.view', 'reports.submit', 'reports.update', 'reports.delete'], true);
        }

        // 4. Workspace context report: explicitly assigned reviewer has review/approval rights
        if ($report->reviewer_id === $user->id) {
            return in_array($normalizedPerm, ['reports.view', 'reports.review', 'reports.approve', 'reports.request_revision', 'reports.reject'], true);
        }

        return false;
    }

    /**
     * Get the active role of a user in a project.
     */
    public function getUserProjectRole(User $user, Project $project): ?ProjectRole
    {
        if ($project->user_id === $user->id) {
            return ProjectRole::where('project_id', $project->id)
                ->where('slug', ProjectRole::ROLE_OWNER)
                ->first();
        }

        $member = ProjectMember::with('projectRole')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        return $member?->projectRole;
    }

    /**
     * Get array of all effective permissions for a user on a project.
     */
    public function getUserEffectivePermissions(User $user, Project $project): array
    {
        if ($project->user_id === $user->id) {
            return ['*'];
        }

        $member = ProjectMember::with('projectRole')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$member) {
            return [];
        }

        if ($member->role === ProjectRole::ROLE_OWNER) {
            return ['*'];
        }

        if ($member->projectRole) {
            return $member->projectRole->permissions ?? [];
        }

        return ProjectRole::getDefaultPermissions($member->role);
    }

    /**
     * Check if user is allowed to manage (create, edit, delete) roles in project.
     */
    public function canManageRole(User $user, Project $project, ?ProjectRole $targetRole = null, string $action = 'update'): bool
    {
        // Must have roles permission
        $requiredPerm = match ($action) {
            'create' => 'roles.create',
            'delete' => 'roles.delete',
            default => 'roles.update',
        };

        if (!$this->userHasProjectPermission($user, $project, $requiredPerm) &&
            !$this->userHasProjectPermission($user, $project, 'roles.manage')) {
            return false;
        }

        if ($targetRole) {
            // Built-in Owner role cannot be modified or deleted by anyone
            if ($targetRole->slug === ProjectRole::ROLE_OWNER) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if user is allowed to manage (invite, change role, remove) a member in project.
     */
    public function canManageMember(User $user, Project $project, ?User $targetUser = null, string $action = 'manage'): bool
    {
        $requiredPerm = match ($action) {
            'invite' => 'members.invite',
            'remove' => 'members.remove',
            default => 'members.manage',
        };

        if (!$this->userHasProjectPermission($user, $project, $requiredPerm)) {
            return false;
        }

        if ($targetUser) {
            // Cannot remove or demote project creator/owner
            if ($targetUser->id === $project->user_id) {
                return false;
            }

            // Cannot remove yourself through member remove endpoint (should use leave instead if permitted)
            if ($targetUser->id === $user->id && $action === 'remove' && $project->user_id === $user->id) {
                return false;
            }
        }

        return true;
    }

    /**
     * Ensure default built-in roles exist for a given project.
     *
     * @return array<string, ProjectRole>
     */
    public function ensureBuiltinRoles(Project $project): array
    {
        return ProjectRole::ensureBuiltinRolesForProject($project);
    }
}
