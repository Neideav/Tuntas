# 03. Technology Stack & Tooling

## 1. Programming Languages & Runtime Environments

| Technology | Version | Purpose | Justification |
| :--- | :--- | :--- | :--- |
| **TypeScript** | `5.8.2` | Frontend Presentation & Packages | Guarantees compile-time type safety across UI components, API DTOs, and event payloads with zero runtime overhead. |
| **Node.js** | `>=20.x` LTS | Frontend Build & Runtime | Modern JavaScript engine with native Fetch, ESM module support, and high build performance. |
| **PHP** | `8.3.x` | Backend Server Engine | Features typed properties, readonly classes, JIT compilation, enums, and native fiber support for high-throughput API responses. |

---

## 2. Frameworks & Core Libraries

### A. Frontend Tier (`@tuntas/web`)
* **Next.js 15.5 (App Router)**: Hybrid static site generation (`SSG`) and server-side rendering (`SSR`) with nested layout grouping `(auth)` and `(dashboard)`.
* **React 19.0**: Concurrent rendering engine with enhanced transitions and React Server Components.
* **Tailwind CSS v4.0**: High-performance utility-first styling engine with native CSS cascade layer support and custom color tokens (`primary`, `neutral`, `success`, `warning`, `danger`).
* **Lucide React (`0.475`)**: Consistent, accessible iconography across all navigation, action, and indicator components.
* **Axios (`1.11`)**: Enterprise HTTP client featuring interceptor pipelines for automated token injection and status code interception.
* **date-fns (`4.1`)**: Lightweight, immutable date arithmetic utility for calendar calculations and relative deadline strings.
* **tailwind-merge & clsx**: Dynamic class name conflict resolution for composable UI primitives.

### B. Backend Tier (`@tuntas/api`)
* **Laravel 12.x**: Premier PHP web framework utilized in headless API mode.
* **Laravel Sanctum**: Lightweight bearer token issuing, management, and revocation for SPA and API authentication.
* **Eloquent ORM**: Object-relational mapping supporting eager loading (`with(...)`), model events, and query scopes.
* **PHPUnit 11.5 / Pest**: Automated testing framework powering unit, feature, and security verification suites.

### C. Shared Monorepo Packages
* **`@tuntas/types`**: Shared TypeScript definitions ensuring synchrony between backend API contracts and frontend views.
* **`@tuntas/ui`**: Shared design tokens and Tailwind utility configurations.
* **`@tuntas/tsconfig`**: Shared base TypeScript compiler options enforcing strict null checks and modern module resolution.

---

## 3. Package Management & Build Tooling

* **pnpm 12 (Workspace Monorepo)**:
  - Hard-linked content-addressable storage saving disk space and speeding up CI/CD install times.
  - Workspace protocol (`workspace:*`) enabling zero-copy symlinked internal dependencies.
* **Composer 2.8**:
  - PHP dependency management with classmap optimization (`composer dump-autoload -o`) for high production throughput.
* **Turbopack & Next.js Compiler**:
  - Rust-based fast bundling engine powering instantaneous Hot Module Replacement (`HMR`) during development.

---

## 4. Database & Storage Architecture

### A. SQLite 3 with Write-Ahead Logging (WAL)
* **Default Configuration**: Embedded zero-configuration relational database ideal for development, testing, and single-instance production deployments.
* **Performance Enhancements**: WAL mode (`PRAGMA journal_mode=WAL;`) allows concurrent reads while writes are occurring without locking readers.

### B. PostgreSQL 14+ Compatibility
* **Production Scale**: All migrations and queries adhere strictly to ANSI SQL / Eloquent standards, enabling seamless connection switching to PostgreSQL for enterprise clusters without application code modification.

---

## 5. Infrastructure & Containerization

* **Docker & Docker Compose**:
  - Multi-stage container builds minimizing image sizes (`alpine` base images).
  - Isolated bridge network (`tuntas-network`) securing communication between frontend and backend.
  - Persistent volume mounts for database data (`api-db`) and file storage (`api-storage`).
* **Process Management**:
  - PHP-CLI built-in server for rapid development (`php artisan serve`).
  - PHP-FPM / Nginx reverse proxy architecture for high-load production workloads.

