# ⚡ Tuntas — Enterprise-Grade Productivity, LMS & Examination Platform

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Monorepo-06B6D4?style=for-the-badge&logo=monorepo&logoColor=white" alt="Monorepo" />
  <img src="https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Laravel-12.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" alt="Laravel 12" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Tests-97%20Passed%20(847%20Assertions)-emerald?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Tests" />
</p>

**Tuntas** is an enterprise-grade, integrated productivity management, continuous learning, and assessment platform designed to harmonize daily execution, project milestone delivery, habit discipline, deep-focus study, and formal examination into a unified digital workspace.

Engineered with a cohesive **Monorepo** architecture, Tuntas pairs a high-performance **Next.js 15 (React 19, TypeScript, Tailwind CSS v4, Motion / Framer Motion, Lucide Icons)** frontend with a headless **Laravel 12 RESTful API** backend featuring strict multi-tenant isolation, immutable examination state snapshotting, deterministic rule-based analytics, and automated multi-domain notification intelligence.

---

## 🗺️ Module Integration Map

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   TUNTAS WORKSPACE                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
          │                                 │                                 │
          ▼                                 ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│ Task Management  │◄────────────►│Project Management│◄────────────►│ Goal Management  │
│ • Kanban / Table │  Belongs To  │ • Milestones     │  Linked To   │ • OKR Objectives │
│ • Recurrence     │              │ • Auto Progress  │              │ • Key Results    │
│ • Dependencies   │              │ • Health Status  │              │ • Weighted Rollup│
└─────────┬────────┘              └─────────┬────────┘              └─────────┬────────┘
          │                                 │                                 │
          │ Due Dates                       │ Deadlines                       │ Target Dates
          ▼                                 ▼                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Unified Calendar & Scheduling                             │
│                  (Tasks, Projects, Habit Logs, Sessions & Examinations)                │
└────────────────────────────────────────────────────────────────────────────────────────┘
          ▲                                 ▲                                 ▲
          │ Scheduled Exams                 │ Daily Streaks                   │ Focus Sessions
          │                                 │                                 │
┌─────────┴────────┐              ┌─────────┴────────┐              ┌─────────┴────────┐
│   Examination    │              │  Habit Tracking  │              │ Learning (LMS)   │
│ • Question Banks │              │ • Multi-Freq     │              │ • Course/Lessons │
│ • Anti-Leak Exam │              │ • Freeze Tokens  │              │ • Study Timer    │
│ • Auto-Grading   │              │ • Consistency %  │              │ • Active Session │
└─────────┬────────┘              └─────────┬────────┘              └─────────┬────────┘
          │                                 │                                 │
          └────────────────────────┬────────┴─────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Analytics & Rule-Based Intelligence                             │
│       • Productivity Analytics (Velocity, Completion Rates, Planned vs Completed)      │
│       • Learning Analytics (Effort Activity vs Outcome Attainment Separation)          │
│       • Question Difficulty Distribution (Easy / Medium / Hard Classification)         │
│       • Transparent Deterministic Insights (Overdue, Slump, Momentum, Near-Goal)       │
│       • RFC 4180 User-Isolated CSV Export                                              │
└──────────────────────────────────┬─────────────────────────────────────────────────────┘
                                   │ Triggers
                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     Automated Multi-Domain Notification Engine                         │
│ • Lifecycle: In-App, Read, Archive / Unarchive, Category Filters                      │
│ • Reminders: Tasks (<24h), Projects (<48h), Exams (<48h), Goals (<72h), Habits (Today)│
│ • Quiet Hours Respect (E.g. 23:00 - 06:00) & 24h-72h Idempotent Deduplication          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Modules & System Capabilities

1. **🔐 Authentication & Multi-Tenant Access**:
   - Secure registration, token issuance, session control, and salted password hashing via Laravel Sanctum.
   - Enforced multi-tenant data isolation (`403 Forbidden` on cross-tenant entity access or mutation).
2. **📊 Personal Command Dashboard**:
   - Real-time productivity cockpit: today's tasks, active projects, habit check-in widget, OKR snapshot, exam countdown, and deterministic rule-based insights banner.
3. **⚡ Advanced Task Management**:
   - 4 flexible views: **Kanban Board** (with HTML5 Drag-and-Drop and optimistic reordering), **Table**, **List**, and **Timelines**.
   - Subtasks checklist, priority hierarchy (`urgent`, `high`, `medium`, `low`), categories, tags, task dependencies (`blocked_by` / `blocking`), bulk actions, and auto-spawning recurring tasks (`daily`, `weekly`, `monthly`).
