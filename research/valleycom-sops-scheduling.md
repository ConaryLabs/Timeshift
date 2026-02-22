# Valleycom SOPs — Scheduling-Relevant Procedures

**Source:** PowerDMS 1. SOPs folder, extracted Feb 2026
**Files:** SOP 114, 116, 120, 122, 129, 129A, 211-12, 300

---

## SOP 114 — Overtime / Compensatory Time

**Purpose:** Provides policy for overtime compensation.
**Defers to:** CBA for represented employees; SOP 208 for admin/non-represented.

### Key Rules

- **Three separate OT tracking lists** by classification:
  1. Supervisors (I or II)
  2. Communications Officer II (COII)
  3. Communications Officer I (COI)

- **Mandatory OT tracking:** List ordered starting with the employee who has gone **longest without being mandated**, ending with the most recently mandated. (This is the "moves to back" queue described in the VCCEA CBA §4.4.2 — confirmed here procedurally.)

- **OT on traded days:** Employees CAN work available OT on days when they traded. However:
  - The employee working the trade **cannot claim any OT benefits** of the other employee's shift
  - Their only claim is to **repayment of time** by the other employee
  - This avoids double-counting/double-pay in trade+OT scenarios

- **OT Records (§3.4):** Maintained each pay period on employee's electronic timesheet:
  - Date OT worked + hours
  - Comp time earned (if not taken as cash)
  - Date comp time used + hours
  - Current comp time balance

### Timeshift Implications
- Three-list structure confirmed: COI list, COII list, Supervisor list — tracked separately
- The OT tracking list is ordered by "time since last mandatory" — not a simple sort by total hours
- When an employee works OT on a trade day, it doesn't transfer OT entitlements
- Comp time balance is a tracked field in the timesheet system (needs to persist in DB)

---

## SOP 116 — Trade Procedures

**Purpose:** Policy for employees who want to temporarily trade shifts.

### Requirements

- **Advance submission** on a Trade Request Form: dates, times, both employees
- If repayment date unknown at request time: enter a **"not to exceed" date** = same date of the next consecutive month
- **Supervisor approval required** on each affected shift, time permitting (both sides if trade crosses shifts/supervisors)
- **Minimum notice:** Must be approved **at least 1 hour before shift start**

### Compensation Rule (Critical)
> The employee **physically working** the traded shift receives **no compensation** for those traded hours.
> The employee who **would have normally worked** the shift is compensated — including **holiday premium pay**.

This means: trades are schedule swaps only. Payroll doesn't follow the body — it stays with the original shift assignment.

### Other Rules
- If either employee cannot work the traded shift → must use **accrued time** (annotated on timesheet)
- All trades completed on or before the **same date of the next consecutive month** (e.g., 10/17 trade → repaid by 11/17)
- **"Double Trade" prohibited**: trading a shift that has already been traded once
- **Same job classification only**: Call Receiver cannot trade with Dispatcher

### Timeshift Implications
- Trade approval requires supervisor sign-off on each affected shift — if trade spans two different supervisor assignments, both supervisors must approve
- Payroll: compensation stays with the **original schedule** — the person working the trade is not paid for it
- 1-hour minimum approval window → Timeshift trade approval UI needs to enforce this cutoff
- "Not to exceed" date defaults to same day next month — useful default in the create trade form
- Double trade prohibition: enforce at submission (if a shift has already been traded, block it being traded again)

---

## SOP 120 — Work Schedules

**Purpose:** Establishes work schedules and assignments for all VCC employees.

### Key Rules

- Director or designee approves all schedules and assignments; may reassign personnel as needed
- Normal schedule for represented employees: per CBA (40 hrs/week)
- Alternate work schedules: by **mutual consent**, not a past practice
- Permanent schedule change: **2-week notice** required (same as CBA)
- Shift change request by employee: only if vacancy exists or a **mutual trade** can be made
- Mandatory training: **1-week notice**; rescheduled if missed due to excused/unexcused absence

### Job Share Scheduling
- Job share employees bid for shift slots **only after all other eligible employees have bid**
- Between employees sharing a position: **seniority determines** which slot each gets
- References SOP 211-10 (Job Share) for full details

### Hour Limits (§3.7)
- **Max 14 hours** in any 24-hour period (except by mutual agreement per CBA)
- **Max 12 consecutive hours** (employees may elect up to 14 by mutual agreement)

### Schedule Transition / Adjustment Periods (§3.8)
When changing from one work schedule to another:
- Employee is responsible for working their adjustment period
- Exception: if adjustment would exceed 12 hours in a 24-hour period → covered on **mandatory basis**
- If adjustment causes >40 hrs in work week and employee must work it → paid at **overtime rate**

