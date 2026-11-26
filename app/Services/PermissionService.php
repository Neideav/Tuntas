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
     */
    public function userHasTaskPermission(User $user, Task $task, string $permission): bool
    {
        // 1. If task has a project, evaluate against project permissions
        if ($task->project_id) {
            $project = $task->project ?? Project::find($task->project_id);
            if ($project) {
                // Task assignee can always view and complete their assigned task
                if ($task->assigned_to === $user->id && in_array($permission, ['tasks.view', 'tasks.complete', 'task:view', 'task:complete'], true)) {
                    return true;
                }
                return $this->userHasProjectPermission($user, $project, $permission);
            }
        }

        // 2. Personal task: owner or assignee has access
        if ($task->user_id === $user->id || $task->assigned_to === $user->id) {
            return true;
        }

        return false;
    }

    /**
     * Check if a user has a specific permission on a note.
     */
    public function userHasNotePermission(User $user, Note $note, string $permission): bool
    {
        // 1. Author of the note always has full rights to their own note
        if ($note->user_id === $user->id) {
            return true;
        }

        // 2. Project context note
        if ($note->project_id) {
            $project = $note->project ?? Project::find($note->project_id);
            if ($project) {
                return $this->userHasProjectPermission($user, $project, $permission);
            }
        }

        // 3. Task context note
        if ($note->task_id) {
            $task = $note->task ?? Task::find($note->task_id);
            if ($task) {
                return $this->userHasTaskPermission($user, $task, $permission);
            }
        }

        // 4. Workspace context note: viewing allowed if visibility is public or team
        if (in_array($permission, ['notes.view', 'note:view'], true) && in_array($note->visibility, [Note::VISIBILITY_TEAM, Note::VISIBILITY_PUBLIC], true)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a user has a specific permission on a work report.
     * Enforces strict separation: Author cannot approve or review their own report.
     */
    public function userHasReportPermission(User $user, WorkReport $report, string $permission): bool
    {
        // STRICT RULE: Author CANNOT approve, review, request revision, or reject their own report
        if ($report->user_id === $user->id && in_array($permission, ['reports.approve', 'reports.review', 'reports.request_revision', 'reports.reject'], true)) {
            return false;
        }

        // 1. Author permissions on their own report (view, submit, update, delete)
        if ($report->user_id === $user->id) {
            return in_array($permission, ['reports.view', 'reports.submit', 'reports.update', 'reports.delete'], true);
        }

        // 2. Project context report
        if ($report->project_id) {
            $project = $report->project ?? Project::find($report->project_id);
            if ($project) {
                // Project owner has all permissions on project reports EXCEPT approving their own (handled above)
                if ($project->user_id === $user->id) {
                    return true;
                }
                return $this->userHasProjectPermission($user, $project, $permission);
            }
        }

        // 3. Task context report
        if ($report->task_id) {
            $task = $report->task ?? Task::find($report->task_id);
            if ($task) {
                if ($task->project_id) {
                    $project = $task->project ?? Project::find($task->project_id);
                    if ($project) {
                        if ($project->user_id === $user->id) {
                            return true;
                        }
                        return $this->userHasProjectPermission($user, $project, $permission);
                    }
                }

                // Personal task: task owner can view or review if assigned
                if ($task->user_id === $user->id && $report->user_id !== $user->id) {
                    return true;
                }
            }
        }

        // 4. Workspace context report: explicitly assigned reviewer has review/approval rights
        if ($report->reviewer_id === $user->id) {
            return in_array($permission, ['reports.view', 'reports.review', 'reports.approve', 'reports.request_revision', 'reports.reject'], true);
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
