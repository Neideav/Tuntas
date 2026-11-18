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
     * Calculate current active streak according to habit frequency (daily, weekdays, weekly).
     */
    public function calculateStreak(Habit $habit): int
    {
        $frequency = $habit->frequency ?? 'daily';

        if ($frequency === 'weekdays') {
            return $this->calculateWeekdaysStreak($habit);
        }

        if ($frequency === 'weekly') {
            return $this->calculateWeeklyStreak($habit);
        }

        return $this->calculateDailyStreak($habit);
    }

    /**
     * Streak calculation for daily frequency.
     */
    protected function calculateDailyStreak(Habit $habit): int
    {
        $logs = HabitLog::where('habit_id', $habit->id)
            ->where(function ($q) {
                $q->where('is_completed', true)->orWhere('used_freeze', true);
            })
            ->pluck('log_date')
            ->map(fn($d) => Carbon::parse($d)->toDateString())
            ->flip()
            ->all();

        $today = Carbon::today();
        $todayStr = $today->toDateString();
        $yesterdayStr = $today->copy()->subDay()->toDateString();

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
                break;
            }
        }

        return $streak;
    }

    /**
     * Streak calculation for weekdays frequency (Monday-Friday only).
     */
    protected function calculateWeekdaysStreak(Habit $habit): int
    {
        $logs = HabitLog::where('habit_id', $habit->id)
            ->where(function ($q) {
                $q->where('is_completed', true)->orWhere('used_freeze', true);
            })
            ->pluck('log_date')
            ->map(fn($d) => Carbon::parse($d)->toDateString())
            ->flip()
            ->all();

        $today = Carbon::today();

        if ($today->isWeekday()) {
            $todayStr = $today->toDateString();
            if (isset($logs[$todayStr])) {
                $cursor = $today->copy();
            } else {
                // If today is not completed yet, check the most recent preceding weekday
                $prevWeekday = $today->copy()->subDay();
                while ($prevWeekday->isWeekend()) {
                    $prevWeekday->subDay();
                }
                if (isset($logs[$prevWeekday->toDateString()])) {
                    $cursor = $prevWeekday;
                } else {
                    return 0;
                }
            }
        } else {
            // Today is weekend (Saturday or Sunday) — weekend is not required.
            // Check the last Friday.
            $lastFriday = $today->copy();
            while ($lastFriday->isWeekend()) {
                $lastFriday->subDay();
            }
            if (isset($logs[$lastFriday->toDateString()])) {
                $cursor = $lastFriday;
            } else {
                return 0;
            }
        }

        $streak = 0;
        while (true) {
            $dateStr = $cursor->toDateString();
            if (isset($logs[$dateStr])) {
                $streak++;
                // Move cursor to previous weekday
                $cursor->subDay();
                while ($cursor->isWeekend()) {
                    $cursor->subDay();
                }
            } else {
                break;
            }
        }

        return $streak;
    }

    /**
     * Streak calculation for weekly frequency (at least once per ISO calendar week).
     */
    protected function calculateWeeklyStreak(Habit $habit): int
    {
        $rawLogs = HabitLog::where('habit_id', $habit->id)
            ->where(function ($q) {
                $q->where('is_completed', true)->orWhere('used_freeze', true);
            })
            ->pluck('log_date');

        if ($rawLogs->isEmpty()) {
            return 0;
        }

        $completedWeeks = [];
        foreach ($rawLogs as $logDate) {
            $weekKey = Carbon::parse($logDate)->format('o-W');
            $completedWeeks[$weekKey] = true;
        }

        $today = Carbon::today();
        $thisWeekKey = $today->format('o-W');
        $lastWeek = $today->copy()->subWeek();
        $lastWeekKey = $lastWeek->format('o-W');

        if (isset($completedWeeks[$thisWeekKey])) {
            $cursorWeek = $today->copy();
        } elseif (isset($completedWeeks[$lastWeekKey])) {
            $cursorWeek = $lastWeek->copy();
        } else {
            return 0;
        }

        $streak = 0;
        while (true) {
            $key = $cursorWeek->format('o-W');
            if (isset($completedWeeks[$key])) {
                $streak++;
                $cursorWeek->subWeek();
            } else {
                break;
            }
        }

        return $streak;
    }

    /**
     * Apply a streak freeze token to a missed date.
     */
    public function useFreezeToken(Habit $habit, string $date): HabitLog
    {
        try {
            $parsedDate = Carbon::parse($date)->startOfDay();
        } catch (\Exception $e) {
            throw new \InvalidArgumentException('Format tanggal tidak valid.');
        }

        $today = Carbon::today();
        if ($parsedDate->greaterThan($today)) {
            throw new \InvalidArgumentException('Token pembeku (freeze token) tidak dapat digunakan untuk tanggal di masa depan.');
        }

        $formattedDate = $parsedDate->toDateString();

        return DB::transaction(function () use ($habit, $formattedDate) {
            // Atomically lock the habit row to prevent concurrent race condition exploits
            $lockedHabit = Habit::where('id', $habit->id)->lockForUpdate()->firstOrFail();

            if ($lockedHabit->freeze_tokens <= 0) {
                throw new \RuntimeException('Tidak ada token pembeku (freeze tokens) yang tersedia untuk habit ini.');
            }

            // Check previous log for this date with locking
            $existingLog = HabitLog::where('habit_id', $lockedHabit->id)
                ->where('log_date', $formattedDate)
                ->lockForUpdate()
                ->first();

            if ($existingLog) {
                if ($existingLog->used_freeze) {
                    throw new \RuntimeException('Token pembeku sudah pernah digunakan untuk tanggal ini.');
                }
                if ($existingLog->is_completed) {
                    throw new \RuntimeException('Habit sudah berhasil diselesaikan pada tanggal ini, token pembeku tidak diperlukan.');
                }
            }

            // Decrement freeze token atomically
            $lockedHabit->decrement('freeze_tokens');

            // Apply freeze to habit log
            if ($existingLog) {
                $existingLog->update([
                    'value' => 0,
                    'is_completed' => false,
                    'used_freeze' => true,
                    'notes' => 'Streak Freeze Token Applied',
                ]);
                $log = $existingLog;
            } else {
                $log = HabitLog::create([
                    'habit_id' => $lockedHabit->id,
                    'user_id' => $lockedHabit->user_id,
                    'log_date' => $formattedDate,
                    'value' => 0,
                    'is_completed' => false,
                    'used_freeze' => true,
                    'notes' => 'Streak Freeze Token Applied',
                ]);
            }

            // Recalculate streak
            $streak = $this->calculateStreak($lockedHabit);
            $lockedHabit->update([
                'current_streak' => $streak,
                'best_streak' => max($streak, $lockedHabit->best_streak),
            ]);

            $habit->refresh();

            return $log;
        });
    }
}