4. **📁 Strategic Project Management**:
   - Multi-phase project initiatives with automatic progress percentage rollups calculated deterministically from linked task completions and milestone deliverables.
5. **🔥 Habit Streak & Freeze Token Engine**:
   - Multi-frequency schedules (`daily`, `weekdays`, `weekly`, or custom selected days), numeric and boolean habit measurements, continuous streak calculation, all-time best streaks, and redeemable freeze tokens to safeguard streaks against missed days.
6. **🎯 Goals & OKR Tracking**:
   - High-level objectives with measurable key results, custom target units, confidence levels, and weighted milestone rollups linked to operational tasks and projects.
7. **📚 Dedicated Learning Management System (LMS)**:
   - Structured Course, Module, and Lesson taxonomy with rich content, resource URLs, study notes, and an active Pomodoro study timer that logs focus study sessions.
8. **📝 Dedicated Examination Assessment Subsystem**:
   - Autonomous assessment engine with question banks, multi-type questions (`multiple_choice_single`, `multiple_choice_multiple`, `true_false`, `short_answer`, `essay`), **anti-leak answer sanitization during ongoing attempts**, 30s autosync heartbeats, proctoring violation alerts, server auto-grading with partial scoring, and post-exam review guards.
9. **📈 Productivity & Learning Analytics**:
   - Filter by date range (`today`, `this_week`, `this_month`, `last_30_days`, `custom`), strict separation of learning effort (*activity*) vs outcome (*attainment*), exam difficulty classification, and user-isolated CSV data export.
10. **🔔 Automated Notification Hub**:
    - Notification preferences per module, quiet hours suppression, and CLI reminder scanner (`php artisan reminders:generate`) with idempotent deduplication.

---

## 🛠️ Quickstart & Local Setup Guide

### System Requirements
- **PHP**: 8.2 or 8.3+ with `pdo_sqlite`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`.
- **Node.js**: 18.18+ or 20+ (Next.js 15 compatible).
- **Composer**: 2.x
- **Package Manager**: `npm` or `pnpm`

### Step-by-Step Installation

```bash
# 1. Clone repository
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas

# 2. Install PHP backend dependencies
composer install

# 3. Install Node frontend dependencies
npm install

# 4. Configure environment
cp .env.example .env
php artisan key:generate

# 5. Run database migrations and seed default data
php artisan migrate

# 6. Verify static types and compile frontend
npm run typecheck
npm run build

# 7. Start full-stack development servers concurrently
npm run dev
```

The application will be accessible at:
- **Frontend Next.js**: `http://localhost:3000`
- **Backend API Laravel**: `http://localhost:8000/api/v1`

---

## ⚙️ Environment Variables Reference (`.env`)

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `APP_NAME` | `Tuntas` | Application name displayed in emails and headers |
| `APP_ENV` | `local` | Environment mode (`local`, `production`) |
| `APP_KEY` | *(Generated)* | Application encryption key (`php artisan key:generate`) |
| `APP_DEBUG` | `true` | Debug flag (must be `false` in production) |
| `APP_URL` | `http://localhost:8000` | Backend API URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Public API endpoint consumed by Next.js frontend client |
| `DB_CONNECTION` | `sqlite` | Primary database connection driver |
| `DB_DATABASE` | `database/database.sqlite` | SQLite database file location |
| `QUEUE_CONNECTION` | `database` | Background queue connection (`sync`, `database`, `redis`) |
| `SESSION_DRIVER` | `database` | Session storage driver |

---

## 🔄 Production Background Scheduler & Queue Setup

### 1. Linux Crontab (Hourly Automated Deadlines & Reminders Scanner)
Configure the system crontab to execute Laravel's scheduled commands:

```bash
crontab -e
```
Add the following line:
```bash
* * * * * cd /path/to/tuntas && php artisan schedule:run >> /dev/null 2>&1
```

Scheduled jobs configured in `routes/console.php`:
- `reminders:generate`: Runs hourly with overlap protection to scan tasks (<24h), projects (<48h), exams (<48h), and habits.

### 2. Supervisor Configuration (Background Queue Worker)
Create a Supervisor worker configuration at `/etc/supervisor/conf.d/tuntas-worker.conf`:

