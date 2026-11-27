<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Goal;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Subtask;
use App\Models\Tag;
use App\Models\Task;
use App\Models\User;
use App\Http\Requests\Task\StoreTaskRequest;
use App\Services\NotificationService;
use App\Services\PermissionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    public function __construct(
        protected PermissionService  $permissionService,
        protected NotificationService $notificationService
    ) {}

    /**
     * List user tasks with advanced filtering, searching, and pagination.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        // Project filtering: if a specific project is requested, verify tasks.view permission
        if ($request->filled('project_id')) {
            $projectId = (int) $request->project_id;
            $project = Project::find($projectId);
            if (!$project) {
                return response()->json(['success' => false, 'message' => 'Project not found.'], 404);
            }
            if (!$this->permissionService->userHasProjectPermission($request->user(), $project, 'tasks.view')) {
                abort(403, 'Unauthorized to view tasks in this project.');
            }
        }

        // Get all accessible projects where user is active owner/member with 'tasks.view' permission
        $accessibleProjectIds = $this->permissionService->getUserProjectsWithPermission($request->user(), 'tasks.view');

        $query = Task::where(function ($q) use ($userId, $accessibleProjectIds) {
                // 1. Personal tasks: must have project_id IS NULL, and user is creator or assignee
                $q->where(function ($personal) use ($userId) {
                    $personal->whereNull('project_id')
                             ->where(function ($p) use ($userId) {
                                 $p->where('user_id', $userId)
                                   ->orWhere('assigned_to', $userId);
                             });
                });

                // 2. Project tasks: user must have active project membership/ownership granting 'tasks.view'
                if (!empty($accessibleProjectIds)) {
                    $q->orWhereIn('project_id', $accessibleProjectIds);
                }
            })
            ->with(['category', 'project', 'goal', 'subtasks', 'tags', 'dependencies', 'dependents', 'assignee']);

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
            $query->where('project_id', (int) $request->project_id);
        }

        // Filter by Goal
        if ($request->filled('goal_id')) {
            $query->where('goal_id', $request->goal_id);
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

        $perPage = min(100, max(1, (int) $request->get('per_page', 50)));
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
    public function store(StoreTaskRequest $request)
    {
        $validated = $request->validated();

        if (!empty($validated['project_id'])) {
            $project = Project::find($validated['project_id']);
            if (!$project || !$this->permissionService->userHasProjectPermission($request->user(), $project, 'tasks.create')) {
                abort(403, 'Unauthorized to create tasks in this project.');
            }
            if (!empty($validated['assigned_to'])) {
                if (!$this->permissionService->userHasProjectPermission($request->user(), $project, 'tasks.assign')) {
                    abort(403, 'Unauthorized to assign tasks in this project.');
                }
                $isAssigneeInProject = ProjectMember::where('project_id', $project->id)
                    ->where('user_id', $validated['assigned_to'])
                    ->exists() || $project->user_id === (int) $validated['assigned_to'];
                if (!$isAssigneeInProject) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Pengguna yang ditugaskan bukan merupakan anggota proyek ini.',
                    ], 422);
                }
            }
        }

        // Validate task dependencies belong to same project or personal context
        if (!empty($validated['dependencies'])) {
            $projectId = $validated['project_id'] ?? null;
            $invalidDeps = Task::whereIn('id', $validated['dependencies'])
                ->where(function ($dq) use ($projectId, $request) {
                    if ($projectId) {
                        $dq->where('project_id', '!=', $projectId)->orWhereNull('project_id');
                    } else {
                        $dq->where('user_id', '!=', $request->user()->id)->orWhereNotNull('project_id');
                    }
                })->exists();

            if ($invalidDeps) {
                return response()->json([
                    'success' => false,
                    'message' => 'Dependensi prasyarat harus berada dalam konteks proyek atau tugas personal yang sama.',
                ], 422);
            }
        }

        // Validate completion conditions upon task creation
        if (($validated['status'] ?? 'todo') === 'completed') {
            if (!empty($validated['requires_report'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tugas ini memerlukan laporan yang telah disetujui (approved report) sebelum dapat diselesaikan.',
                ], 422);
            }
            if (!empty($validated['dependencies'])) {
                $hasIncomplete = Task::whereIn('id', $validated['dependencies'])->where('status', '!=', 'completed')->exists();
                if ($hasIncomplete) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Tugas tidak dapat diselesaikan karena ada dependensi prasyarat yang belum selesai.',
                    ], 422);
                }
            }
        }

        $task = DB::transaction(function () use ($request, $validated) {
            $task = Task::create([
                'user_id' => $request->user()->id,
                'assigned_to' => $validated['assigned_to'] ?? null,
                'project_id' => $validated['project_id'] ?? null,
                'category_id' => $validated['category_id'] ?? null,
                'goal_id' => $validated['goal_id'] ?? null,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'status' => $validated['status'] ?? 'todo',
                'priority' => $validated['priority'] ?? 'medium',
                'due_date' => $validated['due_date'] ?? null,
                'start_date' => $validated['start_date'] ?? null,
                'reminder_at' => $validated['reminder_at'] ?? null,
                'requires_report' => $validated['requires_report'] ?? false,
                'requires_review' => $validated['requires_review'] ?? false,
                'completion_conditions' => $validated['completion_conditions'] ?? null,
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

            // Dependencies
            if (!empty($validated['dependencies'])) {
                $task->dependencies()->sync($validated['dependencies']);
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
                $task->project?->updateProgress();
            }

            // Recalculate goal progress if associated
            if ($task->goal_id) {
                $task->goal?->recalculateProgress();
            }

            // Audit Log
            AuditLog::create([
                'user_id' => $request->user()->id,
                'actor_id' => $request->user()->id,
                'project_id' => $task->project_id,
                'action' => 'task.created',
                'auditable_type' => Task::class,
                'auditable_id' => (string) $task->id,
                'resource_type' => 'Task',
                'resource_id' => (string) $task->id,
                'context_type' => $task->project_id ? 'project' : 'workspace',
                'context_id' => $task->project_id,
                'payload' => ['title' => $task->title, 'priority' => $task->priority],
                'created_at' => now(),
            ]);

            return $task;
        });

        // Notify assignee (outside transaction)
        if (!empty($validated['assigned_to']) && $validated['assigned_to'] !== $request->user()->id) {
            $assignee = \App\Models\User::find($validated['assigned_to']);
            if ($assignee) {
                try {
                    app(\App\Services\NotificationService::class)->notifyTaskAssigned(
                        $assignee, $request->user(), $task
                    );
                } catch (\Throwable $e) {
                    // Non-critical — log but don't fail
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Task created successfully',
            'data' => $task->load(['category', 'project', 'goal', 'subtasks', 'tags', 'dependencies', 'dependents']),
        ], 201);
    }

    /**
     * Display a specific task.
     */
    public function show(Request $request, Task $task)
    {
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.view')) {
            abort(403, 'Unauthorized.');
        }

        return response()->json([
            'success' => true,
            'data' => $task->load(['category', 'project', 'goal', 'subtasks', 'tags', 'dependencies', 'dependents', 'assignee']),
        ]);
    }

    /**
     * Update an existing task.
     */
    public function update(Request $request, Task $task)
    {
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.update')) {
            abort(403, 'Unauthorized.');
        }

        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:todo,in_progress,in_review,completed,cancelled',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'assigned_to' => 'nullable|exists:users,id',
            'project_id' => [
                'nullable',
                Rule::exists('projects', 'id')->where(function ($query) use ($userId) {
                    $query->where(function ($sub) use ($userId) {
                        $sub->where('user_id', $userId)
                            ->orWhereExists(function ($memberQuery) use ($userId) {
                                $memberQuery->select(DB::raw(1))
                                    ->from('project_members')
                                    ->whereColumn('project_members.project_id', 'projects.id')
                                    ->where('project_members.user_id', $userId);
                            });
                    });
                }),
            ],
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
            'goal_id' => [
                'nullable',
                Rule::exists('goals', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date|after_or_equal:start_date',
            'reminder_at' => 'nullable|date',
            'requires_report' => 'nullable|boolean',
            'requires_review' => 'nullable|boolean',
            'completion_conditions' => 'nullable|array',
            'is_recurring' => 'nullable|boolean',
            'recurrence_pattern' => 'nullable|in:daily,weekly,monthly',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
            'dependencies' => 'nullable|array',
            'dependencies.*' => [
                'integer',
                Rule::exists('tasks', 'id')->where(fn ($query) => $query->where('user_id', $userId)),
            ],
        ]);

        if (array_key_exists('assigned_to', $validated) && $task->project_id) {
            $project = $task->project ?? Project::find($task->project_id);
            if ($project && !$this->permissionService->userHasProjectPermission($request->user(), $project, 'tasks.assign')) {
                abort(403, 'Unauthorized to assign tasks in this project.');
            }
            if (!empty($validated['assigned_to']) && $project) {
                $isAssigneeInProject = ProjectMember::where('project_id', $project->id)
                    ->where('user_id', $validated['assigned_to'])
                    ->exists() || $project->user_id === (int) $validated['assigned_to'];
                if (!$isAssigneeInProject) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Pengguna yang ditugaskan bukan merupakan anggota proyek ini.',
                    ], 422);
                }
            }
        }

        // Enforce completion authorization and conditions
        if (isset($validated['status']) && $validated['status'] === 'completed' && $task->status !== 'completed') {
            if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.complete')) {
                abort(403, 'Unauthorized to mark this task as completed.');
            }
            if (isset($validated['requires_report'])) {
                $task->requires_report = (bool) $validated['requires_report'];
            }
            $canComplete = $task->canBeCompleted();
            if (!$canComplete['allowed']) {
                return response()->json([
                    'success' => false,
                    'message' => $canComplete['reason'],
                ], 422);
            }
        }

        DB::transaction(function () use ($request, $task, $validated) {
            $oldProjectId = $task->project_id;
            $oldGoalId = $task->goal_id;

            if (isset($validated['status'])) {
                if ($validated['status'] === 'completed' && $task->status !== 'completed') {
                    $validated['completed_at'] = Carbon::now();
                    $this->spawnNextRecurrence($task);
                } elseif ($validated['status'] !== 'completed') {
                    $validated['completed_at'] = null;
                }
            }

            if (isset($validated['dependencies'])) {
                $task->dependencies()->sync($validated['dependencies']);
                unset($validated['dependencies']);
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

            // Update project progress
            if ($task->project_id) {
                $task->project?->updateProgress();
            }
            if ($oldProjectId && $oldProjectId !== $task->project_id) {
                Project::find($oldProjectId)?->updateProgress();
            }

            // Update goal progress
            if ($task->goal_id) {
                $task->goal?->recalculateProgress();
            }
            if ($oldGoalId && $oldGoalId !== $task->goal_id) {
                Goal::find($oldGoalId)?->recalculateProgress();
            }

            // Audit Log
            $action = isset($validated['status']) && $validated['status'] === 'completed'
                ? 'task.completed'
                : (isset($validated['assigned_to']) ? 'task.assigned' : 'task.updated');

            AuditLog::create([
                'user_id' => $request->user()->id,
                'actor_id' => $request->user()->id,
                'project_id' => $task->project_id,
                'action' => $action,
                'auditable_type' => Task::class,
                'auditable_id' => (string) $task->id,
                'resource_type' => 'Task',
                'resource_id' => (string) $task->id,
                'context_type' => $task->project_id ? 'project' : 'workspace',
                'context_id' => $task->project_id,
                'new_values' => $validated,
                'payload' => ['title' => $task->title, 'status' => $task->status],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Task updated successfully',
            'data' => $task->load(['category', 'project', 'goal', 'subtasks', 'tags', 'dependencies', 'dependents']),
        ]);
    }

    /**
     * Toggle task status between todo/in_progress and completed.
     */
    public function toggleStatus(Request $request, Task $task)
    {
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.complete')) {
            abort(403, 'Unauthorized.');
        }

        $newStatus = $task->status === 'completed' ? 'todo' : 'completed';

        // Enforce completion rules when completing
        if ($newStatus === 'completed') {
            $canComplete = $task->canBeCompleted();
            if (!$canComplete['allowed']) {
                return response()->json([
                    'success' => false,
                    'message' => $canComplete['reason'],
                ], 422);
            }
        }

        DB::transaction(function () use ($task, $newStatus) {
            $completedAt = $newStatus === 'completed' ? Carbon::now() : null;

            $task->update([
                'status' => $newStatus,
                'completed_at' => $completedAt,
            ]);

            if ($newStatus === 'completed' && $task->is_recurring) {
                $this->spawnNextRecurrence($task);
            }

            if ($task->project_id) {
                $task->project?->updateProgress();
            }

            // Audit Log
            AuditLog::create([
                'user_id' => auth()->id() ?? $task->user_id,
                'actor_id' => auth()->id() ?? $task->user_id,
                'project_id' => $task->project_id,
                'action' => $newStatus === 'completed' ? 'task.completed' : 'task.updated',
                'auditable_type' => Task::class,
                'auditable_id' => (string) $task->id,
                'resource_type' => 'Task',
                'resource_id' => (string) $task->id,
                'context_type' => $task->project_id ? 'project' : 'workspace',
                'context_id' => $task->project_id,
                'new_values' => ['status' => $newStatus],
                'payload' => ['title' => $task->title, 'status' => $newStatus],
                'created_at' => now(),
            ]);

            if ($task->goal_id) {
                $task->goal?->recalculateProgress();
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Task status updated',
            'data' => $task->load(['category', 'project', 'goal', 'subtasks', 'tags', 'dependencies', 'dependents']),
        ]);
    }

    /**
     * Bulk actions for tasks (status, delete, assign_project, assign_category).
     */
    public function bulkAction(Request $request)
    {
        $userId = $request->user()->id;

        $validated = $request->validate([
            'action' => 'required|in:status,delete,assign_project,assign_category',
            'task_ids' => 'required|array|min:1',
            'task_ids.*' => 'integer|exists:tasks,id',
            'status' => 'nullable|in:todo,in_progress,completed,cancelled',
            'project_id' => [
                'nullable',
                Rule::exists('projects', 'id')->where(function ($query) use ($userId) {
                    $query->where(function ($sub) use ($userId) {
                        $sub->where('user_id', $userId)
                            ->orWhereExists(function ($memberQuery) use ($userId) {
                                $memberQuery->select(DB::raw(1))
                                    ->from('project_members')
                                    ->whereColumn('project_members.project_id', 'projects.id')
                                    ->where('project_members.user_id', $userId);
                            });
                    });
                }),
            ],
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
        ]);

        $taskIds = array_values(array_unique($validated['task_ids']));
        $tasks = Task::whereIn('id', $taskIds)->get();

        if ($tasks->count() !== count($taskIds)) {
            return response()->json([
                'success' => false,
                'message' => 'Satu atau lebih tugas tidak ditemukan.',
            ], 404);
        }

        // Authorize each task strictly according to RBAC and context
        $requiredPerm = match ($validated['action']) {
            'delete' => 'tasks.delete',
            'status' => 'tasks.complete',
            default => 'tasks.update',
        };

        foreach ($tasks as $t) {
            if (!$this->permissionService->userHasTaskPermission($request->user(), $t, $requiredPerm)) {
                abort(403, "Anda tidak memiliki izin '{$requiredPerm}' pada tugas #{$t->id}.");
            }
        }

        // Target project authorization for assign_project
        if ($validated['action'] === 'assign_project' && !empty($validated['project_id'])) {
            $targetProject = Project::find($validated['project_id']);
            if (!$targetProject || !$this->permissionService->userHasProjectPermission($request->user(), $targetProject, 'tasks.create')) {
                abort(403, 'Unauthorized to assign tasks into this target project.');
            }
        }

        $affectedCount = 0;

        DB::transaction(function () use ($userId, $validated, $tasks, $taskIds, &$affectedCount) {
            if ($validated['action'] === 'delete') {
                $projectIds = $tasks->pluck('project_id')->filter()->unique();
                $goalIds = $tasks->pluck('goal_id')->filter()->unique();

                $affectedCount = Task::whereIn('id', $taskIds)->delete();

                foreach ($projectIds as $pId) {
                    Project::find($pId)?->updateProgress();
                }
                foreach ($goalIds as $gId) {
                    Goal::find($gId)?->recalculateProgress();
                }
            } elseif ($validated['action'] === 'status') {
                $newStatus = $validated['status'] ?? 'completed';
                $completedAt = $newStatus === 'completed' ? Carbon::now() : null;

                foreach ($tasks as $task) {
                    if ($newStatus === 'completed') {
                        $canComplete = $task->canBeCompleted();
                        if (!$canComplete['allowed']) {
                            continue; // Skip tasks that have blocking dependencies or require approved report
                        }
                    }
                    $task->update([
                        'status' => $newStatus,
                        'completed_at' => $completedAt,
                    ]);
                    $affectedCount++;
                }

                $projectIds = $tasks->pluck('project_id')->filter()->unique();
                $goalIds = $tasks->pluck('goal_id')->filter()->unique();

                foreach ($projectIds as $pId) {
                    Project::find($pId)?->updateProgress();
                }
                foreach ($goalIds as $gId) {
                    Goal::find($gId)?->recalculateProgress();
                }
            } elseif ($validated['action'] === 'assign_project') {
                $newProjectId = $validated['project_id'] ?? null;
                $oldProjectIds = $tasks->pluck('project_id')->filter()->unique();

                $affectedCount = Task::whereIn('id', $taskIds)->update(['project_id' => $newProjectId]);

                if ($newProjectId) {
                    Project::find($newProjectId)?->updateProgress();
                }
                foreach ($oldProjectIds as $pId) {
                    Project::find($pId)?->updateProgress();
                }
            } elseif ($validated['action'] === 'assign_category') {
                $newCatId = $validated['category_id'] ?? null;
                $affectedCount = Task::whereIn('id', $taskIds)->update(['category_id' => $newCatId]);
            }

            // Write audit log
            AuditLog::create([
                'user_id' => $userId,
                'action' => 'tasks.bulk_' . $validated['action'],
                'auditable_type' => Task::class,
                'auditable_id' => 'bulk',
                'payload' => [
                    'action' => $validated['action'],
                    'count' => $affectedCount,
                    'task_ids' => $taskIds,
                ],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => "Operasi bulk '{$validated['action']}' berhasil diproses untuk {$affectedCount} tugas.",
            'affected_count' => $affectedCount,
        ]);
    }

    /**
     * Delete a task.
     */
    public function destroy(Request $request, Task $task)
    {
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.delete')) {
            abort(403, 'Unauthorized.');
        }

        DB::transaction(function () use ($task) {
            $projectId = $task->project_id;
            $goalId = $task->goal_id;

            $task->delete();

            if ($projectId) {
                Project::find($projectId)?->updateProgress();
            }
            if ($goalId) {
                Goal::find($goalId)?->recalculateProgress();
            }
        });

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
            'goal_id' => $task->goal_id,
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
        if (!$this->permissionService->userHasTaskPermission($request->user(), $task, 'tasks.update')) {
            abort(403, 'Unauthorized.');
        }
    }
}
