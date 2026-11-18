<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\NotificationService;
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
    protected $description = 'Automatically scan upcoming tasks, projects, habits, goals, and exams to generate reminders without duplicates.';

    protected NotificationService $notificationService;

    public function __construct(NotificationService $notificationService)
    {
        parent::__construct();
        $this->notificationService = $notificationService;
    }

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
                try {
                    $created = $this->notificationService->generateRemindersForUser($user);
                    $totalCreated += $created;
                } catch (\Throwable $e) {
                    $this->error("Error generating reminders for user {$user->id}: {$e->getMessage()}");
                }
            }
        });

        $this->info("Automated reminder generation completed: {$totalCreated} new notifications created.");
        return self::SUCCESS;
    }
}
