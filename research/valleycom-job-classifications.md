# Valleycom Job Classifications

**Source:** ScheduleExpress schedule views and coverage grid, Feb 2026
**Status:** Observed classifications only — formal titles and union contract definitions needed

---

## Observed Job Categories

These appear in SE's "Job Category" column (Week view) and Coverage Grid rows.

| Code | Full Title | Coverage Tracked | Notes |
|------|-----------|-----------------|-------|
| `A Supervisor` | Supervisor | Yes (Max: 4, Min: 1 per day) | Management / lead on shift |
| `B Dispatcher` | Dispatcher | Yes (Max: 13, Min: 10 per day) | Primary dispatch role |
| `C Call Receiver` | Call Receiver / Telecommunicator | Yes (Max: 11, Min: 8 per day) | Call intake role |
| `Exclude` | Excluded | No (Max: *, Min: *) | Not counted in coverage; exact definition unknown |
| `Other` | Other | No (Max: *, Min: *) | Catch-all |

> The A/B/C prefix appears to be a seniority or classification tier system.
> These are the classifications that appear in the union contract / civil service job descriptions.

---

## Coverage Requirements (observed from Coverage Grid)

These are the per-day headcount targets observed in the Coverage Grid view.
> **Warning:** The Max values (~4, 13, 11) seem lower than the actual daily totals (~5-7, 24-30, 22-28).
> This may indicate Max/Min are per-shift-slot rather than per-day totals.
> 24/7 operation with multiple overlapping shifts would explain the discrepancy.
> **Needs confirmation from a supervisor-level account or the admin configuration.**

| Category | Max | Min |
|----------|-----|-----|
| A Supervisor | 4 | 1 |
| B Dispatcher | 13 | 10 |
| C Call Receiver | 11 | 8 |

---

## Special Assignment / Training Designations

These appear as shift labels or info codes in the Dashboard "SA/TG" sections.
SA/TG = Special Assignments / Training Group

| Code | Observed Label | Notes |
|------|---------------|-------|
| `PD TRNG` | PD Training | Police Dispatch training? Pre-deployment training? |
| `Trainee PD Dispatch` | Trainee PD Dispatch | Employee in training for PD dispatch role |
| `CR Acad` | CR Academy | Call Receiver academy (new hire training) |
| `Training Supervisor` | Training Supervisor | Supervisor specifically assigned to training duty |
| `ACCESS` | ACCESS | Unknown — appears on personal schedule. Access to another system/role? |
| `CTO` | Compensatory Time Off | Scheduled CTO block |
| `PD TR` | PD Training (short) | Same as PD TRNG? |

---

## OT Callout Positions

From the Available OT list, positions used when posting OT opportunities:
- `B Dispatcher`
- `C Call Receiver`

Note: A Supervisor OT may be handled differently (not seen in available OT list during observation window).

---

## Implications for Timeshift Schema

### Job Category needs to be a DB table, not an enum
To support Valleycom and future orgs:

```sql
CREATE TABLE job_categories (
    id          UUID PRIMARY KEY,
    org_id      UUID REFERENCES orgs(id),
    code        TEXT NOT NULL,      -- "A_SUPERVISOR", "B_DISPATCHER"
    label       TEXT NOT NULL,      -- "A Supervisor", "B Dispatcher"
    sort_order  INT NOT NULL,       -- display order in schedule view
    color       TEXT,               -- optional color for schedule view
    is_active   BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (org_id, code)
);
```

### Coverage requirements table
```sql
CREATE TABLE coverage_requirements (
    id              UUID PRIMARY KEY,
    org_id          UUID REFERENCES orgs(id),
    job_category_id UUID REFERENCES job_categories(id),
    effective_date  DATE NOT NULL,   -- requirements can change over time
    min_headcount   INT NOT NULL,
    max_headcount   INT,             -- null = no upper limit
    UNIQUE (org_id, job_category_id, effective_date)
);
```

---

## Open Questions

- [ ] What does the A/B/C prefix mean exactly in the union contract?
- [ ] Are there other classifications not visible from an employee account?
- [ ] Is `Exclude` for employees on LWOP/LOA, or a permanent classification?
- [ ] Are coverage min/max values per-shift or per-day?
- [ ] What is the difference between B Dispatcher and C Call Receiver in terms of duties?
- [ ] Do supervisors (A) appear on the OT callout list, or is their OT handled separately?
