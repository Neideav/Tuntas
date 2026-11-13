<?php

namespace App\Console\Commands;

use App\Models\Examination;
use App\Models\Notification;
use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;

class GenerateAutomatedRemindersCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'reminders:generate';

    /**
     * The console command description.
     */
    protected $description = 'Automatically scan upcoming tasks and examinations to generate reminders without duplicates.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Starting automated reminder generation scan...');
        $totalCreated = 0;

        // Process active users in chunks
        User::with('settings')->chunk(100, function ($users) use (&$totalCreated) {
            foreach ($users as $user) {
                $timezone = $user->settings->timezone ?? config('app.timezone', 'Asia/Jakarta');
                try {
                    $now = Carbon::now($timezone);
                } catch (\Exception $e) {
                    $now = Carbon::now();
                }

                $in24Hours = $now->copy()->addHours(24);
                $in48Hours = $now->copy()->addHours(48);

                // 1. Task Deadlines (<24 hours)
                $tasks = Task::where('user_id', $user->id)
                    ->whereIn('status', ['todo', 'in_progress'])
                    ->whereNotNull('due_date')
                    ->whereBetween('due_date', [$now->toDateTimeString(), $in24Hours->toDateTimeString()])
                    ->get();

                foreach ($tasks as $task) {
                    $actionUrl = "/tasks?id={$task->id}";

                    $alreadyNotified = Notification::where('user_id', $user->id)
                        ->where('type', 'deadline')
                        ->where('action_url', $actionUrl)
                        ->where('created_at', '>=', Carbon::now()->subHours(24))
                        ->exists();

                    if (!$alreadyNotified) {
                        Notification::create([
                            'user_id' => $user->id,
                            'title' => "Upcoming Deadline: {$task->title}",
                            'message' => "Task '{$task->title}' is due in less than 24 hours ({$task->due_date->format('M d, H:i')}).",
                            'type' => 'deadline',
                            'action_url' => $actionUrl,
                            'is_read' => false,
                        ]);
                        $totalCreated++;
                    }
                }

                // 2. Examination Schedules (<48 hours)
                $exams = Examination::where('user_id', $user->id)
                    ->whereIn('status', ['upcoming', 'preparing'])
                    ->whereBetween('examination_date', [$now->toDateString(), $in48Hours->toDateString()])
                    ->get();

                foreach ($exams as $exam) {
                    $actionUrl = "/examinations?id={$exam->id}";

                    $alreadyNotified = Notification::where('user_id', $user->id)
                        ->where('type', 'exam')
                        ->where('action_url', $actionUrl)
                        ->where('created_at', '>=', Carbon::now()->subHours(48))
                        ->exists();

                    if (!$alreadyNotified) {
                        Notification::create([
                            'user_id' => $user->id,
                            'title' => "Exam Scheduled: {$exam->title}",
                            'message' => "Examination '{$exam->title}' ({$exam->subject}) is approaching on {$exam->examination_date->format('M d, Y')}.",
                            'type' => 'exam',
                            'action_url' => $actionUrl,
                            'is_read' => false,
                        ]);
                        $totalCreated++;
                    }
                }
            }
        });

        $this->info("Automated reminder generation completed: {$totalCreated} new notifications created.");
        return self::SUCCESS;
    }
}

