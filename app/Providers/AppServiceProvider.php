<?php

namespace App\Providers;

use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Queue Worker Heartbeat & Failure Monitoring
        if (class_exists(Queue::class)) {
            // Heartbeat updated on every queue poll loop (throttled to every 10s)
            Queue::looping(function () {
                static $lastHeartbeat = 0;
                $now = time();
                if ($now - $lastHeartbeat >= 10) {
                    $lastHeartbeat = $now;
                    $path = storage_path('framework/queue_worker_heartbeat.txt');
                    @file_put_contents($path, date('c', $now));
                }
            });

            // Heartbeat updated immediately after any job finishes processing
            Queue::after(function () {
                $path = storage_path('framework/queue_worker_heartbeat.txt');
                @file_put_contents($path, date('c'));
            });

            // Log queue job failure details
            Queue::failing(function (JobFailed $event) {
                Log::error('Queue worker job failed', [
                    'job' => $event->job->resolveName(),
                    'connection' => $event->connectionName,
                    'queue' => $event->job->getQueue(),
                    'exception' => $event->exception->getMessage(),
                ]);
            });
        }
    }
}
