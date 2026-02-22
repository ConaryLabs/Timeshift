# ScheduleExpress UX — Feature Map

**Source:** Employee-level account (Peter Permenter) at Valley Communications (Valleycom), Kent WA
**Observed:** February 19, 2026
**SE Version:** SafeCities™ ScheduleExpress 2003-2023

---

## Navigation Structure

### Top-Level Nav Items
- **Requests** (dropdown)
- **Reports** (dropdown)
- **Schedule Management** (dropdown)
- **Bidding** (dropdown)
- **My Messages** (shows unread count badge)
- **My Schedule**
- **My Profile**

---

## Requests Menu

### Trades
- **My Trades** — `tradeView.do` — view your trade history
- **Create Trade Request** — `tradeCreate.do` — offer one of your shifts for trade
- **View Available Trades** — `tradeAvailableList.do` — browse open trade offers from others

### Absences
- **My Absences** — `absenceView.do` — list of all your absence requests with status
- **Create Absence Request** — `absenceCreate.do` — two-step form (pick date range → continue)

  The absence create form title is **"Absence Request / Prior-Approval"**, and the buttons are:
  - `Continue w/RDO` — continue including Regular Days Off in the date range
  - `Continue` — continue excluding RDOs
  - `Reset`, `Close`

  This implies two distinct flows:
  - **Prior-Approval** — planned leave that requires supervisor sign-off
  - **Reported** — unplanned absences (sick calls etc.) that are just reported, not approved

### OT Assignments
- **My OT Assignments** — `overtimeAssignView.do` — your assigned overtime
- **User Overtime Request** — `overtimeUserRequest.do` — request a specific OT slot
- **Volunteered Overtime** — `overtimeVolunteered.do` — flag yourself as available for OT calls
- **View Available OT** — `overtimeAvailableList.do` — browse open OT opportunities

### Other
- **My Notes** — personal notes (employee-visible only)
- **My Special Assignments** — view special assignment schedule

---

## Schedule Management Menu

- **Manage Locations** — `locationList.do`
- **View Schedule** — `scheduleView.do` — main schedule grid (supervisor view)
- **View Coverage Exceptions** — `scheduleCoverageList.do`
- **View Schedule Coverage** — `coverageGridView.do` — coverage requirements vs actual
- **View Coverage Assignment** — `coverageAssignmentView.do`
- **View Duty Assign By Requirement** — `positionAssignmentView.do`
- **View Duty Assign by User** — user-centric duty assignment view

---

## Bidding Menu

- **Bid on Vacation** — `vacationBiddingRoundUserBids.do`
- **Bid on Shifts** — `shiftBiddingUpcomingView.do`

---

## Page Details

### Personal Schedule (`personalSchedule.do`)
Monthly calendar view for the logged-in employee.

- Location shown in header: "Location: Communications"
- `Prev` / `Next` month navigation, `Select Date` datepicker
- `Duty Assignments` button
- Each day cell shows shift time blocks with status badges:
  - `(OT)` — overtime
  - `(AB)` — absence
  - `ACCESS` — special assignment type
- Times in 24h format: `1000-1200`, `1200-2200`, `0800-1000`
- Multiple entries per day possible (different shifts)
- Today's date is highlighted differently
- Some dates show two shifts (split day, or multiple roles)

---

### My Absences (`absenceView.do`)
Three sections:

1. **Pending Absence Requests** — awaiting supervisor review
2. **Approved Absence Requests** — list with columns: From Date, To Date, Absence Reason, Status, Actions
3. **Declined Absence Requests**

Status values seen: `APPROVED`, `REPORTED`

> Note: `REPORTED` appears on sick/unplanned absences — they don't go through an approval flow, they are simply reported. Only planned leave shows `APPROVED`/`DECLINED`.

Absence reason codes seen in the list:
- `Sick`
- `FCL Vacation`
- `BID Vacation`
- `FCL Sick`

(See [valleycom-leave-types.md](./valleycom-leave-types.md) for full list)

---

### Available Overtime (`overtimeAvailableList.do`)
Tabular view of open OT opportunities.

**Columns:** Date, Time, ReqDate (when the OT was posted), Position, Location, UnFilled, Filled

**Legend at top:**
- `*` = Queued Overtime
- `!` = Flagged
- `$` = Deferred

**Positions seen in the list:**
- `B Dispatcher`
- `C Call Receiver`

**UnFilled column format:** `1000-1200(2)` — time range plus count of open slots
**Location:** Communications (the dispatch floor location)

Some entries show `OT - out of Com R...` in the Location field — full label is "OT - out of Com Room" (a location, not a rotation).

**Volunteer action:** Each row has a "Volunteer" link (JavaScript onclick).
Clicking it registers the employee as a volunteer for that specific OT slot.
Grid data loaded from `overtimeAvailableData.do` (separate JSON/data endpoint).

