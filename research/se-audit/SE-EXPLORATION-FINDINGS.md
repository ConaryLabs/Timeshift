# ScheduleExpress Exploration Findings
**Date:** 2026-02-24
**Logged in as:** Peter Permenter (employee) at Valleycom
**Browser:** Chrome via DevTools MCP

---

## Priority 1: Answers to Specific Open Questions

### P1.1: Coverage — Per-Shift or Per-Day?

**Answer: Neither. Coverage is tracked per HALF-HOUR time slot.**

**Coverage Grid Month View** (`coverageGridView.do`):
- Shows 5 job categories: A Supervisor, B Dispatcher, C Call Receiver, Exclude, Other
- For each day, shows Max / Actual / Min
- B Dispatcher shows Max=13, but daily Actual values range 24-30

**Coverage Grid Day View** (`coverageGridView.do?view=day`):
- Columns are half-hour slots: 00, 30, 01, 30, 02, 30 ... through 23, 30 (48 columns per day)
- Each job category shows Max / Actual / Min for EACH half-hour slot
- **Max and Min values VARY throughout the day:**
  - B Dispatcher Max: 13→12→12→12→12→13→13→14→14→15→16→16→15→14→...
  - A Supervisor Max: 4 constant, Min varies 1→2
  - C Call Receiver Max: 10→9→8→9→11→14→15→16→15→14→11→...

**Why month view numbers seem odd:** The month view likely shows the peak Max requirement for the day, while the Actual counts everyone working at any point during the day. Since shifts overlap, multiple people cover different halves of the day, so Actual (24-30) > Max (13) is expected.

**Implication for Timeshift:** Our `coverage_requirements` table currently stores per shift+classification+day, but SE stores per **half-hour slot** per classification. This is much more granular. We may need to either:
- Store coverage requirements per time slot (more accurate)
- Or derive half-hour coverage from shift templates (simpler but less flexible)

**Screenshots:** `02-coverage-grid.png`, `03-coverage-day.png`

---

### P1.2: "Valid Period" on Volunteered OT

**Answer: Valid Period is a single DATE — the date the OT shift occurs on.**

**overtimeVolunteered.do** shows Peter's active OT volunteer entries with columns:
| Column | Example Values |
|--------|---------------|
| Day | Tuesday, Wednesday |
| Time | 1000-1200 |
| Valid Period | 02/24/2026, 02/25/2026 |
| Location | Communications |
| Notes | "Volunteered for OT request [02/24/2026 Tuesday 1000-1200]" |

- Checkboxes allow selecting entries for bulk delete
- "Check All" / "Uncheck All" links
- "Delete Selected" button
- No date range concept — it's a single date per volunteer entry

**Implication for Timeshift:** Our `ot_volunteers` table should have a `date` column (the OT date), not a date range. The "valid period" is just the date the volunteered OT slot is for.

**Screenshot:** `04-overtime-volunteered.png`

---

### P1.3: Absence Create Step 2 — Full Workflow

**Step 1: Date Selection**
- Start Date of Absence (date picker)
- End Date of Absence (date picker)
- Three buttons: "Continue w/RDO", "Continue", "Reset", "Close"
- **Validation:** "Start Date must be prior to End Date" if end date is empty/invalid
- **Key behavior:** If the selected date is an RDO (Regular Day Off), the "Continue" button DISAPPEARS and only "Continue w/RDO" remains. If it's a work day, both buttons are shown.

**Step 1.5: Shift Selection** (after clicking Continue)
- Shows shift selector for start date: "Select shift for Start Date"
- Shows shift selector for end date: "Select Shift for End Date"
- Each is a listbox showing shift options like "1200-2200:03/11/2026-03/11/2026"
- Only shifts the employee is scheduled for appear