```ini
[program:tuntas-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/tuntas/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/path/to/tuntas/storage/logs/worker.log
stopwaitsecs=3600
```
Update and start Supervisor:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start tuntas-worker:*
```

---

## 🧪 Comprehensive Verification & Automated Testing

Tuntas ships with a complete, automated verification test suite:

```bash
# 1. Run all 79 backend Unit & Feature tests (702 assertions)
php artisan test

# 2. Run the 19-Step End-to-End User Journey test specifically
php artisan test --filter=FullIntegrationAndUserJourneyE2ETest

# 3. Run frontend TypeScript contract validation
npm run typecheck

# 4. Run frontend linter
npm run lint

# 5. Build optimized Next.js production bundle
npm run build
```

---

## 📡 RESTful API Endpoints Summary (`/api/v1`)

### Authentication & User
- `POST /auth/register` — Create user account & issue Sanctum bearer token.
- `POST /auth/login` — Authenticate and receive token.
- `POST /auth/logout` — Revoke active token.
- `GET /auth/me` — Authenticated profile.
- `PUT /auth/profile` — Update name, email, timezone.
- `PUT /auth/password` — Change password.
- `POST /auth/forgot-password` — Password reset token creation.
- `POST /auth/reset-password` — Reset password using token.

### Tasks & Projects
- `GET /tasks` | `POST /tasks` | `PUT /tasks/{id}` | `DELETE /tasks/{id}`
- `PATCH /tasks/{id}/toggle` — Toggle status (`todo` ↔ `completed`).
- `POST /tasks/bulk` — Perform bulk complete, delete, priority update.
- `POST /tasks/{id}/subtasks` | `PATCH /subtasks/{id}/toggle` | `DELETE /subtasks/{id}`
- `GET /projects` | `POST /projects` | `PUT /projects/{id}` | `DELETE /projects/{id}`
- `POST /projects/{id}/milestones` | `PATCH /projects/{id}/milestones/{mid}/toggle`

### Habits & Goals
- `GET /habits` | `POST /habits` | `PUT /habits/{id}` | `DELETE /habits/{id}`
- `POST /habits/{id}/toggle` — Check-in habit for date with streak calculation.
- `POST /habits/{id}/freeze` — Apply freeze token to preserve streak.
- `GET /habits/{id}/history` — Visual 30-day log history.
- `GET /goals` | `POST /goals` | `PUT /goals/{id}` | `DELETE /goals/{id}`
- `POST /goals/{id}/milestones` — Add measurable key result with weight.
- `PATCH /milestones/{id}` — Update key result value and trigger auto goal rollup.

### Learning Management & Examination Engine
- `GET /courses` | `POST /courses` | `PUT /courses/{id}` | `DELETE /courses/{id}`
- `POST /courses/{id}/modules` | `POST /modules/{id}/lessons` | `PATCH /lessons/{id}/toggle`
- `POST /learning-sessions/start` | `POST /learning-sessions/{id}/complete`
- `GET /question-banks` | `POST /question-banks` | `POST /question-banks/{id}/questions`
- `GET /exam-blueprints` | `POST /exam-blueprints` | `POST /exam-blueprints/{id}/attach-questions`
- `POST /exam-blueprints/{id}/start` — Begin exam attempt with anti-leak snapshot.
- `POST /exam-attempts/{id}/sync` — Heartbeat answer synchronization.
- `POST /exam-attempts/{id}/submit` — Atomic grade and evaluation.
- `GET /exam-attempts/{id}/review` — Post-submission review with explanations.

### Analytics & Reporting
- `GET /analytics/productivity?range={today|this_week|this_month|last_30_days|custom}`
- `GET /analytics/learning?range={...}&course_id={id}`
- `GET /analytics/export?type={productivity|tasks|projects|learning|exams}` — Stream CSV.

### Notifications & Schedule
- `GET /notifications` | `PATCH /notifications/{id}/read` | `PATCH /notifications/{id}/archive`
- `GET /notifications/preferences` | `PUT /notifications/preferences`
- `POST /notifications/check-reminders` — On-demand idempotent scan.
- `GET /calendar/events?start={iso}&end={iso}` — Unified cross-module schedule.

---

## 🐳 Docker Production Infrastructure & Architecture

Tuntas is engineered to run in production with a dedicated **Nginx Reverse Proxy & Cohesive Monorepo** architecture:

```
                       Internet (Browser Clients)
                                  │
                                  ▼
                   ┌─────────────────────────────┐
                   │   Public Port 80 / 443      │
                   └──────────────┬──────────────┘
                                  │
                   ┌──────────────▼──────────────┐
                   │    Container: tuntas-nginx  │
                   │    (Nginx Alpine Gateway)   │
                   └──────┬───────────────┬──────┘
                          │               │
         location /       │               │ location /api/
                          ▼               ▼
                   ┌──────────────┐┌──────────────┐
                   │ Next.js Web  ││ Laravel API  │
                   │ Port 3000    ││ Port 8000    │
                   │ (Internal)   ││ (Internal)   │
                   └──────────────┘└──────────────┘
                    (Bridge Network: tuntas-network)
                    (Ports 3000 & 8000 NEVER exposed to host)
