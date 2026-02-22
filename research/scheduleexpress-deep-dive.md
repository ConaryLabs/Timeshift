# ScheduleExpress Deep Dive — Chrome DevTools MCP Exploration
**Date:** 2026-02-22
**Source:** Live site at scheduleexpress.com (logged in as Peter Permenter, Valleycom)

## Complete Navigation Map

### Top-level Nav (hover dropdowns)
```
Requests           Reports              Schedule Management    Bidding
  My Trades          My Reports           View Schedule          Bid on Vacation
  Create Trade                            View Coverage Exc.     Bid on Shifts
  View Avail Trades                       View Sched Coverage
  My Absences                             View Coverage Assign
  Create Absence                          Duty Assign by Req
  My OT Assignments                       Duty Assign by User
  User OT Request
  Volunteered OT
  View Available OT
  My Notes
  My Special Assignments

Right-side nav: My Messages [3] | My Schedule | My Profile
```

### Page Endpoints (`.do` actions)
- `personalSchedule.do` — Personal monthly calendar
- `scheduleView.do` — Full org schedule grid (Month/Week/Day/Dashboard views)
- `absenceCreate.do` — Absence Request / Prior-Approval form
- `absenceView.do` — Your Absence Requests (Pending/Approved/Declined)
- `absenceDetail.do?pk=` — Individual absence detail
- `tradeCreate.do` — Create a New Trade
- `tradeView.do` — My Trades
- `tradeAvailableList.do` — View Available Trades (large grid popup)
- `overtimeAssignView.do` — My OT Assignments
- `overtimeAssignDetail.do?pk=&userId=` — OT assignment detail
- `overtimeUserRequest.do` — User Overtime Request
- `overtimeVolunteered.do` — Volunteered Overtime
- `overtimeAvailableList.do` — View Available OT (large grid popup)
- `myNotes.do` — My Notes
- `specialAssignmentView.do` — My Special Assignments
- `specialAssignmentDetail.do?pk=&scheduleItemsPk=` — Special assignment detail
- `userReportList.do` — My Reports
- `locationList.do` — Location Management
- `coverageGridView.do` — View Schedule Coverage
- `coverageAssignmentView.do` — View Coverage Assignment
- `positionAssignmentView.do` — Duty Assignment by Requirement
- `positionAssignmentSummaryView.do?view=week` — Duty Assignment by User
- `scheduleCoverageList.do` — Coverage Exceptions
- `shiftBiddingUpcomingView.do` — Bid on Shifts (Upcoming/Previous)
- `shiftBiddingBidView.do?shiftBiddingPk=` — Shift Bid Detail
- `vacationBiddingRoundUserBids.do` — Vacation Bids
- `userProfile.do` — User Profile (6 tabs)
- `inbox.do?action=view` — My Messages

## Personal Schedule Page

Monthly calendar view showing shifts per day:
- Format: `HHMM-HHMM` (e.g., `1200-2200`)
- Annotations as clickable links: `(OT)`, `(AB)`, `(ACCESS)`
- AB links include tooltip descriptions: `"1000-1200(AB):Sick"`, `"1200-2200(AB):Sick"`
- Multiple shifts per day supported (e.g., OT shift + regular shift)
- "Location: Communications" context shown
- Buttons: Prev/Next month, Select Date, Duty Assignments
- "Today" highlight on current date
- Data loaded via iframe: `personalScheduleData.do?start={epoch}&end={epoch}&month={n}`

## Schedule View (Full Grid)

The main scheduling view — a large grid of all employees x days:
- ~77 rows (employees), 7 day columns
- **View modes**: Month (radio), Week (radio), Day (radio), Dashboard (radio)
- **Also tab-style**: Month, Week, Day, Dashboard buttons
- Shift cells contain: time ranges, annotations in bold (e.g., **0600-0800(OT)**)
- "Total Scheduled Resources" row at bottom with daily counts (e.g., 53, 55, 54, 56, 57, 52, 57)
- Coverage indicators: "Coverage Ok", "Coverage Under", "Coverage Over"
- Filter system: "Filter: New | Saved" links
- "Legend" link in top right
- "Click row to expand/collapse. Click here to expand/collapse all rows."
- Rows are expandable (show more detail per employee)

### Shift Annotations Observed
| Code | Meaning |
|------|---------|
| OT | Overtime |
| AB | Absent |
| AP | Approved (absence) |
| TR | Trade |
| TS | Trade (sent?) |
| TRP | Trade Pending? |
| TRO | Trade Offered? |
| TRM | Trade Matched? |
| TRA | Trade Approved? |
| TRH | Trade History? |
| TAH | Training Assignment History? |
| TAP | Training Assignment Pending? |
| TAA | Training Assignment Approved? |
| MC | ? |
| SA | Special Assignment |
| TG | Training? |
| TA | Training Assignment |