**Step 2: Absence Details** (after selecting shifts and clicking Continue again)
- Tab shows "Regular" (link, suggesting there's also an RDO tab when using "Continue w/RDO")
- **Fields:**
  - **Absence Date:** displayed (not editable) — "03/11/2026"
  - **Shift info:** "1200-2200:1200-2200"
  - **"View time bank balances"** link
  - **Absence hours requested:** text input, pre-filled with shift hours (e.g., "10")
  - **"Mins"** link — "Convert minutes into hours decimal value"
  - **Starting at:** text input, pre-filled with shift start (e.g., "1200"), label "(24-hour HHMM)"
  - **Reason for Absence:** free text area
  - **Time off to be carried as:** dropdown with **26 leave codes** (see below)
  - **Up to 5 additional leave code dropdowns** (each with its own hours text field)
  - **Emergency contact info:** text area "In case of emergency, I can be reached at the following phone number(s) or location(s)"
  - **Bereavement fields:** "Relationship" text input + "Name of deceased" text input
  - **Submit for Approval** button + **Cancel** button

**Leave Codes (dropdown options):**
1. Sick
2. FMLA Sick
3. PFML
4. FCL Comp
5. FCL Holiday
6. FCL Sick
7. FCL Vacation
8. BID Vacation
9. Comp first - Vac second
10. Vacation
11. Comp Time
12. Non Guaranteed Holiday
13. Guaranteed Holiday
14. Emergency Leave
15. No Show
16. Admin Leave
17. Bereavement
18. Jury Duty
19. L&I Sick
20. Leave of Absence
21. LWOP
22. Maternity
23. Military
24. RDO Absence
25. Trade Made
26. Unpaid Holiday

**Partial day support:** YES — the "Absence hours requested" field allows entering fewer hours than the full shift, and "Starting at" allows specifying when the absence begins. So an employee on a 1200-2200 shift could request 4 hours starting at 1200.

**Multiple leave codes:** YES — there are 5 dropdown/hours pairs, allowing split coding (e.g., 4 hours Sick + 6 hours Vacation for a 10-hour shift).

**Implication for Timeshift:**
- Our absence/leave request needs partial-day support (hours + start time)
- Need multiple leave codes per absence request (split coding)
- "Continue w/RDO" is a separate flow for requesting absence on days off
- Bereavement has extra required fields
- Emergency contact is collected per absence request

**Screenshots:** `07-absence-create-step1.png`, `08-absence-create-rdo-only.png`, `09-absence-create-shift-select.png`, `10-absence-create-step2.png`

---

## Priority 2: Supervisor/Admin Screens

### Coverage Assignment View (`coverageAssignmentView.do`) — ACCESSIBLE

**This is the daily staffing operations board.** Fully accessible even as an employee.

**Layout:** Half-hour time slots (00-23:30) as columns, numbered position rows:
- 1-A Supervisor through 4-A Supervisor (4 rows)
- 1-B Dispatcher through 14-B Dispatcher (14 rows)
- 1-C Call Receiver through 16-C Call Receiver (16 rows)

**Each cell shows:** Employee name as a clickable link, with time range in the description (e.g., "Devenny, Nicole(0000-0330)")

**Key features:**
- **Prefixes on names:** `+F` = Fixed coverage overtime (e.g., "+FYoung, Vanessa"), `**` = assignment different from primary job category
- **"Manage Overtime"** links appear in empty slots where there's a shortage (e.g., "shortage(1700-2200)")
- **"Create All"** button — creates OT requests for all unfilled slots
- **Location dropdown:** Admin, Communications, HR/Finance, IT, Inactive/Former Users, OT - out of Com Room, Records, Training
- **Date navigation:** Prev/Next buttons, Select Date picker, Refresh
- **Legend:** `+ Overtime assignment. F Fixed coverage. ~F Fixed post assignment. * Denotes assignment different from user's primary job category.`

**Implication for Timeshift:** This is the operational nerve center for supervisors. Our Day View needs to show this same half-hour granularity with employee assignments. The prefix codes (OT, Fixed, cross-classification) are important business concepts.

**Screenshot:** `11-coverage-assignment.png`

---

### Duty Assignment by Requirement (`positionAssignmentView.do`) — ACCESSIBLE

**This is the dispatch console / position board.** Shows who is assigned to each physical duty position.

**Duty positions (rows):**
1. Fire 1, Fire 2, Fire 3
2. Data
3. Auburn, Federal Way, Kent, TukDes (Tukwila/Des Moines), Renton
4. PD Disp Trainee (x2)
5. Left Breaks, Right Breaks
6. Call Receiver (x4)

**Each cell shows:** Clickable time ranges (e.g., "1200-1400") for assignment. When assigned, shows employee name + time range.

**Key features:**
- **Sections** concept with "Add a new Section" button
- **Hour Range** filter textbox (e.g., "12-14" shows only those hours)
- **Clear All** button to delete all assignments
- **Report** button
- **Filter: New | Saved** links
- **Location dropdown** (same 8 locations as coverage view)
- **Print** and **Notes** (open in new window)
- **"PS" (Personal Schedule)** icon next to each employee — links to view their schedule

**Employee list section (bottom half):** Numbered list of all employees with their:
- Job Category (A Supervisor, B Dispatcher, C Call Receiver)
- Day's schedule with code suffixes:
  - `(OT)` = Overtime
  - `(AB)` = Absence
  - `(SA)` = Special Assignment
  - `(TR)` = Trade
  - `(TA)` = Training Assignment
  - `(MC)` = ?
  - `FW` = appears after some (SA) entries — possibly "Flex Work"?
  - `Pattern:0400-1400 SSM Day:3` = shift pattern info (work days + day in rotation)

**Time segment splitting:** A single employee's day is split into pipe-delimited segments:
- `1000-1200(OT)|1200-2200` — OT from 10-12, then regular shift 12-22
- `0400-0600(TA)|0600-1400|1400-1600(TR)` — training 4-6, regular 6-14, trade 14-16

**Implication for Timeshift:** This reveals a "duty position" concept we don't have yet — physical console positions that employees are assigned to within their shift. This is separate from coverage (which is about headcount). We may need a `duty_positions` table.

**Screenshot:** `12-position-assignment.png`

---

### Duty Assignment by User (Week View) (`positionAssignmentSummaryView.do?view=week`) — ACCESSIBLE

**Layout:**
- Month/Week radio toggle
- Filter: New | Saved
- "Click row to expand/collapse" — expandable rows per employee
- "Click here to expand/collapse all rows"
- Week navigation (Prev/Next)
- Loads data via iframe

**Implication for Timeshift:** This is a week-level summary of duty assignments per employee, with expand/collapse detail.

**Screenshot:** `20-position-summary-week.png`

---

### Schedule Grid (`scheduleView.do`) — ACCESSIBLE

**Visible features:**
- Tabs: Dashboard, Daily View, Grid
- Location dropdown with filter (Edit | Delete)
- Month view showing all employees × days
- Each cell shows shift times with color coding
- "Duty Assignments" link in top area
- Print button

**Filter:** The "Filter:" text with "Edit | Delete" links suggests saved filters are applied. "New" and "Saved" filter links are present on multiple pages.

**Screenshot:** `13-schedule-grid.png`

---

### OT User Request (`overtimeUserRequest.do`) — ACCESSIBLE

**Form fields for creating an OT request:**

| Field | Type | Values |
|-------|------|--------|
| Overtime Date | Date picker | — |
| Enter Time | Text | e.g., "0800-2000" (24hr format) |
| Overtime Location | Dropdown | Communications, OT - out of Com Room, Select Location |
| Position | Multi-select listbox | C Call Receiver, B Dispatcher |
| Fixed coverage overtime | Checkbox | checked by default |
| Overtime Reason | Dropdown | 28 reasons (see below) |
| Notes | Textarea | free text |

**OT Reasons (28 options):**
Sick, FMLA, PFML, FCL, Comp Time, Vacation, Holiday Paid, Staffing, Second CR Breaker, Acting Supervisor, ADA Sick, Admin Leave, Bereavement, CTO Duties | Academy Prep, Emergency Leave, Long Call Hold Over, Jury Duty, L&I Sick, Leave of Absence, LWOP, Maternity, Military, Meeting, OT Accom, Special Assignment, Late Employee, Training, Weather | Event, Unpaid Holiday

**Implication for Timeshift:** OT requests have a separate reason list from absence types. The "Position" multi-select means one OT request can cover multiple classifications. "Fixed coverage overtime" checkbox is a key concept.

**Screenshot:** `14-ot-user-request.png`

---

### Available Overtime (`overtimeAvailableList.do`) — ACCESSIBLE

**Two tabs:** Available | Filled

**Available tab columns:**
| Column | Description |
|--------|-------------|
| Date | Day + date (e.g., "Tue 02/24/2026") |
| Time | Time range (e.g., "1400-1600") |
| ReqDate | When the OT request was created (e.g., "02/24/2026 0836") |
| Position | Job category (B Dispatcher, C Call Receiver) |
| Location | Always "Communications" |
| UnFilled | Time range + hours in parens (e.g., "1400-1600(2)") |
| Filled | "--" when unfilled |
| Action | "Volunteer" link |

**Key observations:**
- OT slots are typically 2-hour blocks, but can be as small as 30 min (e.g., "0400-0430(0.5)")
- Same date/time can have multiple OT requests (created at different times)
- Legend: `*` = Queued Overtime, `!` = Flagged, `$` = Deferred (none visible in current data)
- Data spans ~1 month forward
- Massive list — 100+ available OT slots visible

**Filled tab:** Same columns but showing filled entries with OT hours tracked.

**Screenshots:** `05-overtime-available.png`, `06-overtime-filled.png`

---

### OT Assigned View (`overtimeAssignView.do`) — BLOCKED

Returns "System Error Message: A System Error occurred while processing your request." This is supervisor-only.

**Screenshot:** `19-ot-assigned.png`

---

### Employee Reports (`userReportList.do`) — ACCESSIBLE

**Two tabs:** Report List | Batch Reports

**3 reports available to employees:**

| Report Name | Description |
|-------------|-------------|
| Overtime By Assigned Time | PDF — Displays overtime assignments for a date (date range) in chronological order |
| Overtime Summary All | Overtime (Voluntary, Mandatory, Total OT) for a Date Range Ordered by Least Amount of Overtime Worked includes employees with zero overtime for the period |
| Work Summary (User) | A single user's Employee Work Summary report. Includes all schedule items and exceptions. Query by start/end date and time |

**Implication for Timeshift:** We need at least these 3 employee-facing reports. The "Batch Reports" tab suggests reports can be queued for generation.

**Screenshot:** `15-user-reports.png`

---

### Special Assignments (`specialAssignmentView.do`) — ACCESSIBLE (empty)

Shows "You have no special assignments.." with just a Close button.

Page title: "My Special Assignments"

**Implication:** Special assignments are per-employee. The `(SA)` suffix in the duty assignment view shows they integrate into the schedule. We saw in inbox messages that special assignments are created by supervisors and employees get notified.

**Screenshot:** `16-special-assignments.png`

---

### Inbox / Messaging (`inbox.do?action=view`) — ACCESSIBLE

**Title:** "Inbox Messages for peterp@valleycom.org"

**Features:** check all / uncheck all links, delete checked button, Close button

**4 messages present:**

| From | Subject | Detail | Received |
|------|---------|--------|----------|
| Austin Haynes | New Special Assignment | 02/27/2026-02/27/2026 2000-2200 | Feb 20, 2026 00:44 PST |
| Sheiska Suver | Special Assignment Cancelled | 02/20/2026-02/20/2026 2000-2200 | Feb 20, 2026 00:44 PST |
| Nicole Devenny | New Overtime Assignment | 02/19/2026 (Thursday) 0800-1000 * | Feb 18, 2026 19:59 PST |
| Matthew Conneway | Available overtime has been filled. | 02/12/2026 (Thursday) 1000-1200 * | Feb 12, 2026 06:56 PST |

**Message types observed:**
- New Special Assignment (from supervisors)
- Special Assignment Cancelled
- New Overtime Assignment
- Available overtime has been filled

**Implication for Timeshift:** The messaging system is notification-based (system-generated), not free-form chat. Messages come from supervisor names, not "System". The `*` after time likely means "Queued Overtime" per the legend.

**Screenshot:** `17-inbox.png`

---

### Coverage Exceptions (`scheduleCoverageList.do`) — ACCESSIBLE

**Title:** "Schedule Coverage Validation Exceptions Report"

**Columns:** Schedule Name, Coverage Plan, Location, Action (View | Delete)

**7 entries spanning 2020-2027:**

| Schedule | Coverage Plan | Date Range |
|----------|--------------|------------|
| V2 Schedule (06/01/2020-NoEndDate) | Communications 2023 2.0 | 03/05/2023-03/02/2024 |
| V2 Schedule | Communications 2025 | 03/02/2025-02/28/2026 |
| V2 Schedule | Communications 2024 | 03/03/2024-03/01/2025 |
| V2 Schedule | Communications 2026 | 03/01/2026-03/06/2027 |
| V2 Schedule | Communications 2023 | 01/01/2023-03/04/2023 |
| V2 Schedule | Communication 2020 | 09/06/2020-12/31/2021 |
| V2 Schedule | Communications 2022 | 01/01/2022-12/31/2022 |

**Key insight:** Coverage plans are ANNUAL — each year gets a new named plan (e.g., "Communications 2025" covering 03/02/2025-02/28/2026). The date ranges align with bid periods (March to March). A "V2 Schedule" is the master schedule since 2020.

**Implication for Timeshift:** Coverage plans/requirements are versioned annually and tied to bid periods. We may want to version our coverage_requirements similarly.

**Screenshot:** `18-coverage-exceptions.png`

---

## Priority 3: Additional Findings

### Location/Department Structure

SE has 8 locations visible in dropdowns:
1. **Communications** — the main dispatch center
2. **OT - out of Com Room** — OT work outside the communications room
3. **Admin**
4. **HR/Finance**
5. **IT**
6. **Records**
7. **Training**
8. **Inactive/Former Users**

These aren't "teams" in our Timeshift sense — they're physical locations/departments. Valleycom uses "Communications" as their primary scheduling location.

### Code Suffixes in Schedule Data

From the duty assignment view, these codes appear after time ranges:
| Code | Meaning |
|------|---------|
| (OT) | Overtime |
| (AB) | Absence |
| (SA) | Special Assignment |
| (TR) | Trade |
| (TA) | Training Assignment |
| (MC) | Unknown — possibly Medical/Call? |
| +F | Fixed coverage overtime (prefix) |
| ~F | Fixed post assignment (prefix) |
| ** | Assignment differs from primary job category (prefix) |
| FW | Appears after (SA) entries — possibly Flex Work or a code |

### Pattern Data in Descriptions

The duty assignment descriptions contain rich pattern data:
- `Pattern:0400-1400 SSM Day:3 0400-1400` — shift pattern is 0400-1400, works SSM (Sat-Sun-Mon), currently on Day 3 of the pattern
- `Pattern:1800-0400 FSS Day:3 1800-0400` — works FSS (Fri-Sat-Sun)
- Day-of-week codes: SSM, FSS, ThFS, WThF, ThFSS

### Shift Duration Variety

OT shifts can be very granular:
- Standard: 2-hour blocks (0800-1000, 1000-1200, etc.)
- Short: 30-minute blocks (0400-0430 = 0.5 hrs)
- Regular shifts: 10-hour (1200-2200, 0400-1400, 0800-1800, etc.)
- Overnight: spans midnight (1800-0400, 2200-0800, 1800-0600)

### Pages Accessible vs Blocked (as Employee)

| Page | Access |
|------|--------|
| coverageGridView.do (Month + Day) | FULL |
| coverageAssignmentView.do | FULL |
| positionAssignmentView.do | FULL |
| positionAssignmentSummaryView.do | FULL |
| scheduleView.do | FULL |
| overtimeAvailableList.do | FULL |
| overtimeVolunteered.do | FULL |
| overtimeUserRequest.do | FULL |
| absenceCreate.do | FULL |
| userReportList.do | FULL |
| specialAssignmentView.do | FULL (empty) |
| inbox.do | FULL |
| scheduleCoverageList.do | FULL |
| **overtimeAssignView.do** | **BLOCKED** (System Error) |

Surprisingly, almost everything is accessible to employees — including the full coverage assignment grid and duty position board. Only the OT assignment management view is blocked.

---

## Summary of Key Implications for Timeshift

### Must-Have Design Changes

1. **Coverage requirements should be per half-hour slot**, not per shift. The current `coverage_requirements` table (per shift+classification+day) is too coarse. SE tracks Max/Min/Actual per 30-minute interval per classification.

2. **Absence requests need partial-day support:** hours requested + start time fields, not just full-day requests.

3. **Absence requests need multiple leave codes per request** (split coding) — up to 5 code/hours pairs.

4. **"Continue w/RDO" is a separate flow** for requesting absence on days off.

5. **Duty positions are a separate concept from coverage:** Physical console positions (Fire 1, Auburn PD, Call Receiver, etc.) that employees are assigned to within their shifts.

### Important Concepts We're Missing

6. **OT slots are 2-hour blocks** (not full shifts) with a volunteer/assign workflow.

7. **"Fixed coverage overtime"** is a distinct OT type with its own prefix (+F).

8. **28 OT reasons** (separate from 26 absence/leave codes) — significant overlap but not identical.

9. **Special assignments** integrate into the schedule and generate notifications.

10. **Coverage plans are annual**, versioned, and tied to bid periods (March-March).

11. **Messaging is notification-based** — system-generated messages about schedule changes, not free-form chat.

12. **Filters (New/Saved)** are a persistent feature across multiple views — users can save custom filter configurations.
