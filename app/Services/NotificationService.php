<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Examination;
use App\Models\Goal;
use App\Models\Habit;
use App\Models\HabitLog;
use App\Models\Notification;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\UserSetting;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Get consolidated user notification preferences with reliable defaults.
     */
    public function getPreferences(User $user): array
    {
        $settings = UserSetting::firstOrCreate(
            ['user_id' => $user->id],
            [
                'theme' => 'dark',
                'email_notifications' => true,
                'in_app_notifications' => true,
                'daily_digest' => false,
                'timezone' => $user->timezone ?? 'UTC',
            ]
        );

        $prefs = $settings->preferences ?? [];

        return [
            'email_notifications' => (bool) $settings->email_notifications,
            'in_app_notifications' => (bool) $settings->in_app_notifications,
            'daily_digest' => (bool) $settings->daily_digest,
            'timezone' => $settings->timezone ?? 'UTC',
            'task_reminders' => (bool) ($prefs['task_reminders'] ?? true),
            'project_reminders' => (bool) ($prefs['project_reminders'] ?? true),
            'habit_reminders' => (bool) ($prefs['habit_reminders'] ?? true),
            'goal_reminders' => (bool) ($prefs['goal_reminders'] ?? true),
            'learning_reminders' => (bool) ($prefs['learning_reminders'] ?? true),
            'exam_reminders' => (bool) ($prefs['exam_reminders'] ?? true),
            'preferred_reminder_time' => (string) ($prefs['preferred_reminder_time'] ?? '09:00'),
            'quiet_hours_start' => $prefs['quiet_hours_start'] ?? null,
            'quiet_hours_end' => $prefs['quiet_hours_end'] ?? null,
        ];
    }

    /**
     * Update user notification preferences safely.
     */
    public function updatePreferences(User $user, array $validated): array
    {
        $settings = UserSetting::firstOrCreate(['user_id' => $user->id]);

        if (isset($validated['email_notifications'])) {
            $settings->email_notifications = (bool) $validated['email_notifications'];
        }
        if (isset($validated['in_app_notifications'])) {
            $settings->in_app_notifications = (bool) $validated['in_app_notifications'];
        }
        if (isset($validated['daily_digest'])) {
            $settings->daily_digest = (bool) $validated['daily_digest'];
        }
        if (isset($validated['timezone'])) {
            $settings->timezone = $validated['timezone'];
            $user->update(['timezone' => $validated['timezone']]);
        }

        $currentPrefs = $settings->preferences ?? [];
        $prefKeys = [
            'task_reminders',
            'project_reminders',
            'habit_reminders',
            'goal_reminders',
            'learning_reminders',
            'exam_reminders',
            'preferred_reminder_time',
            'quiet_hours_start',
            'quiet_hours_end',
        ];

        foreach ($prefKeys as $k) {
            if (array_key_exists($k, $validated)) {
                $currentPrefs[$k] = $validated[$k];
            }
        }

        $settings->preferences = $currentPrefs;
        $settings->save();

        return $this->getPreferences($user);
    }

    /**
     * Check if current time in user's timezone falls within configured quiet hours.
     */
    public function isQuietHours(array $preferences, Carbon $now): bool
    {
        $qStart = $preferences['quiet_hours_start'] ?? null;
        $qEnd = $preferences['quiet_hours_end'] ?? null;

        if (!$qStart || !$qEnd) {
            return false;
        }

        $currentTime = $now->format('H:i');
        if ($qStart <= $qEnd) {
            return ($currentTime >= $qStart && $currentTime <= $qEnd);
        } else {
            // Over midnight range, e.g. 22:00 to 07:00
            return ($currentTime >= $qStart || $currentTime <= $qEnd);
        }
    }

    /**
     * Scan and generate multi-domain automated reminders with strict deduplication.
     */
    public function generateRemindersForUser(User $user): int
    {
        $prefs = $this->getPreferences($user);
        $timezone = $prefs['timezone'];

        try {
            $now = Carbon::now($timezone);
        } catch (\Exception $e) {
            $now = Carbon::now();
        }

        // Respect quiet hours
        if ($this->isQuietHours($prefs, $now)) {
            Log::info("Skipping reminder generation for user {$user->id}: inside quiet hours ({$now->format('H:i')})");
            return 0;
        }

        $createdCount = 0;
        $userId = $user->id;

        // 1. Task Due Reminders (<24 hours)
        if ($prefs['task_reminders']) {
            $in24Hours = $now->copy()->addHours(24);
            $impendingTasks = Task::where('user_id', $userId)
                ->whereIn('status', ['todo', 'in_progress'])
                ->whereNotNull('due_date')
                ->whereBetween('due_date', [$now->toDateTimeString(), $in24Hours->toDateTimeString()])
                ->get();

            foreach ($impendingTasks as $task) {
                $actionUrl = "/tasks?id={$task->id}";
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'deadline')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(24))
                    ->exists();

                if (!$already) {
                    Notification::create([
                        'user_id' => $userId,
                        'title' => "Tenggat Waktu: {$task->title}",
                        'message' => "Task '{$task->title}' mendekati batas waktu dalam 24 jam ({$task->due_date->format('M d, H:i')}).",
                        'type' => 'deadline',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        // 2. Project Deadline Reminders (<48 hours)
        if ($prefs['project_reminders']) {
            $in48Hours = $now->copy()->addHours(48)->toDateString();
            $impendingProjects = Project::where('user_id', $userId)
                ->whereIn('status', ['planning', 'in_progress'])
                ->whereNotNull('deadline')
                ->whereBetween('deadline', [$now->toDateString(), $in48Hours])
                ->get();

            foreach ($impendingProjects as $proj) {
                $actionUrl = "/projects?id={$proj->id}";
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'deadline')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(48))
                    ->exists();

                if (!$already) {
                    Notification::create([
                        'user_id' => $userId,
                        'title' => "Deadline Proyek: {$proj->title}",
                        'message' => "Proyek '{$proj->title}' memiliki target selesai pada {$proj->deadline}. Periksa progres milestone Anda.",
                        'type' => 'deadline',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        // 3. Habit Reminders (Uncompleted habits for today, sent after 14:00)
        if ($prefs['habit_reminders'] && $now->hour >= 14) {
            $todayStr = $now->toDateString();
            $completedHabitIds = HabitLog::where('user_id', $userId)
                ->whereDate('log_date', $todayStr)
                ->where('is_completed', true)
                ->pluck('habit_id')
                ->all();

            $pendingHabits = Habit::where('user_id', $userId)
                ->where('is_archived', false)
                ->whereNotIn('id', $completedHabitIds)
                ->get();

            if ($pendingHabits->count() > 0) {
                $actionUrl = '/habits';
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'habit')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(18))
                    ->exists();

                if (!$already) {
                    $firstHabit = $pendingHabits->first();
                    $msg = $pendingHabits->count() === 1
                        ? "Jangan lupa menyelesaikan kebiasaan '{$firstHabit->title}' hari ini untuk menjaga streak Anda!"
                        : "Anda memiliki {$pendingHabits->count()} kebiasaan yang belum dicatat hari ini. Jaga momentum streak Anda!";

                    Notification::create([
                        'user_id' => $userId,
                        'title' => 'Pengingat Kebiasaan Harian',
                        'message' => $msg,
                        'type' => 'habit',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        // 4. Goal Milestone Reminders (<72 hours)
        if ($prefs['goal_reminders']) {
            $in72Hours = $now->copy()->addHours(72)->toDateString();
            $activeGoals = Goal::where('user_id', $userId)
                ->whereIn('status', ['not_started', 'in_progress'])
                ->with(['milestones' => function ($q) use ($now, $in72Hours) {
                    $q->where('is_completed', false)
                      ->whereNotNull('due_date')
                      ->whereBetween('due_date', [$now->toDateString(), $in72Hours]);
                }])
                ->get();

            foreach ($activeGoals as $goal) {
                foreach ($goal->milestones as $milestone) {
                    $actionUrl = "/goals?id={$goal->id}";
                    $already = Notification::where('user_id', $userId)
                        ->where('type', 'goal')
                        ->where('action_url', $actionUrl)
                        ->where('created_at', '>=', Carbon::now()->subHours(72))
                        ->exists();

                    if (!$already) {
                        Notification::create([
                            'user_id' => $userId,
                            'title' => "Milestone Target: {$milestone->title}",
                            'message' => "Milestone '{$milestone->title}' untuk target '{$goal->title}' jatuh tempo pada {$milestone->due_date}.",
                            'type' => 'goal',
                            'action_url' => $actionUrl,
                            'is_read' => false,
                        ]);
                        $createdCount++;
                    }
                }
            }
        }

        // 5. Examination Upcoming Reminders (<48 hours)
        if ($prefs['exam_reminders']) {
            $in48Hours = $now->copy()->addHours(48)->toDateString();
            $upcomingExams = Examination::where('user_id', $userId)
                ->whereIn('status', ['upcoming', 'preparing'])
                ->whereBetween('examination_date', [$now->toDateString(), $in48Hours])
                ->get();

            foreach ($upcomingExams as $exam) {
                $actionUrl = "/examinations?id={$exam->id}";
                $already = Notification::where('user_id', $userId)
                    ->where('type', 'exam')
                    ->where('action_url', $actionUrl)
                    ->where('created_at', '>=', Carbon::now()->subHours(48))
                    ->exists();

                if (!$already) {
                    Notification::create([
                        'user_id' => $userId,
                        'title' => "Jadwal Ujian: {$exam->title}",
                        'message' => "Ujian '{$exam->title}' ({$exam->subject}) akan berlangsung pada {$exam->examination_date->format('M d, Y')}.",
                        'type' => 'exam',
                        'action_url' => $actionUrl,
                        'is_read' => false,
                    ]);
                    $createdCount++;
                }
            }
        }

        return $createdCount;
    }
}
