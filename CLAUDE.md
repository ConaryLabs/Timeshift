# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Timeshift is a shift-scheduling platform replacing ScheduleExpress for 911 dispatch centers (starting with Valleycom, Kent WA). The goal is to generalize beyond Valleycom to support any shift-work organization.

- **Backend**: Rust (Axum 0.7 + SQLx 0.8 + PostgreSQL 18) at `backend/`
- **Frontend**: React 19 + TypeScript + Vite at `frontend/`
- **Multi-tenant**: Every table has `org_id` FK; JWT claims carry `org_id` for tenant isolation

## Common Commands

All commands run from the project root via `Makefile`:

```bash
make db-reset          # Drop and recreate database (native PostgreSQL)
make migrate           # Run SQLx migrations
make seed              # Load Valleycom seed data
make backend           # Run Axum server on :8080
make frontend          # Run Vite dev server on :5173
make test              # Run backend integration tests
make sqlx-prepare      # Regenerate offline query cache (run after any SQL changes)
```

After changing any SQL query in Rust code, always run `make sqlx-prepare` and commit the updated `backend/.sqlx/` directory.

### Running a single test

```bash
cd backend && DATABASE_URL="postgres://timeshift:timeshift_dev@127.0.0.1:5432/timeshift" \
  TEST_DATABASE_URL="postgres://timeshift:timeshift_dev@127.0.0.1:5432/timeshift" \
  cargo test test_name_here -- --nocapture
```

### Frontend linting

```bash
cd frontend && npm run lint
```

### Frontend build (includes TypeScript check)

```bash
cd frontend && npm run build
```

### Seed credentials

- Email: `admin@valleycom.org` / Password: `admin123`

## Backend Architecture

### Source layout (`backend/src/`)

- `main.rs` — Server entry, middleware (CORS, compression, tracing), rate limiting on login, route registration
- `lib.rs` — `AppState` (PgPool, jwt_secret, access_token_expiry_minutes, refresh_token_expiry_days, cookie_secure) with `FromRef` impl for extracting pool
- `config.rs` — `Config::from_env()` with validation (JWT_SECRET must be 32+ chars, no "change_me")
- `error.rs` — `AppError` enum mapping to HTTP status codes; custom `Result<T>` alias
- `auth/mod.rs` — `AuthUser` extractor (FromRequestParts), JWT Claims, Role enum with permission methods, `RefreshTokenCookie` extractor
- `org_guard.rs` — Helpers that verify a resource belongs to the user's org before operations
- `models/` — Request/response DTOs, DB row types, PG enum mappings
- `api/` — Route handlers organized by domain: auth, users, teams, shifts, schedule, leave, leave_balances, callout, classifications, organizations, coverage, trades, ot, bidding, vacation_bids, holidays, employee, reports

### Key patterns

**Auth flow**: Cookie-first with Bearer fallback. `AuthUser` extractor checks for `auth_token` HttpOnly cookie first, falls back to `Authorization: Bearer` header, then re-verifies user in DB (checks `is_active`, fetches current role). Refresh tokens stored in `refresh_tokens` table with HttpOnly `refresh_token` cookie. Three roles: `admin`, `supervisor`, `employee`.

**Multi-tenancy**: Every query filters by `org_id` from JWT claims. `org_guard::verify_*` functions return `NotFound` for resources in other orgs.

**Error handling**: `AppError` enum with variants for Unauthorized (401), Forbidden (403), NotFound (404), BadRequest (400), Validation (400 with field errors), Conflict (409), Database (constraint-aware), Internal (500). DB constraint violations 23505/23503 map to 409.

**Soft-delete**: Users use `is_active = false` instead of deletion. List queries filter by `is_active = true`.

**Nullable field updates**: Uses "double-Option" pattern — `None` means field not sent (keep existing), `Some(None)` means explicitly set null, `Some(Some(v))` means set value. SQL uses `CASE WHEN $provided THEN $value ELSE existing END`.

### SQLx gotchas

- NUMERIC columns: cast to FLOAT8 in SELECT (`CAST(hours AS FLOAT8)`); bind params as `$N::FLOAT8::NUMERIC`
- LEFT JOIN nullable columns require `AS "col?"` for sqlx to infer nullability
- UNIQUE constraints with COALESCE expressions: must use `CREATE UNIQUE INDEX` (not inline constraint)
- UUIDs must be hex-only (no letter prefixes)
- SQL ORDER BY cannot use column aliases; repeat the expression
- The `.sqlx/` offline cache is git-committed for CI reproducibility

### Testing

Integration tests live in `backend/tests/` with helpers in `tests/common/mod.rs`:
- `setup_test_app()` spins up a real Axum server on a random port
- Tests create isolated orgs via `create_test_org()` and clean up after
- Uses `TEST_DATABASE_URL` env var (same DB is fine for local dev)

## Frontend Architecture

### Source layout (`frontend/src/`)

