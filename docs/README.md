# Tuntas — Comprehensive Technical Documentation

Official technical architecture, engineering specifications, API reference, and developer manuals for the **Tuntas** unified productivity and examination platform.

---

## Documentation Index

| # | Document | Primary Scope |
| :--- | :--- | :--- |
| **01** | **[Project Overview & Vision](./01-project-overview.md)** | Product vision, core problem statement, 11 functional domains, user personas. |
| **02** | **[System Architecture & Monorepo Topology](./02-system-architecture.md)** | C4 container topology, monorepo package boundaries, request lifecycle, ADRs. |
| **03** | **[Technology Stack & Tooling](./03-technology-stack.md)** | TypeScript 5.8, Next.js 15, React 19, Tailwind CSS v4, Laravel 12, pnpm, Composer. |
| **04** | **[Database Schema & ERD](./04-database-schema-and-erd.md)** | 3NF normalized schema, full Mermaid ERD, table data dictionary, indexes, constraints. |
| **05** | **[RESTful API Reference](./05-api-documentation.md)** | Complete endpoint catalog, request payloads, response envelopes, status codes. |
| **06** | **[Core Functional Modules](./06-core-modules.md)** | Deep-dive into Task, Project, Habit, Goal, LMS, Calendar, and Analytics engines. |
| **07** | **[Dedicated Examination Subsystem](./07-dedicated-examination-system.md)** | Autonomous assessment engine, anti-leak snapshots, autosync, proctoring, review guard. |
| **08** | **[Developer Guide & Handbook](./08-developer-guide.md)** | Prerequisites, local installation, dev commands, testing suites, coding standards. |
| **09** | **[Deployment & DevOps Manual](./09-deployment-and-devops.md)** | Docker Compose, environment configuration, Nginx, Systemd, backups & recovery. |
| **10** | **[End-User Manual & Guide](./10-user-guide.md)** | User walkthrough for all screens, workflows, and interactive capabilities. |
| **—** | **[UI/UX Design System](./07-ui-ux-design-system.md)** | Design tokens, typography, component specifications, responsive layouts, a11y. |

---

## Architectural Principles
1. **Monorepo Cohesion**: Unified codebase managed by pnpm workspaces linking `@tuntas/web`, `@tuntas/api`, `@tuntas/types`, and `@tuntas/ui`.
2. **Dedicated Examination Autonomy**: Examination systems operate with isolated models, anti-leak answer sanitization, and server-authoritative timer controls.
3. **Multi-Tenant Data Isolation**: Strict user-level authorization enforced at every controller boundary, rejecting cross-tenant mutations with `403 Forbidden`.
4. **Deterministic Calculation**: Progress bars and completion streaks are computed using verifiable SQL equations without client-side drift.