```

- **Single Public Gateway**: Nginx on ports `80` and `443` handles all incoming client requests.
- **Direct IP Access**: Browsing `http://IP-VPS` works immediately out of the box without specifying `:3000` or `:8000`.
- **Domain & SSL**: Running `./scripts/setup-ssl.sh <domain> <email>` automatically provisions Let's Encrypt certificates, activates HTTP->HTTPS redirects for the domain, and sets up automated daily renewal cron jobs.
- **Zero Port Exposure**: Ports `3000` and `8000` remain strictly internal within the Docker bridge network.
- **Health Check**: Probes `/api/v1/health` verifying database PDO connectivity every 30s.
- **Entrypoint Lifecycle**:
  1. Database connection retry loop (up to 30 attempts, 2s interval).
  2. Isolated atomic schema migrations (`php artisan migrate --force --isolated`).
  3. Production route and configuration cache warmup.
  4. Background queue worker auto-spawn.
  5. Graceful shutdown trap on `SIGTERM`/`SIGINT`.

For step-by-step server provisioning and AWS configuration, refer to [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 💾 Backup, Disaster Recovery & High Availability

### 1. AWS RDS Automated Backups & PITR
- **Automated Snapshots**: Enable AWS RDS automated daily backups with a retention period of 7–35 days.
- **Point-in-Time Recovery (PITR)**: AWS RDS enables restoring the database to any specific second within the retention window.

### 2. Manual Logical Database Dumps
To create an off-site logical backup:
```bash
# Dump compressed database schema & data
mysqldump -h YOUR_RDS_ENDPOINT -u admin -p --single-transaction --routines --triggers tuntas | gzip > tuntas-backup-$(date +%F).sql.gz

# Restore database dump
gunzip < tuntas-backup-2026-11-24.sql.gz | mysql -h YOUR_RDS_ENDPOINT -u admin -p tuntas
```

### 3. Persistent Storage Volumes
The application mounts persistent storage for user uploads, logs, and framework caches:
```bash
# Backup persistent named volumes
docker run --rm -v tuntas_app-storage:/data -v $(pwd):/backup alpine tar czf /backup/storage-backup-$(date +%F).tar.gz /data
```

---

## 📚 Release Documentation & Changelogs

- **[RELEASE_NOTES.md](RELEASE_NOTES.md)**: Release v2.0.0-GA highlights, pre-flight deployment checklist, rollback procedures, and known limitations.
- **[CHANGELOG.md](CHANGELOG.md)**: Comprehensive changelog tracking all major, minor, and patch revisions.
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Production deployment manual for AWS EC2, AWS RDS MariaDB, Nginx Reverse Proxy with Let's Encrypt SSL, and AWS Application Load Balancers.

---

## 🔧 Troubleshooting Guide

| Issue | Root Cause | Solution |
| :--- | :--- | :--- |
| `EPERM: operation not permitted` on Windows `src/.next` during build | Background `npm run dev` process holding file locks on generated types | Stop dev server before running `npm run build`, or run `npm run clean:next`. |
| `Target [Illuminate\Contracts\Console\Kernel] is not instantiable` in tests | Laravel 12 application builder without Kernel singleton binding | Call `->withKernels()` in `bootstrap/app.php` before `withRouting()`. |
| Notification reminders not generated during test or scan | Current time falls within user's configured Quiet Hours window | Check `quiet_hours_start` and `quiet_hours_end` in `/api/v1/notifications/preferences`. |
| CORS or Unauthenticated error from Next.js | `NEXT_PUBLIC_API_URL` pointing to incorrect port | Ensure `.env` specifies `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`. |

---

## ⚖️ License
Distributed under the [MIT License](LICENSE).