- `api/client.ts` — Axios instance with 401 auto-logout (credentials included for HttpOnly cookies)
- `api/*.ts` — Per-domain API modules: auth, teams, users, shifts, schedule, schedulePeriods, leave, leaveBalances, callout, classifications, organization, coverage, trades, ot, bidding, vacationBids, employee, holidays, reports
- `store/auth.ts` — Zustand store: user profile only (no token — auth uses HttpOnly cookies), persisted to localStorage as `timeshift-auth`
- `store/ui.ts` — Zustand store: sidebar state + selected team/period, persisted as `timeshift-ui`
- `hooks/queries.ts` — React Query hooks + key factories for all API endpoints (~50 hooks)
- `hooks/usePermissions.ts` — Role-based access helpers
- `pages/` — LoginPage, DashboardPage, SchedulePage, DayViewPage, LeavePage, TradesPage, CalloutPage, VacationBidPage, BidPage, MyDashboardPage, MySchedulePage, MyProfilePage
- `pages/admin/` — ClassificationsPage, ShiftTemplatesPage, CoverageRequirementsPage, TeamsPage, TeamDetailPage, UsersPage, OTQueuePage, LeaveBalancesPage, SchedulePeriodsPage, SchedulePeriodDetailPage, VacationBidAdminPage, HolidayCalendarPage, ReportsPage, OrgSettingsPage
- `components/ui/` — shadcn/radix-ui component wrappers (Button, Input, Card, Table, Dialog, etc.)
- `components/layout/AppShell.tsx` — Main layout: collapsible sidebar + top bar + content area

### Key patterns

**State**: Zustand for client state (auth, UI preferences), React Query for server state (all API data). Query stale time: 30s. Mutations invalidate related query keys on success.

**Routing**: React Router 7. `RequireAuth` wrapper checks auth user. `RequireRole` guards admin-only routes. All pages are lazy-loaded with `React.lazy()` + `Suspense`.

**Styling**: Tailwind CSS 4 + shadcn/ui. Use `cn()` utility (clsx + tw-merge) for class composition. CSS variables define theme tokens in oklch color space.

**API environment**: `VITE_API_URL` defaults to `http://localhost:8080`. Production builds use `VITE_API_URL=""` for same-origin relative URLs (Caddy proxies `/api` to backend).

**Testing**: Vitest + Testing Library configured but no test files yet.

## Database Schema

12 migrations in `backend/migrations/` (0001–0012). Key tables:

- `organizations` — Multi-tenant root
- `users` — With `classification_id` FK, `employee_type_enum`, `is_active` soft-delete
- `classifications` — Org-specific job classifications (e.g., dispatcher, call-taker)
- `shift_templates` — Reusable shift definitions (name, start/end time, hours, color)
- `teams` — Org divisions with optional `supervisor_id`
- `shift_slots` — Recurring slots linking team + template + classification + days_of_week
- `scheduled_shifts` — Concrete shift instances on specific dates
- `schedule_periods` — Bid periods for slot assignments
- `slot_assignments` — Who holds a slot for a period (bid results)
- `assignments` — Who works a specific scheduled_shift (daily assignments)
- `leave_types` — Reference table (26 leave codes)
- `leave_requests` — Time-off requests with approval workflow
- `leave_balances` — Per-user leave hour balances
- `accrual_schedules` — Automatic leave accrual rules
- `accrual_transactions` — Leave balance change history
- `leave_request_lines` — Per-day leave request breakdown
- `callout_events` + `callout_attempts` — Callout process tracking
- `ot_hours` — OT tracking per user/fiscal_year/classification
- `ot_reasons` — Reasons for OT callout
- `ot_queue_positions` — OT queue ordering per classification
- `ot_volunteers` — Callout event volunteers
- `trade_requests` — Shift trade requests with approval workflow
- `coverage_requirements` — Min/target/max headcount per shift+classification+day
- `schedule_annotations` — Notes/alerts on schedule dates
- `bid_windows` + `bid_submissions` — Shift bidding windows and submissions
- `vacation_bid_periods` + `vacation_bid_windows` + `vacation_bids` — Vacation bid system
- `employee_preferences` — Per-user notification and view preferences
- `holiday_calendar` — Org holiday dates with premium pay flag
- `org_settings` — Key-value org configuration
- `refresh_tokens` — JWT refresh token storage
- `seniority_records` — Historical seniority tracking

PG enums: `app_role`, `employee_type_enum`, `leave_status`, `callout_status`, `trade_status`, `callout_step`, `bid_period_status`

## Conventions

- Rust edition 2021, requires Rust 1.93
- Axum 0.7 route params use `:id` syntax (not `{id}` — that's Axum 0.8+ with matchit 0.8+)
- `FromRequestParts` implementations require `#[async_trait]`
- Backend handlers extract `State(pool): State<PgPool>` via the `FromRef` impl on AppState
- Frontend uses `@/` path alias for imports from `src/`
- React Query hook naming: `useTeams()`, `useCreateTeam()`, `useUpdateTeam()`
- API modules export object literals with `list`, `get`, `create`, `update`, `delete` methods
- TypeScript union types for enums (e.g., `type Role = 'admin' | 'supervisor' | 'employee'`)