### Timeshift Implications
- Job share employees need a flag to exclude them from the first pass of shift bidding
- 14/12-hour limits need to be enforced or at least flagged when building schedules — system should warn when a proposed schedule would violate them
- Adjustment periods during schedule transitions are edge cases but create OT-eligible situations
- SOP 211-10 (Job Share) would be worth obtaining for full job share scheduling rules

---

## SOP 122 — Time Off Procedures

**Purpose:** Procedures for requesting vacation, paid/unpaid holidays, and comp time.

### Key Rules

- All leave requests submitted to employee's current supervisor
- **Represented employees:** defer to CBA (this SOP mainly covers admin/non-represented)
- **Approval required** before the requested date; employee responsible for knowing their own balances
- **Minimum staffing** is the override authority: Center retains sole right to determine and adjust minimum staffing levels

### Unpaid Holiday Time (§3.1) — Washington State Law (RCW 1.16.050)
- **2 days/year** for faith/conscience or religious observance
- Must request **at least 72 hours in advance** (or show notice wasn't possible)
- Must state reason to allow Center to verify eligibility
- **Denied if:** public safety position would fall below minimum staffing
- **Does not carry over** year to year
- Partial day use = full day toward 2-day annual allotment
- Employee cannot substitute accrued paid leave for this type

### Timeshift Implications
- Leave approval workflow: supervisor receives and approves/denies; minimum staffing check is the primary business rule
- Unpaid Holiday is a distinct leave type (2 days/year, non-accumulating, 72-hour notice required) — maps to `LWOP` or a dedicated type in the leave_types table
- Represented employees primarily follow CBA rules → Timeshift's leave logic should be CBA-configured per org unit

---

## SOP 300 — Attendance, Notification, and Tardiness

**Purpose:** Policy for attendance, absence notification, and timesheet use.

### Absence Notification (§3.1)

- **Minimum notice:** at least **3 hours before** scheduled shift (same as VCCEA CBA)
- **COI/COII:** must make **telephone contact** with on-duty supervisor (not just a text or SE entry)
- Less than 3-hour notice = **one "occurrence"**
- **4+ occurrences in any 12-month period** → eligible for disciplinary action

Notification must include:
1. Reason for absence
2. When employee expects to return

**Daily reporting required** on any continuing absence, unless other arrangement made with Executive Director.

### Unexcused Absences (§3.2)
- No show, no contact → **unexcused; LWOP on timecard**; inquiry entered
- Contact made but employee can't work (reason other than emergency/sick/FMLA/FCL/L&I) → **unexcused; LWOP**
  - If employee uses sick leave: receives tardy + occurrence
  - If employee uses emergency leave: receives tardy only
  - LWOP is non-disciplinary when in conjunction with unexcused absence

### On-Time Standards (§3.3) — Critical for schedule enforcement

| Role | On-Time Standard |
|------|-----------------|
| COI | Logged into phone (ready status) + CAD at open console, headset on and plugged in, at shift start |
| COII | At assigned console, headset on, ready to be briefed by outgoing COII, at shift start |
| Training class | In classroom or logged into virtual platform by start time |
| Supervisor | Has contacted outgoing supervisor by start of shift |

**Tardy threshold:** 1 second past shift start = tardy.

**Flexing time:** With supervisor approval, employee may flex time same day or work week (doesn't erase the tardy; may still need to use accrued leave for missed time).

### Progressive Discipline for Tardiness (§3.4)

| Occurrences in 12-month window | Action |
|-------------------------------|--------|
| 4 | Oral Admonishment (resets the 12-month clock) |
| 3 more (within 12 months of Oral) | Written Warning (resets clock) |
| 2 more (within 12 months of Written) | Final Written Warning or Suspension Without Pay (+6 months added to expiration) |
| 1 more after Final Written | Termination recommended |

### Time Tracking (§3.6)
- **COI/COII:** biometric hand punch (cannot punch in more than 5 minutes before shift; must punch out immediately upon relief)
- **Supervisors:** review and approve electronic timesheets for their staff each pay period
- Each employee solely responsible for accuracy of their timesheet

### Timeshift Implications
- **Occurrence/tardy tracking** is a real HR tracking system — Timeshift doesn't need to build this, but it confirms supervisors need to document late call-ins in the scheduling system
- The "telephone contact required" rule explains why sick call-ins must be phone calls not just SE entries — Timeshift should not be the primary callout channel for unplanned absences; it records the outcome after the fact
- Supervisor timesheet approval each pay period → Timeshift's schedule + attendance data feeds into payroll approval
- Hand punch biometric system is separate from SE/Timeshift — integration point if Timeshift ever connects to payroll

---

## SOP 211-12 — Temporary and Part-Time Employees

**Purpose:** Governs non-bargaining-unit temporary and part-time positions.

### Key Rules
- Temp/part-time appointments are **non-bargaining unit** — exempt from most benefits, appeal rights, and leaves (unless required by law or contractual obligation)
- Not included in classified service
- **Max duration for temp appointment:** normally 12 months
- Still have access to the **complaint procedure**

### Timeshift Implications
- Temp employees are a distinct category in the system — not subject to CBA scheduling rules (no bid seniority, no OT callout list, no trade protections)
- A `employee_type` enum should distinguish: regular full-time, job share, medical part-time (CBA), temp/part-time (non-CBA)
- Temp employees are likely not modeled in SE at all (or modeled as "Exclude" / "Other" category)

---

## SOP 100 — Organizational Structure, Chain of Command, Authority

**Purpose:** Establishes the org structure and chain of command for Valley Communications Center.

### Org Chart — Positions Relevant to Timeshift

**Operational staff (VCCEA — scheduled by Timeshift):**
| Position | Code | Role | Bargaining Unit |
|----------|------|------|----------------|
| Communications Officer I | COI | Call receiving | VCCEA |
| Communications Officer II | COII | Call receiving + dispatch | VCCEA |
| Communications Training Officer | CTO | Designation on top of COI or COII; not a separate job class | VCCEA |

> CTO is a designation assigned by the Executive Director or designee — it is NOT a separate position. A COI or COII gets the CTO label (and corresponding pay premium) while fulfilling training duties.

**Supervisory staff (VCSG — also scheduled by Timeshift):**
| Position | Role |
|----------|------|
| Supervisor I | Manages COI/COII team; com room operational oversight; performance evaluations |
| Administrative Supervisor | Administrative duties; rotational assignment |
| Training Supervisor | Manages training department; coordinates COI/COII training |

> Note: SOP 100 describes Training Supervisor as "non-represented administration" but the 2025-2026 VCSG CBA explicitly covers it. The CBA controls — Training Supervisor is Guild-represented.

**Management (non-represented, NOT in Timeshift):**
- Operations Manager — oversees all operational positions; Supervisors report to them; sets minimum staffing
- Deputy Director — operational authority in Executive Director's absence
- Executive Director — ultimate authority

**Chain of command for on-duty scheduling purposes (§3.2.3):**
> The on-duty Supervisor has operational authority to direct COI and COII employees for all emergency communications functions.

**Chain of command when ED/Deputy/Ops Manager unreachable (§3.2.1):**
1. Administrative Supervisor
2. On-Duty Supervisor (by seniority)
3. Most Senior Supervisor
4. Training Supervisor
5. Most Senior Communications Officer II

### Approval Authority Relevant to Timeshift
- **Schedule approval:** Director or designee (delegated to Operations Manager day-to-day)
- **Trade approval:** Team Supervisor on each affected shift (per SOP 116)
- **Leave approval:** Employee's current supervisor
- **OT callout:** On-duty Supervisor initiates
- **Minimum staffing levels:** Set by Operations Manager; Executive Director retains override

### SE/Timeshift Scope
Timeshift schedules and tracks:
- COI, COII (VCCEA) — core shift workers
- Supervisor I, Administrative Supervisor, Training Supervisor (VCSG)

Timeshift does NOT schedule:
- Operations Manager, Deputy Director, Executive Director (management)
- IT, HR, Finance, Training Specialist, GIS, and other admin staff

### Timeshift Implications
- CTO is a **designation flag** on an employee record, not a separate classification — affects pay rate but not scheduling position
- Administrative Supervisor and Training Supervisor are **rotational assignments** (36 months per VCSG CBA) — need a `role_assignment` or `designation` concept separate from base classification
- The on-duty Supervisor is the single operational authority for COI/COII on shift — all absence notifications, OT callouts, and trade approvals flow through them
- "Most Senior COII" as 5th-in-command means COII seniority must be accessible to determine acting authority when no supervisor is present

---

## SOP 129 — Leaves

**Purpose:** Procedures and conditions for all protected leave (state + federal law). Represented employees defer to their CBA for superseding language — so the CBA controls for COI/COII/Supervisors; this SOP governs admins/non-reps and sets the floor.

### Leave Types Covered

| Section | Leave | Notes |
|---------|-------|-------|
| §3 | Paid Sick Leave | Accrual per policy (CBA overrides for bargaining unit) |
| §4 | Medical Emergency Leave Sharing | Sick leave donation pool |
| §5 | FMLA | Federal, 12 workweeks; concurrent with PFML |
| §6 | WA Family Care Leave (FCL) | Use any accrued paid leave for qualifying family care |
| §7 | WA Paid Family Medical Leave (PFML) | State ESD program; concurrent with FMLA |
| §8 | Domestic Violence Leave | Paid or unpaid |
| §9 | Pregnancy Disability & Parental Leave | 8 weeks bonding + disability period |
| §10 | Administrative Leave | Center-initiated only; does not draw accruals |

### Key Rules for Scheduling

**Sick leave accrual (non-reps; CBA supersedes for reps):**
- 1 hr accrued per 40 hrs paid; minimum 4 hrs per pay period
- Carryover cap: **960 hours** (a tracked field Timeshift should store)

**Leave priority order during FMLA (§5.7):**
> Sick first → comp → holiday → vacation → LWOP
- This is the default sequencing when an employee goes on protected leave
- Note: the VCCEA 25-06 LOU modifies the comp+vacation interaction (comp fully depleted before vacation draws)

**Concurrent leave designation (§7.3 / §5.7):**
- FMLA + PFML run concurrently when both apply
- Workers comp also runs concurrently with FMLA when eligible
- Timeshift doesn't manage this, but leave codes need to distinguish which protected bucket is being used (maps to the existing 26 leave-type codes in SE)

**Administrative leave (§10):**
- Center-initiated; employee does NOT use accruals
- Supervisors may grant admin leave for remainder of shift following a traumatic/critical incident (§10.2)
- Subsequent shifts require accrued time (no free ongoing admin leave)

**FCL (§6):**
- Employee's choice of which accrued leave type to use — employer cannot dictate
- Confirmed: FCL = Washington Family Care Leave Act; maps to the `FCL-*` prefix codes in SE (FCL Comp, FCL Vac, FCL Sick, FCL Holiday)

### Timeshift Implications
- **Sick leave balance** is a field to track per-employee (accruals, cap at 960 hrs) — feeds into the leave approval / LWOP threshold decisions
- **Leave type code model** already captures FMLA/FCL/PFML via the 26 SE leave codes; SOP 129 confirms those codes are the right abstraction
- **Administrative leave** needs to be distinguishable in the system — it doesn't draw from accruals, which affects balance calculations
- **Concurrent protected leave** is HR's problem to track in their system; Timeshift just needs the correct leave type recorded on the absence
- Supervisor can grant end-of-shift admin leave unilaterally; does not require advance approval chain

---

## SOP 129A — Leave of Absence Without Pay

**Purpose:** Distinguishes LOA (prearranged unpaid leave) from LWOP (automatic result of exhausted accruals or unauthorized absence).

### Two Distinct Concepts

**LOA (Leave of Absence)** — intentional, authorized:
- Prearranged and preauthorized by Executive Director or designee
- Max 30 calendar days (represented employees may exceed this per their CBA)
- Employee must exhaust **all** accruals first (sick → comp → vac → holiday), then LOA begins
- No additional accruals accumulate while on LOA
- Position held upon return; 10-day failure-to-report = resignation
- Cannot accept other employment during LOA

**LWOP (Leave Without Pay)** — automatic / residual:
- Occurs when accruals are exhausted and absence continues
- Also used when on protected leave that doesn't require accruals (e.g., admin leave, unpaid holiday)
- Not associated with protected leave → may result in discipline up to termination
- No accruals accumulate during LWOP

**Seniority impact:** Non-protected LOA/LWOP may reduce seniority by duration of absence (HR concern, CBA details may vary).

### Timeshift Implications
- LOA and LWOP are separate leave status codes — both appear in the 26 SE leave codes we captured
- **Accrual exhaustion order for LOA**: sick → comp → vac → holiday → then LWOP/LOA kicks in (same ordering as FMLA from SOP 129 §5.7)
- During LOA or LWOP: **no accruals accumulate** — balance tracking must pause
- The distinction matters for leave type recording: LOA is planned/approved; LWOP is the leftover when accruals run dry or absence is unauthorized

---

## Cross-SOP Insights

1. **Trade payroll rule is clear:** The original scheduled employee gets paid regardless of who physically works the shift. This is a key payroll integration point — shift swaps must preserve original assignment in the payroll record.

2. **Three OT lists confirmed by procedure:** COI, COII, Supervisor — each maintained separately, ordered by time-since-last-mandate.

3. **Minimum staffing is the gating condition for everything:** Leave approval, guaranteed holiday, alternate schedules — all conditional on not going below minimum staffing. This is the central business rule the schedule view must surface at all times.

4. **Absence reporting is phone-first:** SE/Timeshift records the result; the actual notification is a phone call to the supervisor. Timeshift should let supervisors enter sick calls on behalf of employees, not expect employees to self-report in the system.

5. **SOP 211-10 (Job Share) referenced in SOP 120** — worth obtaining for full job share bidding rules.
