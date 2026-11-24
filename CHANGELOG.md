# 📋 Changelog — Tuntas

All notable changes to the **Tuntas** platform will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-11-24

### 🚀 Major Release — Enterprise Full-Stack Monorepo Platform

#### Added
- **Core Architecture**:
  - Unified Monorepo pairing Next.js 15 (React 19, TypeScript, Tailwind CSS v4) with Headless Laravel 12 RESTful API.
  - Native internal reverse proxy via `next.config.mjs` routing `/api/:path*` directly to internal Laravel `127.0.0.1:8000`.
  - Global toast notification feedback system (`ToastProvider`, `showToast`, `useToast`) with Framer Motion.
  - Automated reminder scanner CLI command (`php artisan reminders:generate`) with idempotent deduplication.

- **Task Management**:
  - Multi-view presentation: Kanban board with drag-and-drop, table, list, and calendar views.
  - Subtask checklists with reactive completion rollups.
  - Task dependencies (`blocked_by` / `blocking`) preventing premature completion.
  - Bulk actions (status update, category/project assignment, batch deletion).
  - Auto-spawning recurring tasks (`daily`, `weekly`, `monthly`).

- **Project & Goal Management**:
  - Multi-phase project tracking with automatic progress percentage rollups.
  - Project milestones with reactive creation, toggling, and deletion.
  - Objectives and Key Results (OKR) goal tracking with custom measurement units (`%`, `count`, `currency`, `score`).
  - Weighted key result contributions and bidirectional links between tasks and projects.

- **Habit Tracking & Consistency Engine**:
  - Multi-frequency schedules: `daily`, `weekdays`, `weekly`, or custom selected day masks.
  - Numeric habit tracking with target metrics in addition to binary completion.
  - Dynamic streak tracking, current streaks, all-time best streaks, and consistency percentages.
  - Streak freeze token mechanism to protect streaks against missed days.

- **Learning Management System (LMS)**:
  - Multi-tier curriculum hierarchy: Courses -> Modules -> Lessons.
  - Active Pomodoro study timer tracking with background focus session logging.
  - Automatic progress recalculation based on lesson completion states.
  - Separation of study activity metrics (*effort*) from exam attainment (*outcomes*).

- **Dedicated Examination Assessment Engine**:
  - Centralized Question Bank repository with multi-type questions (`multiple_choice_single`, `multiple_choice_multiple`, `true_false`, `short_answer`, `essay`, `code_analysis`).
  - Blueprint-driven examination generator with point weights, duration limits, and passing thresholds.
  - **Anti-leak snapshotting**: Questions, choices, and answer keys are snapshotted at attempt creation to prevent live tampering or leakage during ongoing attempts.
  - 30-second automated heartbeat synchronization (`/api/v1/exam-attempts/{id}/sync`).
  - Automated server-side grading engine with manual essay review workflows.
  - Post-submission review protections with comprehensive explanations.

- **Security & Infrastructure Hardening**:
  - Single-container Docker production architecture (`tuntas`) exposing only port `80` (Next.js entrypoint) without exposing internal port `8000`.
  - AWS RDS MariaDB SSL certificate transport validation using `/etc/ssl/certs/global-bundle.pem`.
  - Strict multi-tenant data isolation enforcing `403 Forbidden` across all tenant resources.
  - HTTP security response headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`).
  - CORS security restricting allowed origins via `CORS_ALLOWED_ORIGINS` and rejecting wildcards when credentials are active.
  - Rate limiting on public authentication endpoints (`5 req/min` on register, `10 req/min` on login/password reset).
  - Health check endpoint `/api/v1/health` verifying active database PDO connectivity.
  - Atomic migration execution (`php artisan migrate --force --isolated`).

#### Changed
- Consolidated all branding, styling, views, and routes to **Tuntas**; removed all legacy SysTask code.
- Optimized bundle imports for `lucide-react` and `date-fns` using Next.js `optimizePackageImports`.
- Consolidated daily habit logs and 7-day productivity metrics into batch SQL queries, eliminating N+1 bottlenecks.

#### Fixed
- Fixed foreign key cascade deletions across tasks, goals, courses, and question banks.
- Fixed dependency prerequisite blocking validation on task status updates.
- Fixed atomic transaction rollbacks for multi-step entity creations.
