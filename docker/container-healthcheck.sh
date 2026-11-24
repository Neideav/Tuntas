#!/usr/bin/env bash
# ==============================================================================
# Tuntas — Deep Container Healthcheck Script
# Verifies: Next.js (port 3000), PHP-FPM (port 9000), Database, Scheduler & Queue
# ==============================================================================
set -e

# 1. Verify Next.js frontend is responding on port 3000
if ! curl -s -f -o /dev/null --max-time 3 http://127.0.0.1:3000/; then
  echo "UNHEALTHY: Next.js frontend on port 3000 is not responding." >&2
  exit 1
fi

# 2. Verify PHP-FPM master process is actively accepting connections on TCP port 9000
if ! php -r "
  \$fp = @fsockopen('127.0.0.1', 9000, \$errno, \$errstr, 2);
  if (!\$fp) {
    exit(1);
  }
  fclose(\$fp);
  exit(0);
" 2>/dev/null; then
  echo "UNHEALTHY: PHP-FPM on port 9000 is not accepting connections." >&2
  exit 1
fi

# 3. Verify Laravel API, Database, Scheduler, and Queue Worker health
PHP_CHECK=$(php -r "
  require 'vendor/autoload.php';
  \$app = require_once 'bootstrap/app.php';
  \$kernel = \$app->make(Illuminate\Contracts\Console\Kernel::class);
  \$kernel->bootstrap();

  // 3a. Verify Database connection
  try {
    \Illuminate\Support\Facades\DB::connection()->getPdo();
  } catch (\Throwable \$e) {
    echo 'DB_DISCONNECTED: ' . \$e->getMessage();
    exit(2);
  }

  // 3b. Verify Scheduler Heartbeat (150s window, allow 90s cold start grace period)
  \$uptime = 999;
  if (file_exists('/proc/uptime')) {
    \$uptime = (float) explode(' ', file_get_contents('/proc/uptime'))[0];
  }

  \$schedFile = storage_path('framework/scheduler_heartbeat.txt');
  if (file_exists(\$schedFile)) {
    if ((time() - filemtime(\$schedFile)) > 150) {
      echo 'SCHEDULER_STALE: Last heartbeat was > 150 seconds ago.';
      exit(3);
    }
  } elseif (\$uptime > 90) {
    echo 'SCHEDULER_INACTIVE: Heartbeat file not yet created after 90s uptime.';
    exit(3);
  }

  // 3c. Verify Queue Worker Heartbeat (60s window if queue driver != sync, allow 60s cold start)
  if (config('queue.default') !== 'sync') {
    \$qFile = storage_path('framework/queue_worker_heartbeat.txt');
    if (file_exists(\$qFile)) {
      if ((time() - filemtime(\$qFile)) > 60) {
        echo 'QUEUE_STALE: Last heartbeat was > 60 seconds ago.';
        exit(4);
      }
    } elseif (\$uptime > 60) {
      echo 'QUEUE_INACTIVE: Heartbeat file not yet created after 60s uptime.';
      exit(4);
    }
  }

  echo 'OK';
  exit(0);
" 2>&1 || true)

if [ "$PHP_CHECK" != "OK" ]; then
  echo "DEGRADED: Laravel core service check reported: $PHP_CHECK" >&2
  exit 1
fi

exit 0
