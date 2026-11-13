<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Automated reminder scheduling for deadlines, exams, and habits.
 * In production, trigger via crontab: * * * * * cd /path-to-tuntas && php artisan schedule:run >> /dev/null 2>&1
 */
Schedule::command('reminders:generate')->hourly()->withoutOverlapping();
