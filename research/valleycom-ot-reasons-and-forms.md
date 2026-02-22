# Valleycom OT Reasons, Positions, Locations & Form Fields

**Source:** ScheduleExpress form inspection (`overtimeUserRequest.do`), Feb 2026

---

## OT Request Form — `overtimeUserRequest.do`

Page title: **"Create User Requested Overtime"**
This is an **employee-facing form** — an employee requests a specific OT slot they want to work.
This is distinct from the supervisor-initiated callout and the volunteer system.

POST to `overtimeUserRequest.do`

| Field Name | Type | Notes |
|------------|------|-------|
| `overtimeDate` | text | Date of the OT shift |
| `timeSlot` | text | Time range (e.g. "0800-2000") |
| `locationPk` | select | Location (see below) |
| `posPks` | select-multiple | Position(s) — C Call Receiver, B Dispatcher |
| `fixed` | checkbox | "Fixed coverage overtime" — pre-checked |
| `overtimeCodePk` | select | Reason for OT (see full list below) |
| `requestSupNote` | textarea | Note to supervisor |
| `requestSupNoteUser` | hidden | "false" — flag for note visibility |
| `jc` | hidden | Job category code |
| `jcPk` | hidden | Job category PK |
| `manage` | hidden | Management flag |
| `userIdString` | hidden | User ID |
| `recordPk` | hidden | Record PK (for editing existing request) |
| `action` | hidden | Form action |

Buttons: `Create`, `Reset`, `Cancel`

---

## Locations

| Label | Notes |
|-------|-------|
| Communications | Main dispatch floor |
| OT - out of Com Room | OT coverage outside the main com room |

---

## Positions (for OT callout)

| Label | Notes |
|-------|-------|
| C Call Receiver | Call intake position |
| B Dispatcher | Dispatch position |

> Note: A Supervisor OT is not in this list — likely handled separately or not posted as open OT.

---

## OT Reason Codes (`overtimeCodePk`)

These are the reasons WHY overtime is being called — what created the vacancy.
This is the complete list from the SE dropdown.

| # | Label | Category | Notes |
|---|-------|----------|-------|
| 1 | Sick | Leave | Employee called in sick |
| 2 | FMLA | Leave | Family Medical Leave Act absence |
| 3 | PFML | Leave | WA State Paid Family Medical Leave |
| 4 | FCL | Leave | Family Care Leave (Washington State) |
| 5 | Comp Time | Leave | Employee using comp time |
| 6 | Vacation | Leave | Employee on vacation |
| 7 | Holiday Paid | Leave | Employee on paid holiday |
| 8 | Staffing | Operational | General staffing shortage |
| 9 | Second CR Breaker | Operational | Extra Call Receiver relief/break coverage |
| 10 | Acting Supervisor | Operational | OT to fill acting supervisor role |
| 11 | ADA Sick | Leave | ADA-accommodated sick absence |
| 12 | Admin Leave | Leave | Administrative leave |
| 13 | Bereavement | Leave | Bereavement leave |
| 14 | CTO Duties \| Academy Prep | Operational | Employee on CTO duties or academy prep |
| 15 | Emergency Leave | Leave | Emergency leave |
| 16 | Long Call Hold Over | Operational | Employee held over due to long call |
| 17 | Jury Duty | Leave | Jury duty |
| 18 | L&I Sick | Leave | Labor & Industries (workers comp) sick |
| 19 | Leave of Absence | Leave | General LOA |
| 20 | LWOP | Leave | Leave Without Pay |
| 21 | Maternity | Leave | Maternity leave |
| 22 | Military | Leave | Military leave |
| 23 | Meeting | Operational | Employee pulled for a meeting |
| 24 | OT Accom | Operational | OT Accommodation (ADA or similar?) |
| 25 | Special Assignment | Operational | Employee on special assignment |
| 26 | Late Employee | Operational | Employee arrived late, coverage gap |
| 27 | Training | Operational | Employee in training |
| 28 | Unpaid Holiday | Leave | Employee taking unpaid holiday |
| 29 | Weather \| Event | Operational | Weather event causing staffing issues |

