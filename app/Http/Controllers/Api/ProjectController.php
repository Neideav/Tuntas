<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Project\StoreProjectRequest;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectMilestone;
use App\Models\ProjectRole;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    public function __construct(
        protected PermissionService $permissionService
    ) {}

    /**
     * List user projects with milestones, tasks count, and summary statistics.
     * Includes projects owned by the user or where the user is an active member.
     */
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $query = Project::where(function ($q) use ($userId) {
                $q->where('user_id', $userId)
                  ->orWhereHas('members', function ($mq) use ($userId) {
                      $mq->where('user_id', $userId);
                  });
            })
            ->with(['category', 'goal', 'milestones'])
            ->withCount([
                'tasks',
                'tasks as completed_tasks_count' => function ($q) {
                    $q->where('status', 'completed');
                },
                'milestones',
                'milestones as completed_milestones_count' => function ($q) {
                    $q->where('is_completed', true);
                },
                'members',
            ]);

        // Filter by archive state (default active only)
        if ($request->has('archived')) {
            $query->where('is_archived', $request->boolean('archived'));
        } else {
            $query->where('is_archived', false);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('health') && $request->health !== 'all') {
            $query->where('health', $request->health);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('goal_id')) {
            $query->where('goal_id', $request->goal_id);
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            });
        }

        $projects = $query->latest()->get();

        // Summary statistics for dashboard/overview
        $allProjects = Project::where(function ($q) use ($userId) {
            $q->where('user_id', $userId)
              ->orWhereHas('members', function ($mq) use ($userId) {
                  $mq->where('user_id', $userId);
              });
        })->get();

        $summary = [
            'total' => $allProjects->where('is_archived', false)->count(),
            'completed' => $allProjects->where('is_archived', false)->where('status', 'completed')->count(),
            'in_progress' => $allProjects->where('is_archived', false)->where('status', 'in_progress')->count(),
            'on_track' => $allProjects->where('is_archived', false)->where('health', 'on_track')->count(),
            'at_risk' => $allProjects->where('is_archived', false)->where('health', 'at_risk')->count(),
            'off_track' => $allProjects->where('is_archived', false)->where('health', 'off_track')->count(),
            'archived' => $allProjects->where('is_archived', true)->count(),
        ];

        return response()->json([
            'success' => true,
            'data' => $projects,
            'summary' => $summary,
        ]);
    }

    /**
     * Create a new project.
     */
    public function store(StoreProjectRequest $request)
    {
        $userId = $request->user()->id;
        $validated = $request->validated();

        $project = DB::transaction(function () use ($userId, $validated) {
            $project = Project::create([
                'user_id' => $userId,
                'category_id' => $validated['category_id'] ?? null,
                'goal_id' => $validated['goal_id'] ?? null,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'status' => $validated['status'] ?? 'planning',
                'priority' => $validated['priority'] ?? 'medium',
                'health' => $validated['health'] ?? 'on_track',
                'progress' => 0,
                'start_date' => $validated['start_date'] ?? null,
                'deadline' => $validated['deadline'] ?? null,
            ]);

            // Create initial milestones if supplied
            if (!empty($validated['milestones'])) {
                foreach ($validated['milestones'] as $index => $m) {
                    $project->milestones()->create([
                        'title' => $m['title'],
                        'due_date' => $m['due_date'] ?? null,
                        'order' => $index,
                        'is_completed' => false,
                    ]);
                }
            }

            if ($project->goal_id) {
                $project->goal?->recalculateProgress();
            }

            // Ensure built-in roles and attach creator as project owner in project_members
            $roles = ProjectRole::ensureBuiltinRolesForProject($project);
            $ownerRole = $roles[ProjectRole::ROLE_OWNER] ?? null;

            ProjectMember::firstOrCreate(
                [
                    'project_id' => $project->id,
                    'user_id' => $userId,
                ],
                [
                    'role_id' => $ownerRole?->id,
                    'role' => ProjectRole::ROLE_OWNER,
                    'joined_at' => now(),
                ]
            );

            AuditLog::create([
                'user_id' => $userId,
                'project_id' => $project->id,
                'action' => 'project.created',
                'auditable_type' => Project::class,
                'auditable_id' => (string) $project->id,
                'payload' => ['title' => $project->title],
                'created_at' => now(),
            ]);

            return $project;
        });

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dibuat',
            'data' => $project->load(['category', 'goal', 'milestones']),
        ], 201);
    }

    /**
     * Show a project with its tasks, milestones, and goal.
     */
    public function show(Request $request, Project $project)
    {
        $this->authorizePermission($request, $project, 'project.view');

        return response()->json([
            'success' => true,
            'data' => $project->load(['category', 'goal', 'milestones', 'tasks.subtasks', 'tasks.dependencies', 'members.user']),
        ]);
    }

    /**
     * Update an existing project.
     */
    public function update(Request $request, Project $project)
    {
        $this->authorizePermission($request, $project, 'project.update');
        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(function ($q) use ($userId, $project) {
                    $q->where('user_id', $userId)->orWhere('user_id', $project->user_id);
                }),
            ],
            'goal_id' => [
                'nullable',
                Rule::exists('goals', 'id')->where(function ($q) use ($userId, $project) {
                    $q->where('user_id', $userId)->orWhere('user_id', $project->user_id);
                }),
            ],
            'status' => 'nullable|in:planning,in_progress,completed,on_hold',
            'priority' => 'nullable|in:low,medium,high,urgent',
            'health' => 'nullable|in:on_track,at_risk,off_track',
            'is_archived' => 'nullable|boolean',
            'start_date' => 'nullable|date',
            'deadline' => 'nullable|date|after_or_equal:start_date',
        ]);

        DB::transaction(function () use ($project, $validated, $request) {
            $oldGoalId = $project->goal_id;
            $oldValues = $project->only(array_keys($validated));
            $isArchiving = isset($validated['is_archived']) && $validated['is_archived'] && !$project->is_archived;

            $project->update($validated);

            if ($project->goal_id) {
                $project->goal?->recalculateProgress();
            }
            if ($oldGoalId && $oldGoalId !== $project->goal_id) {
                \App\Models\Goal::find($oldGoalId)?->recalculateProgress();
            }

            AuditLog::create([
                'user_id' => $request->user()->id,
                'actor_id' => $request->user()->id,
                'project_id' => $project->id,
                'action' => $isArchiving ? 'project.archived' : 'project.updated',
                'auditable_type' => Project::class,
                'auditable_id' => (string) $project->id,
                'resource_type' => 'Project',
                'resource_id' => (string) $project->id,
                'context_type' => 'project',
                'context_id' => $project->id,
                'old_values' => $oldValues,
                'new_values' => $validated,
                'payload' => ['title' => $project->title, 'is_archived' => $project->is_archived],
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil diperbarui',
            'data' => $project->fresh(['category', 'goal', 'milestones']),
        ]);
    }

    /**
     * Add milestone to a project.
     */
    public function addMilestone(Request $request, Project $project)
    {
        $this->authorizePermission($request, $project, 'project.update');

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $maxOrder = $project->milestones()->max('order') ?? 0;

        $milestone = DB::transaction(function () use ($project, $validated, $maxOrder) {
            $m = $project->milestones()->create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'due_date' => $validated['due_date'] ?? null,
                'order' => $maxOrder + 1,
                'is_completed' => false,
            ]);

            $project->updateProgress();
            return $m;
        });

        return response()->json([
            'success' => true,
            'message' => 'Milestone proyek berhasil ditambahkan',
            'data' => [
                'milestone' => $milestone,
                'project_progress' => $project->fresh()->progress,
            ],
        ], 201);
    }

    /**
     * Toggle completion status of a project milestone.
     */
    public function toggleMilestone(Request $request, Project $project, ProjectMilestone $milestone)
    {
        $this->authorizePermission($request, $project, 'tasks.complete');

        if ($milestone->project_id !== $project->id) {
            abort(404, 'Milestone tidak ditemukan dalam proyek ini.');
        }

        DB::transaction(function () use ($project, $milestone) {
            $milestone->update([
                'is_completed' => !$milestone->is_completed,
            ]);
            $project->updateProgress();
        });

        return response()->json([
            'success' => true,
            'message' => 'Status milestone diperbarui',
            'data' => [
                'milestone' => $milestone->fresh(),
                'project_progress' => $project->fresh()->progress,
            ],
        ]);
    }

    /**
     * Delete a project milestone.
     */
    public function deleteMilestone(Request $request, Project $project, ProjectMilestone $milestone)
    {
        $this->authorizePermission($request, $project, 'project.update');

        if ($milestone->project_id !== $project->id) {
            abort(404, 'Milestone tidak ditemukan dalam proyek ini.');
        }

        DB::transaction(function () use ($project, $milestone) {
            $milestone->delete();
            $project->updateProgress();
        });

        return response()->json([
            'success' => true,
            'message' => 'Milestone berhasil dihapus',
            'data' => [
                'project_progress' => $project->fresh()->progress,
            ],
        ]);
    }

    /**
     * Toggle archive/restore status of project.
     */
    public function toggleArchive(Request $request, Project $project)
    {
        $this->authorizePermission($request, $project, 'project.archive');

        $project->update([
            'is_archived' => !$project->is_archived,
        ]);

        return response()->json([
            'success' => true,
            'message' => $project->is_archived ? 'Proyek berhasil diarsipkan' : 'Proyek berhasil dipulihkan',
            'data' => $project->fresh(['category', 'milestones']),
        ]);
    }

    /**
     * Delete a project. Only the direct creator / owner is allowed to delete.
     */
    public function destroy(Request $request, Project $project)
    {
        // Deleting project is strictly reserved for the project creator/owner
        if ($project->user_id !== $request->user()->id) {
            abort(403, 'Hanya pemilik proyek yang memiliki izin untuk menghapus proyek ini.');
        }

        DB::transaction(function () use ($project) {
            $goalId = $project->goal_id;
            $project->delete();

            if ($goalId) {
                \App\Models\Goal::find($goalId)?->recalculateProgress();
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Proyek berhasil dihapus',
        ]);
    }

    /**
     * Helper to verify user permissions on the project.
     */
    private function authorizePermission(Request $request, Project $project, string $permission): void
    {
        if (!$this->permissionService->userHasProjectPermission($request->user(), $project, $permission)) {
            abort(403, 'Unauthorized.');
        }
    }
}
