<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;
use App\Services\PermissionService;

class ProjectPolicy
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    public function view(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'project.view');
    }

    public function update(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'project.update');
    }

    public function archive(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'project.archive');
    }

    public function delete(User $user, Project $project): bool
    {
        // Deleting project is restricted to project creator / owner
        return $project->user_id === $user->id;
    }

    public function viewMembers(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'members.view')
            || $this->permissionService->userHasProjectPermission($user, $project, 'project.view');
    }

    public function inviteMembers(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'members.invite');
    }

    public function removeMembers(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'members.remove');
    }

    public function manageMembers(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'members.manage');
    }

    public function viewRoles(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'roles.view')
            || $this->permissionService->userHasProjectPermission($user, $project, 'project.view');
    }

    public function createRoles(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'roles.create')
            || $this->permissionService->userHasProjectPermission($user, $project, 'roles.manage');
    }

    public function updateRoles(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'roles.update')
            || $this->permissionService->userHasProjectPermission($user, $project, 'roles.manage');
    }

    public function deleteRoles(User $user, Project $project): bool
    {
        return $this->permissionService->userHasProjectPermission($user, $project, 'roles.delete')
            || $this->permissionService->userHasProjectPermission($user, $project, 'roles.manage');
    }
}