---

## Key Insights

### FCL = Family Care Leave (Washington State)
FCL is a Washington State leave category. It appears as its own OT reason code alongside
Vacation, Sick, FMLA, etc. In the absence codes it appears as a prefix: FCL Sick, FCL Vacation,
FCL Comp, FCL Holiday — these are leave types taken under the Family Care Leave umbrella.

### OT reasons split into two logical groups:
1. **Leave-based** — someone is absent due to a leave type, creating a vacancy
2. **Operational** — shift needs extra coverage for operational reasons
   (Second CR Breaker, Acting Supervisor, Long Call Hold Over, Meeting, Weather/Event, etc.)

This matters for Timeshift: when a supervisor creates an OT callout event,
they should pick a reason from this list. The reason informs reporting
and potentially the callout list rules.

---

## Absence Create Form Fields

### Step 1 (`absenceCreateForm`) — Date selection

POST to `absenceCreate.do`

| Field Name | Type | Notes |
|------------|------|-------|
| `absenceStartDate` | text | Start date of absence |
| `absenceEndDate` | text | End date of absence |
| `absenceEndDateSave` | hidden | Saved end date |
| `startTime` | hidden | Start time (populated after Continue) |
| `endTime` | hidden | End time |
| `whichTab` | hidden | Which tab in multi-tab form |
| `numTabs` | hidden | Total tabs in form |
| `allTradeOvertime` | hidden | Flag for trade/OT interaction |
| `rdoAbsence` | hidden | Regular Days Off flag |
| `verbiage` | hidden | Display text |
| `absType` | hidden | Absence type (populated in step 2) |
| `userId` | hidden | User ID |
| `action` | hidden | Form action |

Buttons: `Continue w/RDO`, `Continue`, `Reset`, `Close`

> "Continue w/RDO" sets `rdoAbsence=true` and `absType=rdo` in step 2.
> "Continue" (without RDO) sets `absType` differently — exact value TBD.

---

### Step 2 (`absenceCreate.do`) — Leave type and details

After clicking Continue, the same URL posts back with the date resolved into shift time data.
The tab label shown is "Regular" — multi-segment absences may show multiple tabs.

**Resolved date/time fields (hidden, pre-filled from step 1):**

| Field Name | Type | Value example | Notes |
|------------|------|---------------|-------|
| `absenceStartDate` | hidden | 03/01/2026 | Passed from step 1 |
| `absenceEndDate` | hidden | 03/01/2026 | Passed from step 1 |
| `option` | hidden | "hours" | Time unit mode |
| `absenceStartShift` | hidden | (empty) | Shift PK if absence is shift-linked |
| `totalOrig` | hidden | 24 | Original total hours |
| `startHrOrig` | hidden | "0000" | Original start time |
| `endHr` | hidden | "2400" | End time of shift |
| `totalDays` | hidden | 1 | Number of days |
| `startTime` | hidden | epoch ms | Start time as epoch milliseconds |
| `endTime` | hidden | epoch ms | End time as epoch milliseconds |
| `userId` | hidden | (empty) | User ID |
| `absType` | hidden | "rdo" | "rdo" if Continue w/RDO was used |
| `tradeRecordPk` | hidden | (empty) | Linked trade (if absence is trade-related) |
| `acceptRecordPk` | hidden | (empty) | Linked trade acceptance PK |
| `alternateRule` | hidden | "false" | Alternate leave rule flag |
| `whichTab` | hidden | (empty) | Current tab index |
| `numTabs` | hidden | 1 | Total tabs in form |
| `allTradeOvertime` | hidden | "false" | Trade/OT interaction flag |
| `rdoAbsence` | hidden | "true" | RDO inclusion flag |
| `verbiage` | hidden | (empty) | Display text |
| `ignoreRestrictedDateWarning` | hidden | "false" | Override date restriction warning |
| `hasRestrictedDateWarning` | hidden | (empty) | Warning flag |
| `action` | hidden | "continueF" | Form action |

