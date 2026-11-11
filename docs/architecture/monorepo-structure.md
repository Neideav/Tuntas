# Monorepo Architecture & Technical Foundation

## 1. Overview & Directory Topology

Tuntas employs a unified monorepo architecture orchestrated via **pnpm workspaces** and **Laravel 12**.

```
Tuntas/
├── apps/
│   ├── api/                    # Laravel 12 Headless REST API & Core Domain Services
│   │   ├── app/
│   │   │   ├── Http/           # Controllers, FormRequests, Middleware
│   │   │   ├── Models/         # Eloquent ORM Models
│   │   │   └── Modules/        # Modular Subsystems (Tasks, Exams, Habits, LMS, etc.)
│   │   ├── bootstrap/          # App bootstrap & routing config (web, api, console)
│   │   ├── config/             # Framework & service configurations
│   │   ├── database/           # Migrations, seeders, factories
│   │   ├── routes/             # api.php (v1 REST), web.php, console.php
│   │   ├── tests/              # Feature & Unit PHPUnit test suites
│   │   └── composer.json
│   │
│   └── web/                    # Modern Cyberpunk Web Client (Vue 3 + Vite + Tailwind v4 + TS)
│       ├── src/
│       │   ├── assets/         # Static assets and icons
│       │   ├── components/     # Atomic Cyberpunk UI components
│       │   ├── layouts/        # Application shell layouts
│       │   ├── modules/        # Domain view modules (Dashboard, Tasks, Exams, etc.)
│       │   ├── router/         # Vue Router definition with 11 core routes
│       │   ├── services/       # Typed Axios API client
│       │   ├── stores/         # Pinia reactive state stores
│       │   └── style.css       # Tailwind v4 entry point importing @tuntas/ui
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   ├── types/                  # Central TypeScript DTOs, Enums, and Entity Interfaces
│   ├── ui/                     # Cyberpunk Dark Neon Theme tokens, colors, and primitives
│   └── tsconfig/               # Shared base, web, and node TypeScript configs
│
├── docs/                       # Comprehensive Architecture & System Documentation
│   ├── architecture/           # System design & structural specifications
│   ├── examination-system/     # Dedicated Examination Subsystem specifications
│   ├── api/                    # API contracts, routing, and conventions
│   └── database/               # Schemas, ER diagrams, and migrations
│
├── pnpm-workspace.yaml         # Monorepo workspace membership
├── package.json                # Root orchestration scripts
└── README.md
```

## 2. Architectural Boundaries & Dependency Rules

1. **One-Way Dependency Flow**:
   - `apps/web` depends on `packages/types`, `packages/ui`, and `packages/tsconfig`.
   - `packages/types` and `packages/ui` have ZERO dependencies on applications.
   - `apps/api` communicates with `apps/web` exclusively over versioned HTTP REST APIs (`/api/v1/...`).
2. **Dedicated Examination Subsystem**:
   - Autonomous bounded context inside `apps/api/app/Modules/Examination` and `apps/web/src/modules/examination`.
   - Distinct database tables (`question_banks`, `questions`, `exams`, `exam_sessions`, `exam_answers`).
   - Zero coupling to ordinary To-Do items.
3. **Strict Type Safety**:
   - Every domain contract is defined in `@tuntas/types`.
   - Zero `any` types permitted in production builds (`noImplicitAny: true`).

