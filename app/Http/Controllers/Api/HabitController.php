<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Services\HabitService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class HabitController extends Controller
{
    protected HabitService $habitService;

    public function __construct(HabitService $habitService)
    {
        $this->habitService = $habitService;
    }

    public function index(Request $request)
    {
        $today = Carbon::today()->toDateString();
        $habits = Habit::where('user_id', $request->user()->id)
            ->where('is_archived', $request->boolean('archived', false))
            ->with(['logs' => function ($q) use ($today) {
                $q->whereDate('log_date', $today);
            }])
            ->orderBy('id', 'asc')
            ->get();

        $data = $habits->map(function ($habit) use ($today) {
            $todayLog = $habit->logs->first();
            return array_merge($habit->toArray(), [
                'is_completed_today' => $todayLog ? (bool) $todayLog->is_completed : false,
                'today_log' => $todayLog,
            ]);
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'frequency' => 'required|in:daily,weekdays,weekly',
            'target_count' => 'nullable|integer|min:1',
            'unit' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:50',
            'icon' => 'nullable|string|max:50',
            'freeze_tokens' => 'nullable|integer|min:0',
        ]);

        $habit = Habit::create(array_merge($validated, [
            'user_id' => $request->user()->id,
            'target_count' => $validated['target_count'] ?? 1,
            'color' => $validated['color'] ?? '#10b981',
            'icon' => $validated['icon'] ?? 'check',
            'freeze_tokens' => $validated['freeze_tokens'] ?? 2,
        ]));

        return response()->json([
            'success' => true,
            'message' => 'Habit created successfully',
            'data' => $habit,
        ], 201);
    }

    public function show(Request $request, Habit $habit)
    {
        if ($habit->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $habit->load(['logs' => fn($q) => $q->orderBy('log_date', 'desc')->limit(30)]);

        return response()->json([
            'success' => true,
            'data' => $habit,
        ]);
    }

    public function update(Request $request, Habit $habit)
    {
        if ($habit->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'frequency' => 'sometimes|in:daily,weekdays,weekly',
            'target_count' => 'sometimes|integer|min:1',
            'unit' => 'nullable|string|max:50',
            'color' => 'nullable|string|max:50',
            'icon' => 'nullable|string|max:50',
            'freeze_tokens' => 'nullable|integer|min:0',
            'is_archived' => 'nullable|boolean',
        ]);

        $habit->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Habit updated successfully',
            'data' => $habit,
        ]);
    }

    public function destroy(Request $request, Habit $habit)
    {
        if ($habit->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $habit->delete();

        return response()->json([
            'success' => true,
            'message' => 'Habit deleted successfully',
        ]);
    }

    public function toggle(Request $request, Habit $habit)
    {
        if ($habit->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $date = $request->input('date');
        $notes = $request->input('notes');

        $result = $this->habitService->toggleCompletion($habit, $date, $notes);

        return response()->json([
            'success' => true,
            'message' => 'Habit status updated',
            'data' => $result,
        ]);
    }

    public function useFreeze(Request $request, Habit $habit)
    {
        if ($habit->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $date = $request->validate(['date' => 'required|date'])['date'];

        try {
            $log = $this->habitService->useFreezeToken($habit, $date);
            return response()->json([
                'success' => true,
                'message' => 'Freeze token applied successfully',
                'data' => [
                    'habit' => $habit->fresh(),
                    'log' => $log,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    public function history(Request $request, Habit $habit)
    {
        if ($habit->user_id !== $request->user()->id) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $days = (int) $request->input('days', 60);
        $startDate = Carbon::today()->subDays($days)->toDateString();

        $logs = HabitLog::where('habit_id', $habit->id)
            ->where('log_date', '>=', $startDate)
            ->orderBy('log_date', 'asc')
            ->get();

        $totalCompleted = $logs->where('is_completed', true)->count();
        $rate = $days > 0 ? round(($totalCompleted / $days) * 100, 1) : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'habit' => $habit,
                'logs' => $logs,
                'statistics' => [
                    'current_streak' => $habit->current_streak,
                    'best_streak' => $habit->best_streak,
                    'freeze_tokens' => $habit->freeze_tokens,
                    'total_completions' => $totalCompleted,
                    'consistency_rate' => $rate,
                ],
            ],
        ]);
    }
}

