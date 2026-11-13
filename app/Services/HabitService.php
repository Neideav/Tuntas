<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Habit;
use App\Models\HabitLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class HabitService
{
    /**
     * Toggle completion for a specific date (default today).
     */
    public function toggleCompletion(Habit $habit, ?string $date = null, ?string $notes = null): array
    {
        $targetDate = $date ? Carbon::parse($date)->toDateString() : Carbon::today()->toDateString();

        return DB::transaction(function () use ($habit, $targetDate, $notes) {
            $log = HabitLog::where('habit_id', $habit->id)
                ->whereDate('log_date', $targetDate)
                ->first();

            if ($log && $log->is_completed) {
                // Was completed, un-complete it
                $log->update([
                    'is_completed' => false,
                    'value' => 0,
                    'notes' => $notes ?? $log->notes,
                ]);
            } elseif ($log) {
                $log->update([
                    'is_completed' => true,
                    'value' => $habit->target_count,
                    'notes' => $notes ?? $log->notes,
                ]);
            } else {
                $log = HabitLog::updateOrCreate(
                    [
                        'habit_id' => $habit->id,
                        'log_date' => $targetDate,
                    ],
                    [
                        'user_id' => $habit->user_id,
                        'value' => $habit->target_count,
                        'is_completed' => true,
                        'used_freeze' => false,
                        'notes' => $notes,
                    ]
                );
            }

            // Recalculate streak
            $streak = $this->calculateStreak($habit);
            $bestStreak = max($streak, $habit->best_streak);

            $habit->update([
                'current_streak' => $streak,
                'best_streak' => $bestStreak,
            ]);

            // Audit
            AuditLog::create([
                'user_id' => $habit->user_id,
                'action' => 'habit.toggle',
                'auditable_type' => Habit::class,
                'auditable_id' => (string) $habit->id,
                'payload' => [
                    'date' => $targetDate,
                    'is_completed' => $log->is_completed,
                    'current_streak' => $streak,
                ],
                'created_at' => now(),
            ]);

            return [
                'habit' => $habit->fresh(),
                'log' => $log,
            ];
        });
    }

    /**
     * Calculate current active streak backwards from today.
     */
    public function calculateStreak(Habit $habit): int
    {
        $logs = HabitLog::where('habit_id', $habit->id)
            ->where('is_completed', true)
            ->orderBy('log_date', 'desc')
            ->pluck('log_date')
            ->map(fn($d) => Carbon::parse($d)->toDateString())
            ->flip()
            ->all();

        $today = Carbon::today();
        $todayStr = $today->toDateString();
        $yesterdayStr = $today->copy()->subDay()->toDateString();

        // If today is completed, streak starts from today.
        // If today is not completed yet, streak might be active from yesterday.
        if (isset($logs[$todayStr])) {
            $cursor = $today;
        } elseif (isset($logs[$yesterdayStr])) {
            $cursor = $today->copy()->subDay();
        } else {
            return 0;
        }

        $streak = 0;
        while (true) {
            $dateStr = $cursor->toDateString();
            if (isset($logs[$dateStr])) {
                $streak++;
                $cursor->subDay();
            } else {
                // Check if freeze token was used for this date
                $freezeLog = HabitLog::where('habit_id', $habit->id)
                    ->whereDate('log_date', $dateStr)
                    ->where('used_freeze', true)
                    ->exists();

                if ($freezeLog) {
                    $streak++;
                    $cursor->subDay();
                } else {
                    break;
                }
            }
        }

        return $streak;
    }

    /**
     * Apply a streak freeze token to a missed date.
     */
    public function useFreezeToken(Habit $habit, string $date): HabitLog
    {
        if ($habit->freeze_tokens <= 0) {
            throw new \RuntimeException('No freeze tokens available for this habit.');
        }

        return DB::transaction(function () use ($habit, $date) {
            $habit->decrement('freeze_tokens');

            $log = HabitLog::updateOrCreate(
                ['habit_id' => $habit->id, 'log_date' => $date],
                [
                    'user_id' => $habit->user_id,
                    'value' => 0,
                    'is_completed' => false,
                    'used_freeze' => true,
                    'notes' => 'Streak Freeze Token Applied',
                ]
            );

            $streak = $this->calculateStreak($habit);
            $habit->update([
                'current_streak' => $streak,
                'best_streak' => max($streak, $habit->best_streak),
            ]);

            return $log;
        });
    }
}

