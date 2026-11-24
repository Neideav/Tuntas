<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Goal;
use App\Models\GoalMilestone;
use App\Services\GoalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GoalController extends Controller
{
    protected GoalService $goalService;

    public function __construct(GoalService $goalService)
    {
        $this->goalService = $goalService;
    }

    public function index(Request $request)
    {
        $userId = $request->user()->id;
        $query = Goal::where('user_id', $userId)
            ->with(['milestones', 'category', 'tasks', 'projects'])
            ->withCount([
                'milestones',
                'milestones as completed_milestones_count' => function ($q) {
                    $q->where('is_completed', true);
                },
                'tasks',
                'tasks as completed_tasks_count' => function ($q) {
                    $q->where('status', 'completed');
                },
            ]);

        if ($request->has('archived')) {
            $query->where('is_archived', $request->boolean('archived'));
        } else {
            $query->where('is_archived', false);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        $goals = $query->orderBy('target_date', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $goals,
        ]);
    }

    public function store(Request $request)
    {
        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'type' => 'nullable|in:standard,okr',
            'description' => 'nullable|string',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'confidence_level' => 'nullable|in:low,medium,high',
            'start_date' => 'required|date',
            'target_date' => 'required|date|after_or_equal:start_date',
            'status' => 'nullable|in:not_started,in_progress,achieved,abandoned',
            'key_results' => 'nullable|array',
            'key_results.*.title' => 'required|string|max:255',
            'key_results.*.target_value' => 'required|numeric|min:0.01',
            'key_results.*.current_value' => 'nullable|numeric|min:0',
            'key_results.*.unit' => 'nullable|string|max:50',
            'key_results.*.weight' => 'nullable|numeric|min:0.1|max:10',
        ]);

        $goal = DB::transaction(function () use ($userId, $validated) {
            $goal = Goal::create([
                'user_id' => $userId,
                'title' => $validated['title'],
                'type' => $validated['type'] ?? 'standard',
                'description' => $validated['description'] ?? null,
                'category_id' => $validated['category_id'] ?? null,
                'confidence_level' => $validated['confidence_level'] ?? 'medium',
                'start_date' => $validated['start_date'],
                'target_date' => $validated['target_date'],
                'status' => $validated['status'] ?? 'not_started',
                'progress' => 0,
                'is_archived' => false,
            ]);

            if (!empty($validated['key_results'])) {
                foreach ($validated['key_results'] as $index => $kr) {
                    $this->goalService->addMilestone($goal, [
                        'title' => $kr['title'],
                        'target_value' => $kr['target_value'],
                        'current_value' => $kr['current_value'] ?? 0,
                        'unit' => $kr['unit'] ?? '%',
                        'weight' => $kr['weight'] ?? 1.0,
                        'order' => $index,
                    ]);
                }
            }

            return $goal;
        });

        return response()->json([
            'success' => true,
            'message' => 'Goal created successfully',
            'data' => $goal->fresh(['milestones', 'category']),
        ], 201);
    }

    public function show(Request $request, Goal $goal)
    {
        if ($goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $goal->load(['milestones', 'category', 'tasks', 'projects']);

        return response()->json([
            'success' => true,
            'data' => $goal,
        ]);
    }

    public function update(Request $request, Goal $goal)
    {
        if ($goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $userId = $request->user()->id;

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'type' => 'nullable|in:standard,okr',
            'description' => 'nullable|string',
            'category_id' => [
                'nullable',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('user_id', $userId)),
            ],
            'confidence_level' => 'nullable|in:low,medium,high',
            'is_archived' => 'nullable|boolean',
            'start_date' => 'sometimes|date',
            'target_date' => 'sometimes|date|after_or_equal:start_date',
            'status' => 'sometimes|in:not_started,in_progress,achieved,abandoned',
        ]);

        $goal->update($validated);
        $goal->recalculateProgress();

        return response()->json([
            'success' => true,
            'message' => 'Goal updated successfully',
            'data' => $goal->fresh(['milestones', 'category', 'tasks', 'projects']),
        ]);
    }

    public function toggleArchive(Request $request, Goal $goal)
    {
        if ($goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $goal->update([
            'is_archived' => !$goal->is_archived,
        ]);

        return response()->json([
            'success' => true,
            'message' => $goal->is_archived ? 'Goal archived successfully' : 'Goal restored successfully',
            'data' => $goal->fresh(['milestones', 'category']),
        ]);
    }

    public function destroy(Request $request, Goal $goal)
    {
        if ($goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $goal->delete();

        return response()->json([
            'success' => true,
            'message' => 'Goal deleted successfully',
        ]);
    }

    public function addMilestone(Request $request, Goal $goal)
    {
        if ($goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'target_value' => 'required|numeric|min:0.01',
            'current_value' => 'nullable|numeric|min:0',
            'unit' => 'nullable|string|max:50',
            'weight' => 'nullable|numeric|min:0.1|max:10',
            'due_date' => 'nullable|date',
        ]);

        $milestone = $this->goalService->addMilestone($goal, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Milestone added successfully',
            'data' => [
                'milestone' => $milestone,
                'goal_progress' => $goal->fresh()->progress,
            ],
        ], 201);
    }

    public function updateMilestone(Request $request, GoalMilestone $milestone)
    {
        if ($milestone->goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'current_value' => 'sometimes|numeric|min:0',
            'target_value' => 'sometimes|numeric|min:0.01',
            'unit' => 'nullable|string|max:50',
            'weight' => 'nullable|numeric|min:0.1|max:10',
            'is_completed' => 'nullable|boolean',
            'due_date' => 'nullable|date',
        ]);

        $updated = $this->goalService->updateMilestone($milestone, $validated);

        return response()->json([
            'success' => true,
            'message' => 'Milestone updated successfully',
            'data' => [
                'milestone' => $updated,
                'goal_progress' => $milestone->goal->fresh()->progress,
            ],
        ]);
    }

    public function deleteMilestone(Request $request, GoalMilestone $milestone)
    {
        if ($milestone->goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $goal = $milestone->goal;
        $this->goalService->deleteMilestone($milestone);

        return response()->json([
            'success' => true,
            'message' => 'Milestone deleted successfully',
            'data' => [
                'goal_progress' => $goal->fresh()->progress,
            ],
        ]);
    }
}
