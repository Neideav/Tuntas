<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\Subtask;
use App\Models\Tag;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    /**
     * List user tasks with advanced filtering, searching, and pagination.
     */
    public function index(Request $request)
    {
        $query = Task::where('user_id', $request->user()->id)
            ->with(['category', 'project', 'subtasks', 'tags']);

        // Filter by Status
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filter by Priority
        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }

        // Filter by Category
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        // Filter by Project
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        // Filter by Tag
        if ($request->filled('tag_id')) {
            $query->whereHas('tags', function ($tq) use ($request) {
                $tq->where('tags.id', $request->tag_id);
            });
        }

        // Search in title or description
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        // Filter by Date Horizon
        if ($request->get('filter') === 'today') {
            $query->whereDate('due_date', Carbon::today());
        } elseif ($request->get('filter') === 'upcoming') {
            $query->whereDate('due_date', '>', Carbon::today());
        } elseif ($request->get('filter') === 'overdue') {
            $query->whereIn('status', ['todo', 'in_progress'])
                  ->where('due_date', '<', Carbon::now());
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $allowedSorts = ['created_at', 'due_date', 'priority', 'title', 'order'];
        if (in_array($sortBy, $allowedSorts)) {
            $query->orderBy($sortBy, $sortOrder === 'asc' ? 'asc' : 'desc');
        } else {
            $query->orderBy('created_at', 'desc');
        }

        $perPage = (int) $request->get('per_page', 50);
        $tasks = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $tasks->items(),
            'meta' => [
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'per_page' => $tasks->perPage(),
                'total' => $tasks->total(),
            ],
        ]);
    }

    /**
     * Store a newly created task.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:todo,in_progress,in_review,completed,cancelled',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'project_id' => 'nullable|exists:projects,id',
            'category_id' => 'nullable|exists:categories,id',
            'due_date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'reminder_at' => 'nullable|date',
            'is_recurring' => 'nullable|boolean',
            'recurrence_pattern' => 'nullable|in:daily,weekly,monthly',
            'subtasks' => 'nullable|array',
            'subtasks.*.title' => 'required|string|max:255',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $task = Task::create([
            'user_id' => $request->user()->id,
            'project_id' => $validated['project_id'] ?? null,
            'category_id' => $validated['category_id'] ?? null,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'todo',
            'priority' => $validated['priority'] ?? 'medium',
            'due_date' => $validated['due_date'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'reminder_at' => $validated['reminder_at'] ?? null,
            'is_recurring' => $validated['is_recurring'] ?? false,
            'recurrence_pattern' => $validated['recurrence_pattern'] ?? 'daily',
            'completed_at' => ($validated['status'] ?? 'todo') === 'completed' ? Carbon::now() : null,
        ]);

        // Subtasks
        if (!empty($validated['subtasks'])) {
            foreach ($validated['subtasks'] as $index => $sub) {
                $task->subtasks()->create([
                    'title' => $sub['title'],
                    'order' => $index,
                ]);
            }
        }

        // Tags
        if (!empty($validated['tags'])) {
            $tagIds = [];
            foreach ($validated['tags'] as $tagName) {
                $tag = Tag::firstOrCreate(
                    ['user_id' => $request->user()->id, 'name' => trim($tagName)],
                    ['color' => '#0284c7']
                );
                $tagIds[] = $tag->id;
            }
            $task->tags()->sync($tagIds);
        }

        // Recalculate project progress if associated
        if ($task->project_id) {
            $task->project->updateProgress();
        }

        // Audit Log
        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'task.created',
            'auditable_type' => Task::class,
            'auditable_id' => (string) $task->id,
            'payload' => ['title' => $task->title, 'priority' => $task->priority],
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Task created successfully',
            'data' => $task->load(['category', 'project', 'subtasks', 'tags']),
        ], 201);
    }

    /**
     * Display a specific task.
     */
    public function show(Request $request, Task $task)
    {
        $this->authorizeOwner($request, $task);

        return response()->json([
            'success' => true,
            'data' => $task->load(['category', 'project', 'subtasks', 'tags']),
        ]);
    }

    /**
     * Update an existing task.
     */
    public function update(Request $request, Task $task)
    {
        $this->authorizeOwner($request, $task);

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:todo,in_progress,in_review,completed,cancelled',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'project_id' => 'nullable|exists:projects,id',
            'category_id' => 'nullable|exists:categories,id',
            'due_date' => 'nullable|date',
            'start_date' => 'nullable|date',
            'reminder_at' => 'nullable|date',
            'is_recurring' => 'nullable|boolean',
            'recurrence_pattern' => 'nullable|in:daily,weekly,monthly',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        if (isset($validated['status'])) {
            if ($validated['status'] === 'completed' && $task->status !== 'completed') {
                $validated['completed_at'] = Carbon::now();
                // Spawn next recurrence if recurring
                $this->spawnNextRecurrence($task);
            } elseif ($validated['status'] !== 'completed') {
                $validated['completed_at'] = null;
            }
        }

        $task->update($validated);

        if (isset($validated['tags'])) {
            $tagIds = [];
            foreach ($validated['tags'] as $tagName) {
                $tag = Tag::firstOrCreate(
                    ['user_id' => $request->user()->id, 'name' => trim($tagName)],
                    ['color' => '#0284c7']
                );
                $tagIds[] = $tag->id;
            }
            $task->tags()->sync($tagIds);
        }

        if ($task->project_id) {
            $task->project->updateProgress();
        }

        return response()->json([
            'success' => true,
            'message' => 'Task updated successfully',
            'data' => $task->load(['category', 'project', 'subtasks', 'tags']),
        ]);
    }

    /**
     * Toggle task status between todo/in_progress and completed.
     */
    public function toggleStatus(Request $request, Task $task)
    {
        $this->authorizeOwner($request, $task);

        $newStatus = $task->status === 'completed' ? 'todo' : 'completed';
        $completedAt = $newStatus === 'completed' ? Carbon::now() : null;

        $task->update([
            'status' => $newStatus,
            'completed_at' => $completedAt,
        ]);

        if ($newStatus === 'completed' && $task->is_recurring) {
            $this->spawnNextRecurrence($task);
        }

        if ($task->project_id) {
            $task->project->updateProgress();
        }

        return response()->json([
            'success' => true,
            'message' => 'Task status updated',
            'data' => $task->load(['category', 'project', 'subtasks', 'tags']),
        ]);
    }

    /**
     * Delete a task.
     */
    public function destroy(Request $request, Task $task)
    {
        $this->authorizeOwner($request, $task);

        $projectId = $task->project_id;
        $task->delete();

        if ($projectId) {
            Project::find($projectId)?->updateProgress();
        }

        return response()->json([
            'success' => true,
            'message' => 'Task deleted successfully',
        ]);
    }

    /**
     * Automatically generate the next recurrence instance when a recurring task is completed.
     */
    private function spawnNextRecurrence(Task $task): ?Task
    {
        if (!$task->is_recurring) {
            return null;
        }

        $pattern = $task->recurrence_pattern ?: 'daily';
        $nextDueDate = $task->due_date ? Carbon::parse($task->due_date) : Carbon::today();

        if ($pattern === 'daily') {
            $nextDueDate->addDay();
        } elseif ($pattern === 'weekly') {
            $nextDueDate->addWeek();
        } elseif ($pattern === 'monthly') {
            $nextDueDate->addMonth();
        }

        $nextTask = Task::create([
            'user_id' => $task->user_id,
            'project_id' => $task->project_id,
            'category_id' => $task->category_id,
            'title' => $task->title,
            'description' => $task->description,
            'priority' => $task->priority,
            'status' => 'todo',
            'due_date' => $nextDueDate,
            'is_recurring' => true,
            'recurrence_pattern' => $pattern,
        ]);

        // Duplicate subtask templates in reset state
        foreach ($task->subtasks as $sub) {
            $nextTask->subtasks()->create([
                'title' => $sub->title,
                'is_completed' => false,
                'order' => $sub->order,
            ]);
        }

        return $nextTask;
    }

    private function authorizeOwner(Request $request, Task $task): void
    {
        if ($task->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized.');
        }
    }
}


