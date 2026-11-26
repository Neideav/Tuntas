<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;
use App\Services\PermissionService;

class TaskPolicy
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    public function view(User $user, Task $task): bool
    {
        return $this->permissionService->userHasTaskPermission($user, $task, 'tasks.view');
    }

    public function update(User $user, Task $task): bool
    {
        return $this->permissionService->userHasTaskPermission($user, $task, 'tasks.update');
    }

    public function complete(User $user, Task $task): bool
    {
        return $this->permissionService->userHasTaskPermission($user, $task, 'tasks.complete');
    }

    public function delete(User $user, Task $task): bool
    {
        return $this->permissionService->userHasTaskPermission($user, $task, 'tasks.delete');
    }
}
