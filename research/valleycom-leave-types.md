# Valleycom Leave / Absence Types

**Source:** ScheduleExpress absence lists, dashboard view, and absence create step 2 form, Feb 2026
**Status:** Observed codes only — formal definitions from HR/union contract still needed

---

## Absence Create Dropdown — Complete Leave Code List

These are the exact options in the "Time off to be carried as" dropdown on the Absence Create step 2 form.
This is the most authoritative list — it reflects every leave type employees can actually submit.

| # | Label in SE | Category | Notes |
|---|-------------|----------|-------|
| 1 | `Sick` | Leave / Reported | No approval needed |
| 2 | `FMLA Sick` | Leave / Reported | FMLA-coded sick call |
| 3 | `PFML` | Leave | WA State Paid Family Medical Leave |
| 4 | `FCL Comp` | Leave | Family Care Leave — Comp Time variant |
| 5 | `FCL Holiday` | Leave / System | Family Care Leave — Holiday variant |
| 6 | `FCL Sick` | Leave / Reported | Family Care Leave — Sick variant |
| 7 | `FCL Vacation` | Leave | Family Care Leave — Vacation variant |
| 8 | `BID Vacation` | Leave | Vacation awarded through bid process |
| 9 | `Comp first - Vac second` | Leave | Splits hours: Comp Time first, then Vacation |
| 10 | `Vacation` | Leave | Standard vacation leave |
| 11 | `Comp Time` | Leave | Compensatory time off |
| 12 | `Non Guaranteed Holiday` | Leave / System | Holiday worked / not granted |
| 13 | `Guaranteed Holiday` | Leave / System | Scheduled/granted holiday |
| 14 | `Emergency Leave` | Leave | Emergency leave |
| 15 | `No Show` | Leave | Employee no-showed (unexcused?) |
| 16 | `Admin Leave` | Leave | Administrative leave |
| 17 | `Bereavement` | Leave | Bereavement — triggers relationship/name fields |
| 18 | `Jury Duty` | Leave / Reported | Court-ordered |
| 19 | `L&I Sick` | Leave | Labor & Industries (workers comp) sick |
| 20 | `Leave of Absence` | Leave | General LOA |
| 21 | `LWOP` | Leave | Leave Without Pay |
| 22 | `Maternity` | Leave | Maternity leave |
| 23 | `Military` | Leave | Military leave |
| 24 | `RDO Absence` | System | **Default pre-selected** — Regular Day Off absence |
| 25 | `Trade Made` | System | Absence recorded because a trade was accepted |
| 26 | `Unpaid Holiday` | Leave | Employee taking unpaid holiday |

> Note: `RDO Absence` is pre-selected by default when using "Continue w/RDO" flow.
> `Trade Made` confirms that the absence system and trade system are linked.

---

## Codes Seen in Dashboard / Absence List (cross-reference)

These codes were observed in the dashboard Absences section or My Absences list.
Some differ in format from the dropdown labels above — SE appears to use different display strings in different contexts.

| SE Code (dashboard) | Maps to dropdown label | Notes |
|---------------------|----------------------|-------|
| `Sick` | Sick | |
| `FCL Sick` | FCL Sick | |
| `SICK-Sick` | Sick | Different code format — same type |
| `VACTON` | Vacation | |
| `FCL Vacation` | FCL Vacation | |
| `BID Vacation` | BID Vacation | |
| `Comp` | Comp Time | |
| `CTO` | Comp Time | Same type, different code? |
| `BEREAV` | Bereavement | |
| `LWOP` | LWOP | |
| `LOA` | Leave of Absence | |
| `PFML` | PFML | |
| `FMLA` | (not in dropdown?) | Federal FMLA — may be admin-entered |
| `FMLASK` | FMLA Sick | |
| `Jury` | Jury Duty | |
| `G-HOL` | Guaranteed Holiday | |
| `Non G-HOL` | Non Guaranteed Holiday | |
| `TRAIN` | (not in dropdown) | Training — may be admin-entered |
| `STAFF-Staffing` | (not in dropdown) | Admin/system staffing entry |
| `C/V` | Comp first - Vac second? | Definition still needed |
| `FCL HL` | FCL Holiday | |

---

## Unknown / Needs Clarification

### FCL — RESOLVED
**FCL = Family Care Leave** (Washington State).
Appears as a prefix on Comp, Vacation, Sick, and Holiday codes — these are leave types
taken under the Family Care Leave umbrella. Also appears as its own standalone OT reason code.

### C/V
Appears frequently in the dashboard absences section.
Best guess: "Comp first - Vac second" (matches the dropdown option).
- **Action needed:** Confirm with Valleycom

---

## Two Absence Flows

### Reported Absences
- Employee calls in (sick, jury duty, bereavement, no show)
- No supervisor pre-approval required
- Status in SE: `REPORTED`
- Timeshift model: `requires_approval = false`, auto-status = `reported`

### Prior-Approval Absences
- Employee submits request in advance
- Supervisor approves or denies
- Status in SE: `APPROVED` / `DECLINED` / `PENDING`
- Timeshift model: `requires_approval = true`, goes through approval workflow
- SE form title: "Absence Request / Prior-Approval"
- Has special `Continue w/RDO` option — includes Regular Days Off in the leave span

---

## Split Absence — Key Feature

The absence step 2 form supports **up to 5 leave type + hours pairs per day**.
This means an employee can split a shift across multiple leave types, e.g.:
- 12 hrs Vacation + 12 hrs Comp Time
- Or use the dedicated `Comp first - Vac second` code which handles the split automatically

This is important for Timeshift: a single absence day can have multiple leave type segments.

---

## Implications for Timeshift Schema

The current `leave_type` enum in Timeshift needs to be replaced or supplemented with:

**Option A — Configurable DB table (recommended for multi-org)**
```sql
CREATE TABLE leave_types (
    id                UUID PRIMARY KEY,
    org_id            UUID REFERENCES orgs(id),  -- null = system default
    code              TEXT NOT NULL,             -- "SICK", "VACTON", etc.
    label             TEXT NOT NULL,             -- "Sick", "Vacation"
    requires_approval BOOLEAN NOT NULL DEFAULT true,
    is_reported       BOOLEAN NOT NULL DEFAULT false, -- true = no approval, just reported
    is_active         BOOLEAN NOT NULL DEFAULT true
);

-- For split absences:
CREATE TABLE absence_leave_segments (
    id              UUID PRIMARY KEY,
    absence_id      UUID REFERENCES leave_requests(id),
    leave_type_id   UUID REFERENCES leave_types(id),
    hours           NUMERIC(5,2) NOT NULL,
    sort_order      INT NOT NULL DEFAULT 0
);
```

Option A is preferred for the long-term goal of supporting multiple organizations.
