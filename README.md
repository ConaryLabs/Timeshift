# Timeshift

Shift scheduling for 911 dispatch centers — and any shift-work organization that needs more than a generic calendar.

Timeshift is a modern replacement for [ScheduleExpress](https://www.scheduleexpress.com/), built from the ground up for organizations with complex scheduling rules: union contracts, seniority-based overtime callout queues, multi-round vacation bidding, and 24/7 coverage requirements.

**Current deployment:** [Valley Communications Center](https://www.valleycom.org/), Kent WA (Valleycom) — a King County 911 dispatch center serving 14 cities.

---

## Why Timeshift?

ScheduleExpress and generic tools (Deputy, When I Work) don't handle the specific rules that govern public safety dispatch scheduling:

| Need | Generic tools | Timeshift |
|------|--------------|-----------|
| OT callout queue (seniority/rotation order) | ❌ | ✅ |
| Seniority-based shift bidding | ❌ | ✅ |
| Two-round vacation bid windows | ❌ | ✅ |
| Union contract leave codes (26 types) | ❌ | ✅ |
| Leave sellback & sick leave donation | ❌ | ✅ |
| Classification-based coverage requirements | ❌ | ✅ |
| Multi-org / multi-tenant | varies | ✅ |
| Self-hostable, open stack | ❌ | ✅ |

---

## Features

### For employees
- **Unified schedule** — personal shifts, team schedule, and staffing levels in one view (day/week/month)
- **Leave requests** — 26 leave type codes, per-day breakdown, approval workflow
- **Leave sellback** — sell accrued leave hours back to the org
- **Sick leave donation** — donate leave to colleagues in need
- **Shift trades** — request trades with supervisor approval
- **Overtime** — view available OT slots and volunteer; see your OT history
- **Vacation bidding** — participate in seniority-ordered bid windows
- **Notifications** — in-app alerts for approvals, callouts, and schedule changes

### For supervisors & admins
- **Unified schedule** — day/week/month views with staffing block grid (2-hour × classification heatmap), sortable columns, integrated duty board tab, and slide-out action panel for gap resolution
- **Coverage alerts** — topbar warnings when shifts are understaffed
- **Callout management** — initiate OT callout events; system tracks queue order
- **OT queue** — fair-rotation queue per classification (seniority/last-called ordering)
- **Leave approval** — review and approve/deny leave requests
- **Vacation bid administration** — configure windows, run bid rounds
- **Reports** — coverage analysis, OT summary, OT by period, leave usage, work summary (all CSV-exportable)

### For administrators
- **Multi-org** — full tenant isolation; every org has its own data
- **Shift templates** — reusable shift definitions with name, times, hours, color
- **Shift patterns** — recurring rotation schedules
- **Coverage plans** — min/target/max headcount per shift and classification
- **Teams** — org divisions with supervisor assignment and member display (auto-populated from slot assignments)
- **Bid periods** — configure shift bid windows and slot assignments
- **Classifications** — job roles/grades with coverage rules
- **Bargaining units** — configurable per-org (not hardcoded)
- **Holiday calendar** — org-specific holidays with premium pay flag
- **Leave balances** — manage per-user balances and accrual schedules
- **Org settings** — timezone, fiscal year start, pay period type, bid cycle length
- **Special assignments** — track temporary role changes

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Rust · Axum 0.7 · SQLx 0.8 |
| Database | PostgreSQL 18 |
| Frontend | React 19 · TypeScript · Vite |
| State | Zustand (client) · React Query (server) |
| UI | Tailwind CSS 4 · shadcn/ui · Radix |
| Auth | JWT (HttpOnly cookies) + refresh tokens |
| Deploy | Caddy reverse proxy · systemd |

---

## Quickstart

### Prerequisites

- Rust (1.93+) — [rustup.rs](https://rustup.rs)
- `sqlx-cli` — `cargo install sqlx-cli --no-default-features --features postgres`
- Node.js 20+
- PostgreSQL 18 (native or via Docker)

### 1. Clone and configure

```bash
git clone https://github.com/yourorg/timeshift
cd timeshift
cp .env.example .env
```

Edit `.env` and set a real `JWT_SECRET` (must be 32+ chars, must not contain "change_me"):

```bash
# Generate a secure secret:
openssl rand -hex 32
```

### 2. Start the database

**Docker (recommended for local dev):**
```bash
docker compose up -d
```

**Native PostgreSQL:**
```bash
sudo -u postgres createuser --pwprompt timeshift
sudo -u postgres createdb --owner=timeshift timeshift
```

### 3. Migrate and seed

```bash
make migrate        # Run database migrations
make seed           # Load Valleycom demo data
```

### 4. Run

```bash
make backend        # Axum API on :8080
make frontend       # Vite dev server on :5173
```

Open [http://localhost:5173](http://localhost:5173).

### Demo credentials

All accounts use password `admin123`:

| Role | Email | Classification |
|------|-------|---------------|
| Admin | `admin@valleycom.org` | Supervisor |
| Supervisor | `sarah.chen@valleycom.org` | Supervisor (VCSG) |
| Employee | `mike.johnson@valleycom.org` | COII (VCCEA) |
| Employee | `lisa.park@valleycom.org` | COI (VCCEA) |
| Employee | `james.rivera@valleycom.org` | COII (VCCEA) |

---

## Project Structure

```
timeshift/
├── backend/            # Rust Axum API
│   ├── src/
│   │   ├── api/        # Route handlers (auth, users, shifts, leave, ot, …)
│   │   ├── models/     # Request/response DTOs and DB row types
│   │   ├── auth/       # JWT, AuthUser extractor, role permissions
│   │   └── ...
│   ├── migrations/     # SQLx migrations (0001–0057)
│   ├── seeds/          # Valleycom demo data
│   └── tests/          # Integration tests (real DB, isolated orgs)
├── frontend/           # React + TypeScript + Vite
│   └── src/
│       ├── api/        # Per-domain API modules
│       ├── pages/      # Route-level page components
│       ├── hooks/      # React Query hooks (~110 hooks)
│       ├── store/      # Zustand stores (auth, UI)
│       └── components/ # UI components (shadcn/radix wrappers + layout)
├── research/           # Domain research: union contracts, SE analysis, SOPs
├── Makefile            # Common dev commands
└── docker-compose.yml  # PostgreSQL for local dev
```

---

## Development

After changing any SQL query in Rust code, regenerate the offline query cache:

```bash
make sqlx-prepare
```

Commit the updated `backend/.sqlx/` directory — it's used for CI builds without a live database.

**Run a single test:**
```bash
cd backend && DATABASE_URL="postgres://timeshift:timeshift_dev@127.0.0.1:5432/timeshift" \
  TEST_DATABASE_URL="postgres://timeshift:timeshift_dev@127.0.0.1:5432/timeshift" \
  cargo test test_name_here -- --nocapture
```

**Frontend checks:**
```bash
cd frontend && npm run lint
cd frontend && npm run build   # includes TypeScript check
```

---

## Multi-tenancy

Every database table includes an `org_id` foreign key. JWT tokens carry `org_id` in their claims. All queries filter by the authenticated user's org — orgs are fully isolated with no shared data.

---

## Research

The `research/` directory contains the domain research that informed this project: union contract rules (VCCEA 2025-2027, VCSG 2025-2026), ScheduleExpress feature analysis, Valleycom SOPs, shift patterns, leave types, and OT callout procedures. This context is useful for understanding why the data model is shaped the way it is.

---

## License

[To be determined]