## Absence/Leave System

### Absence Reasons Observed (from actual data)
- **Sick** — reported (no prior approval needed)
- **FCL Vacation** — First-Come-First-Served Vacation
- **FCL Sick** — First-Come-First-Served Sick
- **BID Vacation** — Won through vacation bidding process

### Absence Statuses
- **REPORTED** — logged after the fact (sick call-ins)
- **APPROVED** — pre-approved (vacation bids, FCL requests)

### Absence Request Form
- Start Date of Absence + End Date of Absence (date pickers)
- Two submit paths:
  - "Continue w/RDO" — Continue with Regular Day Off
  - "Continue" — Standard absence request
- Multi-step: first set dates, then select absence reason/details

### Absence View Sections
- Pending Absence Requests
- Approved Absence Requests (table: From Date, To Date, Absence Reason, Status, Actions)
- Declined Absence Requests

## Trade System

### Create Trade
- Trade Date (date picker)
- Partial Trade Time Frame (e.g., "0900-1700") — trades can be partial shifts
- Trade Requirements (optional freetext notes)
- Business rule: "Must be completed prior to same date of following month"
- Restriction: trades filtered by same job category ("There is no one with the same job category to send notice to")

### Trade Views
- My Trades — personal trade list
- View Available Trades — browse open trade offers (large grid popup)

## Overtime System

- My OT Assignments — view assigned OT
- User Overtime Request — request OT
- Volunteered Overtime — volunteer for OT
- View Available OT — browse available OT slots
- OT detail: `overtimeAssignDetail.do?pk={pk}&userId={email}`

## Shift Bidding

### Bid Periods
- ~6-month periods, alternating March and September
- Current: "Dispatch March 2026 Shift Bid" (03/01/2026 - 09/05/2026, bidding started 01/10/2026)
- Columns: Name, Location, Start Date, End Date, Bidding Start
- Tabs: Upcoming, Previous

### Historical Bid Selections (user's history)
The "Selection" format encodes: `{time range} {work days}/{RDO day}/{team letter} {classification}`

| Period | Selection |
|--------|-----------|
| Sep 2021 | 1000-2000 WThF/Sunday/B Dispatcher |
| Mar 2022 | 1400-2400 WThF/Sunday/B Dispatcher |
| Sep 2022 | 0800-1800 WThF/Sunday/B Dispatcher |
| Mar 2023 | 0800-1800 WThF/Sunday/B Dispatcher |
| Sep 2023 | 1400-2400 ThFS/Sunday/B Dispatcher |
| Mar 2024 | 0800-1800 WThF/Sunday/B Dispatcher |
| Sep 2024 | 1200-2200 SSM/Sunday/B Dispatcher |
| Mar 2025 | 1200-2200 SSM/Sunday/B Dispatcher |
| Sep 2025 | 1200-2200 SSM/Sunday/B Dispatcher |

Key observations:
- Day abbreviations: S=Sunday, M=Monday, T=Tuesday, W=Wednesday, Th=Thursday, F=Friday, S=Saturday (context-dependent)
- SSM = Sunday, Saturday, Monday (?) — likely the work days for this rotation
- WThF = Wednesday, Thursday, Friday
- ThFS = Thursday, Friday, Saturday
- Team letters: A, B, C etc.
- Each bid includes an RDO (Regular Day Off) day

## Vacation Bidding

### Configuration
- No. of Approvals Per Round
- Bidding Days Available
- Bidding Type (not shown)
- Bidding Criteria options:
  - **Seniority** — by Hire Date or Unit Assignment
  - **First-come-first-served** (FCL)
  - **Job Category** filter
- Round Start Date, Length (in days)

### Current Bids table
- Date, Status, Choice, Notes, Actions
- "Other Users" tab to see coworkers' bids

## User Profile (6 tabs)

### 1. User
- First Name*, Middle Name, Last Name* (readonly)
- Email Address* (readonly)
- Primary Contact Number*, Alternate Contact Number
- Password change + Security Question/Answer

### 2. Add. Details
- Full home address (Street, City, State, Zip, Country)
- Emergency Contact (freetext)

### 3. Preferences
- Calendar Week Starts On: Sunday-Saturday dropdown

