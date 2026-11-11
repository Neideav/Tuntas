# 08. Developer Guide & Contribution Handbook

## 1. Prerequisites & System Requirements

Ensure the following runtimes and package managers are installed on your host machine:

| Software | Minimum Version | Recommended | Verification Command |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.x` LTS | `v22.x` | `node -v` |
| **pnpm** | `v9.x` | `v10.x` or `v12.x` | `pnpm -v` |
| **PHP** | `8.2.x` | `8.3.x` | `php -v` |
| **Composer** | `2.5.x` | `2.8.x` | `composer -v` |
| **Git** | `2.38+` | Latest | `git --version` |
| **SQLite / PostgreSQL** | SQLite 3.35+ | PostgreSQL 14+ | `sqlite3 --version` |

---

## 2. Installation & Local Setup

### Step 1: Clone Repository
```bash
git clone https://github.com/Neideav/Tuntas.git
cd Tuntas
```

### Step 2: Install Node.js Monorepo Dependencies
```bash
pnpm install
```

### Step 3: Configure & Initialize Backend
```bash
cd apps/api

# Install PHP dependencies
composer install

# Copy environment configuration
cp .env.example .env

# Generate application encryption key
php artisan key:generate

# Run schema migrations
php artisan migrate

# Return to root
cd ../..
```

### Step 4: Configure Frontend Environment
```bash
cp apps/web/.env.example apps/web/.env.local
```

---

## 3. Development Commands

From the monorepo root:

| Command | Action |
| :--- | :--- |
| `pnpm run dev` | Concurrently boots both Laravel API (`:8000`) and Next.js (`:3000`) with colorful prefix logs. |
| `pnpm run dev:web` | Starts Next.js development server only at `http://localhost:3000`. |
| `pnpm run dev:api` | Starts Laravel Artisan server only at `http://localhost:8000`. |
| `pnpm run typecheck` | Executes TypeScript type checking across all workspace packages (`tsc --noEmit`). |
| `pnpm run lint` | Runs code quality verification across frontend and shared packages. |
| `pnpm run build` | Compiles production bundle for Next.js web application. |
| `pnpm test` | Executes PHPUnit automated test suite for backend API. |

---

## 4. Testing & Verification

### Running All Backend Tests
```bash
cd apps/api
php artisan test
```

### Running Targeted Test Suites
```bash
# Security & multi-tenant isolation tests
php artisan test --filter SecurityAndAccessControlTest

# System integration & cross-module tests
php artisan test --filter SystemIntegrationTest

# Dedicated examination engine tests
php artisan test --filter DedicatedLearningAndExamTest
```

---

## 5. Coding Conventions & Best Practices

### A. TypeScript Guidelines (`apps/web` & `packages/*`)
- **Strict Typing**: Always declare explicit types for props, state, and API responses. Avoid `any`.
- **Imports**: Group imports: React/Next.js first, third-party libraries second, internal components third, types last.
- **Component Anatomy**:
  - Keep presentation components clean; extract complex calculations to helper utilities in `src/lib/`.
  - Use Tailwind CSS utility classes; avoid custom inline `style` objects.

### B. PHP / Laravel Guidelines (`apps/api`)
- **Thin Controllers, Rich Models**: Keep controllers focused on request validation, calling domain scopes/services, and returning JSON responses.
- **Tenant Scope Rule**: Never query user data without filtering by `$request->user()->id`.
- **Eager Loading**: Always eager load relationships (`with(['category', 'subtasks', 'tags'])`) to prevent N+1 query regressions.

---

## 6. Contribution Workflow

1. **Branch Naming**:
   - `feat/feature-name` (e.g. `feat/kanban-drag-drop`)
   - `fix/bug-description` (e.g. `fix/habit-streak-freeze`)
   - `docs/topic-name` (e.g. `docs/api-contracts`)
2. **Commit Conventions**: Conventional Commits standard (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`, `test: ...`).
3. **Pull Request Checklist**:
   - [ ] `pnpm run typecheck` passes with 0 errors.
   - [ ] `pnpm run lint` passes cleanly.
   - [ ] `pnpm test` passes 100% of test assertions.
   - [ ] `pnpm run build` succeeds without bundle errors.

