<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subtask;
use App\Models\Task;
use App\Services\PermissionService;
use Illuminate\Http\Request;

class SubtaskController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * Add subtask to a task.
     */
    public function store(Request $request, Task $task)
    {
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.update')) {
            abort(403, 'Unauthorized.');
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $maxOrder = $task->subtasks()->max('order') ?? -1;

        $subtask = $task->subtasks()->create([
            'title' => $validated['title'],
            'order' => $maxOrder + 1,
            'is_completed' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Subtask ditambahkan',
            'data' => $subtask,
        ], 201);
    }

    /**
     * Toggle subtask completion status.
     */
    public function toggle(Request $request, Subtask $subtask)
    {
        $task = $subtask->task;
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.complete') &&
            !$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.update')) {
            abort(403, 'Unauthorized.');
        }

        $subtask->update([
            'is_completed' => ! $subtask->is_completed,
        ]);

        return response()->json([
            'success' => true,
            'data' => $subtask,
        ]);
    }

    /**
     * Delete a subtask.
     */
    public function destroy(Request $request, Subtask $subtask)
    {
        $task = $subtask->task;
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.update') &&
            !$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.delete')) {
            abort(403, 'Unauthorized.');
        }

        $subtask->delete();

        return response()->json([
            'success' => true,
            'message' => 'Subtask dihapus',
        ]);
    }
}