**User-editable fields:**

| Field Name | Type | Notes |
|------------|------|-------|
| `total` | text | Total hours for this absence segment (e.g. "24") |
| `startHr` | text | Start time in 24h HHMM format (e.g. "0000") |
| `absenceNote` | textarea | Reason/note for the absence |
| `code1_0` | select | Leave type (slot 1) — see full list below |
| `hours1_0` | text | Hours for leave type slot 1 |
| `code1_1` | select | Leave type (slot 2) — for split absences |
| `hours1_1` | text | Hours for slot 2 |
| `code1_2` | select | Leave type (slot 3) |
| `hours1_2` | text | Hours for slot 3 |
| `code1_3` | select | Leave type (slot 4) |
| `hours1_3` | text | Hours for slot 4 |
| `code1_4` | select | Leave type (slot 5) |
| `hours1_4` | text | Hours for slot 5 |
| `emergencyContact` | textarea | Emergency contact info |
| `relationship` | text | Relation to deceased (bereavement only) |
| `relationName` | text | Name of deceased (bereavement only) |

Buttons: `Submit for Approval`, `Cancel`

**Leave type options in `code1_0` dropdown** (complete list, 26 items):
See [valleycom-leave-types.md](./valleycom-leave-types.md) for full annotated table.
Raw list: Sick, FMLA Sick, PFML, FCL Comp, FCL Holiday, FCL Sick, FCL Vacation,
BID Vacation, Comp first - Vac second, Vacation, Comp Time, Non Guaranteed Holiday,
Guaranteed Holiday, Emergency Leave, No Show, Admin Leave, Bereavement, Jury Duty,
L&I Sick, Leave of Absence, LWOP, Maternity, Military, RDO Absence (default),
Trade Made, Unpaid Holiday.

---

### Key Observations from Step 2

**Split absences:** Up to 5 leave type + hours pairs per day. Employees can split one shift
across multiple leave types (e.g. 12h Comp + 12h Vacation). The `Comp first - Vac second`
code automates the most common split.

**Trade linkage:** `tradeRecordPk` / `acceptRecordPk` fields confirm that an absence can be
created as part of a trade workflow (when you trade away a shift, the system creates an
absence record for you).

**Time bank link:** "View time bank balances" link on step 2 lets employees check available
leave balances before choosing a leave type.

**Bereavement extra fields:** `relationship` and `relationName` only relevant for Bereavement —
suggests conditional display logic needed in Timeshift UI.

---

## Volunteered OT Flow

Volunteering for OT is **not a separate form** — it's a single click action from the
Available OT list (`overtimeAvailableList.do`).

Each row in the Available OT list has a "Volunteer" link (JavaScript onclick).
Clicking it registers the employee as a volunteer for that specific OT slot.

The `overtimeVolunteered.do` page only shows and manages **existing** volunteer registrations:
- Columns: Day, Time, Valid Period, Location, Notes
- Actions: checkbox select + Delete Selected

**Active volunteer slots observed** (today 02/19/2026):
- Thu 02/19/2026, 1000-1200, Communications (Valid 02/19/2026)
- Fri 02/20/2026, 1000-1200, Communications (Valid 02/20/2026)
- Tue 02/24/2026, 1000-1200, Communications (Valid 02/24/2026)
- Wed 02/25/2026, 1000-1200, Communications (Valid 02/25/2026)

**Key insight for Timeshift:** Volunteering = employee expressing interest in a specific open OT slot.
This is different from the supervisor-initiated OT callout. Two distinct workflows:
1. Employee sees open OT, clicks Volunteer → supervisor sees pool of volunteers, assigns
2. Supervisor creates OT event, SE calls out employees by list order (mandatory/forced OT)
