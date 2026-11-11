<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subtask;
use App\Models\Task;
use Illuminate\Http\Request;

class SubtaskController extends Controller
{
    /**
     * Add subtask to a task.
     */
    public function store(Request $request, Task $task)
    {
        if ($task->user_id !== $request->user()->id) {
            abort(403);
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
        if ($subtask->task->user_id !== $request->user()->id) {
            abort(403);
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
        if ($subtask->task->user_id !== $request->user()->id) {
            abort(403);
        }

        $subtask->delete();

        return response()->json([
            'success' => true,
            'message' => 'Subtask dihapus',
        ]);
    }
}

