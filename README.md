# ⚡ Tuntas — Integrated Productivity, Habit & Examination Platform

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Monorepo-06B6D4?style=for-the-badge&logo=monorepo&logoColor=white" alt="Monorepo" />
  <img src="https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Laravel-12.x-FF2D20?style=for-the-badge&logo=laravel&logoColor=white" alt="Laravel 12" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Tests-35%20Passed%20(270%20Assertions)-emerald?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Tests" />
</p>

**Tuntas** is an enterprise-grade, integrated productivity management and examination platform designed to harmonize daily execution, project milestone delivery, habit discipline, continuous learning, and formal assessment into a unified digital workspace.

Engineered with a modern **Monorepo** architecture, Tuntas separates a high-performance **Next.js 15 (React 19, TypeScript, Tailwind CSS v4, Lucide Icons)** frontend from a headless **Laravel 12 RESTful API** backend with multi-tenant data isolation, strict security safeguards, and an autonomous **Dedicated Examination Subsystem**.

---

## 🚀 Key Modules & System Capabilities

1. **🔐 Authentication & Multi-Tenant Access**:
   - Secure registration, token issuance, session control, and salted password hashing via Laravel Sanctum.
   - Enforced multi-tenant data isolation (`403 Forbidden` on cross-tenant entity mutations).
2. **📊 Personal Command Dashboard**:
   - Real-time productivity cockpit: today's tasks, active projects, habit check-in widget, OKR snapshot, exam countdown, and 7-day velocity curves.
3. **⚡ Advanced Task Management**:
   - 4-column Kanban board (`To-Do`, `On Progress`, `In Review`, `Completed`), subtasks progress tracking, priorities (`urgent`, `high`, `medium`, `low`), categories, tags, and auto-spawning recurring tasks (`daily`, `weekly`, `monthly`).
4. **📁 Strategic Project Management**:
   - Multi-phase project initiatives with automatic progress percentage rollups calculated deterministically from linked task completions.
5. **📅 Unified Calendar Aggregator**:
   - Monthly consolidated agenda mapping task due dates, project deadlines, scheduled examinations, and habit logs.
6. **🔥 Habit Streak & Freeze Token Engine**:
   - Daily habit check-ins, continuous streak calculations, all-time best streaks, and redeemable freeze tokens to safeguard streaks against missed days.
7. **🎯 Goals & OKR Tracking**:
   - High-level objectives with measurable key results, custom target units, and weighted milestone rollups.
8. **📚 Dedicated Learning Management System (LMS)**:
   - Subject and lesson taxonomy with reading resources and a focused Pomodoro study timer that logs study sessions.
9. **📝 Dedicated Examination Assessment Subsystem**:
   - Autonomous assessment engine with question banks, multi-type questions (`multiple_choice`, `single_choice`, `true_false`, `short_answer`, `essay`), anti-leak answer sanitization during ongoing attempts, 30s autosync heartbeats, proctoring violation alerts, server auto-grading, and post-exam review guards.
10. **📈 Productivity & Learning Analytics**:
    - Velocity curves, priority distributions, study hour tracking, exam pass rates, and grade tier breakdowns ($85-100\%$, $70-84\%$, $50-69\%$, $<50\%$).
11. **🔔 Automated Notification Hub**:
    - In-app notification center with an automated scanner checking tasks due in $<24\text{h}$ and exams in $<48\text{h}$ with 1-hour anti-spam duplicate prevention.
12. **⚙️ Preferences & Settings**:
    - Timezone configurations (WIB, WITA, WIT, UTC), appearance themes, and profile management.

---

## 📂 Unified Full-Stack Repository Structure (Like Pasaria)