### 4. Notifications
**Delivery channels** (dropdown, many combos):
- Login Email Only, Personal Email Only, Text Message Only, Push Notifications Only
- Various combinations (Personal + Text, Login + Push, All four, etc.)
- My Messages Only (in-app only)

**Message categories** (opt-out checkboxes):
- Approver notifications for notes
- User notifications for: absences, cancel special assignment, cancel training assignment, duty assignment, notes, overtime, schedule change, special assignment, trades, training assignment

**Notification Groups** (approver scope):
Admin, CTO Call Receiver, CTO Dispatcher, Call Receiver, Dispatcher, HR/Finance, IT, Records, Red Unfilled OT Alert, Supervisor, Trainee Call Receiver, Trainee FD Dispatch, Trainee PD Dispatch, Training

### 5. Devices
(Not explored)

### 6. Accruals
**Time Banks** (leave balance categories):
- Sick: -538.0
- FFP Sick: 0.0
- Comp: 0.0
- Holiday: -31.0
- Vacation: -796.41

**Accrual Rates**: Time Bank + Effective Date + Accrual Rate (none set for this user)

Note: negative balances — hours appear to be tracked as debits (hours used).

## Locations (equivalent to our "teams" concept but richer)

| # | Location | Description | Parent | Status |
|---|----------|-------------|--------|--------|
| 1 | Admin | | | active |
| 2 | Communications | | | active |
| 3 | HR/Finance | | | active |
| 4 | IT | | | active |
| 5 | Inactive/Former Users | Former Employees | | active |
| 6 | OT - out of Com Room | OT outside of Com Room | Communications | active |
| 7 | Records | | | active |
| 8 | Training | | | active |
| 9 | Finance | | | inactive |
| 10 | HR | | | inactive |
| 11 | Payroll | | | inactive |

Location properties: Description, Type, Parent Location, Child Locations, Mandate Locations, Volunteer Locations, Status, Trade Partners

Key: Locations have parent/child relationships AND OT mandate/volunteer relationships (which locations feed OT workers to which).

## Full Job Category List (from Vacation Bidding dropdown)

- Admin Services Assistant
- Admin Services Manager
- A Supervisor
- B CTO Dispatcher
- B Dispatcher
- C Call Receiver
- C CTO Call Receiver
- Coverage Exception
- Deputy Director
- Director
- Finance Manager
- Former
- HR Manager
- Human Resources Analyst
- Ops Manager
- Payroll and Accounting Specialist
- Public Records Specialist
- System Administrator
- Trainee Call Receiver
- Trainee Dispatcher
- Training Assistant
- Training Manager

Note: Job categories have a letter prefix (A, B, C) that maps to teams/seniority tiers:
- A = Supervisors
- B = Dispatchers (full dispatchers + CTO dispatchers)
- C = Call Receivers (full call receivers + CTO call receivers)

## Key Architectural Differences: ScheduleExpress vs Timeshift

| Concept | ScheduleExpress | Timeshift Current |
|---------|----------------|-------------------|
| Organizational unit | "Location" (hierarchical, with parent/child + OT mandate/volunteer) | "Team" (flat) |
| Job classifications | 22 categories with team-letter prefixes | 3 (COI, COII, SUP) |
| Shift bidding | 6-month periods, seniority-based, encodes days+team+RDO | Schedule Periods (basic) |
| Vacation bidding | Separate system with rounds, seniority/FCL criteria | Not implemented |
| Leave types | Sick, FCL Vacation, FCL Sick, BID Vacation, Comp, Holiday | 26 generic leave codes |
| Leave balances | Time bank accrual system (Sick, FFP Sick, Comp, Holiday, Vacation) | Not implemented |
| Trades | Full trade system with partial trades + requirements | Not implemented |
| OT management | Assignments, volunteering, available OT, mandate/volunteer locations | OT hours tracking only |
| Notifications | Multi-channel (email, text, push, in-app), per-category opt-out | Not implemented |
| Schedule views | Month/Week/Day/Dashboard + expandable rows, coverage totals | Week/Board |
| User profiles | 6 tabs (user, address, preferences, notifications, devices, accruals) | Basic user record |
| Special assignments | ACCESS, Training, etc. with detail pages | Not implemented |
| Notes system | Per-user notes with approver notifications | Not implemented |
| Messaging | In-app inbox with unread count | Not implemented |

## Screenshots Saved
- `research/se_personal_schedule.png` — Personal schedule monthly view
- `research/se_schedule_view_month.png` — Full org schedule grid (month)
- `research/se_schedule_view_week.png` — Full org schedule grid (week)
- `research/se_schedule_view_day.png` — Full org schedule grid (day)
