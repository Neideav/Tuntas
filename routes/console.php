<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Automated reminder scheduling for deadlines, exams, and habits.
 */
Schedule::command('reminders:generate')->hourly()->withoutOverlapping();

/**
 * Scheduler Heartbeat Monitor:
 * Records timestamp every minute into storage/framework/scheduler_heartbeat.txt
 * so that /api/v1/health can verify the scheduler is continuously processing tasks.
 */
Schedule::call(function () {
    $heartbeatDir = storage_path('framework');
    if (!is_dir($heartbeatDir)) {
        @mkdir($heartbeatDir, 0775, true);
    }
    @file_put_contents($heartbeatDir . '/scheduler_heartbeat.txt', now()->toIso8601String());
})->everyMinute()->name('scheduler-heartbeat');
