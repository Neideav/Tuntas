<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Goal;
use App\Models\GoalMilestone;
use App\Services\GoalService;
use Illuminate\Http\Request;

class GoalController extends Controller
{
    protected GoalService $goalService;

    public function __construct(GoalService $goalService)
    {
        $this->goalService = $goalService;
    }

    public function index(Request $request)
    {
        $query = Goal::where('user_id', $request->user()->id)
            ->with(['milestones', 'category']);

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
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
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'start_date' => 'required|date',
            'target_date' => 'required|date|after_or_equal:start_date',
            'status' => 'nullable|in:not_started,in_progress,achieved,abandoned',
        ]);

        $goal = Goal::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'status' => $validated['status'] ?? 'not_started',
            'progress' => 0,
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Goal created successfully',
            'data' => $goal->load('milestones'),
        ], 201);
    }

    public function show(Request $request, Goal $goal)
    {
        if ($goal->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $goal->load(['milestones', 'category']);

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

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'category_id' => 'nullable|exists:categories,id',
            'start_date' => 'sometimes|date',
            'target_date' => 'sometimes|date',
            'status' => 'sometimes|in:not_started,in_progress,achieved,abandoned',
        ]);

        $goal->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Goal updated successfully',
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