```
Tuntas/
├── app/                        # Backend Application: Controllers, Models, Middleware
│   ├── Http/Controllers/Api/   # REST API Controllers (Tasks, Exams, Analytics, etc.)
│   └── Models/                 # Eloquent ORM Models (Task, Exam, Habit, Goal, LMS)
├── bootstrap/                  # Framework bootstrapping & service providers
├── config/                     # Application configurations (auth, database, sanctum)
├── database/                   # Migrations, seeders, factories, SQLite storage
│   └── migrations/             # 8 Idempotent Schema Migrations
├── docs/                       # Comprehensive Technical Documentation (10 Manuals)
├── public/                     # Web server root, assets, index.php
├── resources/                  # Server views, css, js
├── routes/                     # Application routing (api.php, console.php)
├── scripts/                    # DevOps scripts (diagnose.sh, auto-deploy.sh)
├── src/                        # Frontend Application (Next.js 15, React 19, Tailwind CSS v4)
│   ├── app/                    # App Router ((auth), (dashboard), layout, globals.css)
│   ├── components/             # Reusable UI primitives & app shell layout
│   ├── lib/                    # Axios API client singleton & formatters
│   └── types/                  # TypeScript contracts and DTO definitions
├── storage/                    # Framework caches, sessions, logs, file uploads
├── tests/                      # Automated Feature & Unit Test Suites (PHPUnit)
├── .dockerignore               # Docker build exclusions
├── .editorconfig               # Code style definitions
├── .env                        # Centralized full-stack environment variables
├── .env.example                # Example environment template
├── .gitattributes              # Git line endings
├── .gitignore                  # Comprehensive full-stack ignore rules
├── artisan                     # Laravel CLI runner
├── auto-deploy.sh              # Automated production deployment shell script
├── composer.json               # Backend PHP dependencies & autoloading
├── composer.lock               # PHP locked dependency graph
├── diagnose.sh                 # Environment diagnostics script
├── docker-compose.yml          # Containerized full-stack orchestration
├── Dockerfile                  # Unified multi-stage container build
├── next.config.mjs             # Next.js configuration & API rewrites
├── package.json                # Frontend & full-stack command scripts
├── phpunit.xml                 # Test runner configuration
├── pnpm-lock.yaml              # Frontend locked dependency graph
├── postcss.config.mjs          # Tailwind CSS v4 PostCSS configuration
├── README.md                   # Project documentation
└── tsconfig.json               # TypeScript configuration with @/* alias to ./src/*
```

---

## 🛠️ Quickstart Guide

### Option 1: Docker Compose (Production Ready)
```bash
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas
cp .env.example .env
php artisan key:generate
docker compose up -d --build
```
- **Web Interface**: `http://localhost:3000`
- **REST API**: `http://localhost:8000/api/v1`

### Option 2: Local Development Setup
```bash
# 1. Clone repository
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas

# 2. Install PHP and Node dependencies directly from root
composer install
pnpm install

# 3. Configure environment and database
cp .env.example .env
php artisan key:generate
php artisan migrate

# 4. Start full-stack development servers concurrently
pnpm run dev
```

- **Frontend Next.js**: `http://localhost:3000`
- **Backend API Laravel**: `http://localhost:8000`

---

## 🧪 Verification & Automated Testing

```bash
# Run all 35 PHPUnit backend feature & unit tests
pnpm test

# Run monorepo TypeScript verification
pnpm run typecheck

# Run frontend linting
pnpm run lint

# Build production Next.js bundle
pnpm run build
```

---

## 📚 Comprehensive Documentation Suite

Exhaustive technical manuals, schemas, and API contracts are available in [`docs/`](./docs/README.md):
- **[01. Project Overview & Vision](./docs/01-project-overview.md)**
- **[02. System Architecture & Monorepo Topology](./docs/02-system-architecture.md)**
- **[03. Technology Stack & Tooling](./docs/03-technology-stack.md)**
- **[04. Database Schema & ERD](./docs/04-database-schema-and-erd.md)**
- **[05. RESTful API Reference](./docs/05-api-documentation.md)**
- **[06. Core Functional Modules](./docs/06-core-modules.md)**
- **[07. Dedicated Examination Subsystem Manual](./docs/07-dedicated-examination-system.md)**
- **[08. Developer Guide & Contribution Handbook](./docs/08-developer-guide.md)**
- **[09. Deployment & DevOps Operations Manual](./docs/09-deployment-and-devops.md)**
- **[10. End-User Manual & Workflow Guide](./docs/10-user-guide.md)**

---

## ⚖️ License
Distributed under the [MIT License](LICENSE).