---

### Volunteered Overtime (`overtimeVolunteered.do`)
List of the employee's active volunteer registrations. No create form here —
volunteering happens from the Available OT list.

**Columns:** Day, Time, Valid Period, Location, Notes
**Actions:** Checkbox select → Delete Selected (to withdraw volunteer request)

Volunteer entries show the date range during which the volunteer registration is valid.

---

### Schedule View — Month (`scheduleView.do?view=month`)
All employees × all days grid.

- Row per employee, column per day
- Each cell shows shift time(s) with status codes
- Bottom row: **Total Scheduled Resources** count per day
- Colors used to differentiate shift types

**Status badge codes on shifts:**
| Code | Meaning |
|------|---------|
| `(OT)` | Overtime |
| `(AB)` | Absence |
| `(TR)` | Trade |
| `(TA)` | Temp Assignment |
| `(MC)` | Managed Coverage |
| `PD TR` | PD Training (Partially?) |
| `ACCESS` | Special assignment type |
| `CTO` | Compensatory Time Off |

---

### Schedule View — Week (`scheduleSummaryView.do?view=week`)
Same as Month view but adds a **Job Category** column between Name and date columns.

Job categories seen:
- `A Supervisor`
- `B Dispatcher`

---

### Schedule View — Day (`scheduleView.do?view=day`)
**Gantt chart** — horizontal timeline with 30-minute column increments (00, 30 past each hour).

- Rows: each employee + their job category
- Each shift shown as a colored horizontal bar spanning its time range
- Bar labels: shift type code (`Absence`, `Overtime`, `PD TRNG`, `Trainee PD Dispatch`, etc.)
- Today (Thu 19) view showed time range scrolling from 0000 to beyond 1030

**Bottom summary rows (critical for coverage tracking):**
| Row | Description |
|-----|-------------|
| Total Scheduled Resources | Count of staff on shift each half-hour slot |
| Overtime Slots Available | Open OT positions per slot |
| OT Volunteers Available | Employees who volunteered for OT per slot |

Special assignment info visible on shift bars: `CR Acad` (Communications Room Academy?), `Training Supervisor`, `PD TRNG`, `Trainee PD Dispatch`

---

### Dashboard (`scheduleDashboardView.do?view=dash`)
Today's full roster, grouped into collapsible sections.

**Section structure (with counts like `0/75`):**
1. **Total** — everyone scheduled today
2. **Shifts (MC)** — main scheduled staff (breakdown by name, date, hours, info, location)
3. **SA/TG In Coverage** — Special Assignments / Training Group who ARE in coverage
4. **Trades (working)** — employees working a traded shift
5. **Not in Coverage** (section header)
   - **SA/TG Not in Coverage** — special assignments not providing coverage
   - **Absences** — all absences today, with leave type codes

Has an `Hour Range` filter (default `00-24`) and `Refresh` button.
`Open All Compact Views` / `Minimize All Compact Views` toggle buttons.

---

### Coverage Grid (`coverageGridView.do`)
**Month/Week/Day views available.**

Shows per-job-category staffing vs defined min/max requirements.

**Columns:** One per day (Month view) or one per day-of-week (Week view)
**Rows (Coverage Requirements):**
| # | Category | Max (observed) | Min (observed) |
|---|----------|---------------|---------------|
| 1 | A Supervisor | 4 | 1 |
| 2 | B Dispatcher | 13 | 10 |
| 3 | C Call Receiver | 11 | 8 |
| 4 | Exclude | * | * |
| 5 | Other | * | * |

Each cell shows the actual scheduled count for that category on that day.
**Red highlighting** = value is outside the acceptable range (over max or under min — behavior needs confirmation).

> Note: Actual daily totals for B Dispatcher (~24-30) exceed the Max (13), suggesting the Max may represent per-shift headcount rather than total daily headcount, since Valleycom runs 24/7 with overlapping shifts.

---

## Key Design Insights for Timeshift

1. **Two absence flows:** Reported (sick, no approval) vs Prior-Approval (planned leave, needs sign-off)
2. **Job categories are first-class:** Coverage counting is by category, not just total headcount
3. **Coverage requirements are configured:** Min/max per category per schedule — must be stored in DB
4. **OT has two dimensions:** Mandatory callout (supervisor-initiated) vs Volunteered (employee opt-in)
5. **Trades are a distinct workflow** from both leave and OT
6. **Bidding is a separate system** for vacation and shift selection — lower priority
7. **Day Gantt view** with per-slot coverage counts is a heavily-used operational view
8. **Dashboard** is the "what's happening right now" view supervisors likely use most
9. **SA/TG** (Special Assignments / Training Group) is a distinct category that shows separately in dashboard
