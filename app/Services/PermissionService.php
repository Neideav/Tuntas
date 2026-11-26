<?php

namespace App\Services;

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
        // 1. Direct project creator/owner always has full access
        if ($project->user_id === $user->id) {
            return true;
        }

        // 2. Check project membership
        $member = ProjectMember::with('role')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        if (!$member || !$member->role) {
            return false;
        }

        return $member->role->hasPermission($permission);
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
                if ($task->assigned_to === $user->id && in_array($permission, ['task:view', 'task:complete'], true)) {
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
     * Get the active role of a user in a project.
     */
    public function getUserProjectRole(User $user, Project $project): ?ProjectRole
    {
        if ($project->user_id === $user->id) {
            return ProjectRole::where('project_id', $project->id)
                ->where('slug', ProjectRole::ROLE_OWNER)
                ->first();
        }

        $member = ProjectMember::with('role')
            ->where('project_id', $project->id)
            ->where('user_id', $user->id)
            ->first();

        return $member?->role;
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
