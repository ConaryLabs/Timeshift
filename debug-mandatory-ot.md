# Timeshift QA: Full Site Audit + Mandatory OT Bug

This document is a testing prompt for Chrome MCP DevTools. Work through each part sequentially. Report findings as you go.

**Site:** `http://localhost:5173`

---

# Part A: General Site Health (All Roles)

Test the app across three login levels. For each role, log in, explore every reachable page, and report issues.

## Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@valleycom.org` | `admin123` |
| Supervisor | `sarah.chen@valleycom.org` | `admin123` |
| Employee | `mike.johnson@valleycom.org` | `admin123` |

## A1: Login & Auth Flow

1. Start logged out. Navigate to `http://localhost:5173`. Confirm you're redirected to the login page.
2. Try logging in with a wrong password. Confirm an error message appears (not a blank screen or unhandled crash).
3. Log in as **Admin** (`admin@valleycom.org` / `admin123`). Confirm redirect to a dashboard page.
4. Check the Network tab: confirm the login response sets `auth_token` and `refresh_token` as HttpOnly cookies (you'll see `Set-Cookie` headers, not JSON body tokens).
5. Refresh the page. Confirm you stay logged in (session persists via cookies).
6. Click Logout. Confirm you're returned to the login screen and that navigating to a protected route (e.g., `/dashboard`) redirects back to login.

**Report:** Any errors, unexpected redirects, or console warnings during auth flow.

## A2: Admin Role — Full Navigation Walkthrough

Log in as **Admin**. Visit every page in the sidebar, one by one. For each page:
- Does it load without errors? (Check console for red errors)
- Does it show data or an appropriate empty state? (No blank white screens)
- Do tables render rows? Do charts/cards show numbers?
- Are there any 401/403/500 errors in the Network tab?

### Pages to visit (follow the sidebar top to bottom):

**Operations section:**
- Ops Dashboard (`/admin/dashboard`) — Should show metrics cards, coverage summary, quick-action buttons
- Daily Staffing (`/staffing/resolve`) — Should show a date picker and a Gantt-style coverage grid with colored blocks per classification. Try changing the date.
- Approvals (`/approvals`) — Should show tabs for Leave and Trades with pending counts. If no pending items, should show an empty state.
- Callout (`/callout`) — Should show a list of callout events, or empty state
- Reports (`/admin/reports`) — Should show report tabs (Coverage, OT Summary, Leave Summary, etc.). Click each tab.

**Personal section:**
- My Dashboard (`/dashboard`) — Should show the logged-in user's personal dashboard (upcoming shifts, leave balances, action items)
- My Schedule (`/my-schedule`) — Should show personal schedule calendar
- Schedule (`/schedule`) — Should show a staffing grid (multi-week view with employees as rows, dates as columns)
- Duty Board (`/duty-board`) — Should show duty positions and current assignments

**Requests section:**
- Leave (`/leave`) — Should show leave requests list with filters. Try clicking "New Request" if available.
- Trades (`/trades`) — Should show trade requests list
- Sellback (`/leave/sellback`) — Should show holiday sellback requests
- Donations (`/leave/donations`) — Should show sick leave donations

**Overtime section:**
- Available OT (`/available-ot`) — Should show available OT request slots
- Volunteered OT (`/volunteered-ot`) — Should show user's volunteered OT

**Team section:**
- Teams (`/admin/teams`) — Should list teams. Click into one to see team detail with shift slots.
- Assignments (`/admin/special-assignments`) — Should list special assignments
- Duty Positions (`/admin/duty-positions`) — Should list positions
- Shift Patterns (`/admin/shift-patterns`) — Should list patterns

**Configuration section:**
- Shift Templates (`/admin/shift-templates`) — Should list shift templates with times, colors
- Classifications (`/admin/classifications`) — Should list classifications (COI, COII, Supervisor, etc.)
- Coverage Plans (`/admin/coverage-plans`) — Should list coverage plans. Click into one to see slot grid.

**People section:**
- Users (`/admin/users`) — Should list all users with roles, classifications. Click into one user.
- OT Queue (`/admin/ot-queue`) — Should show OT queue ordering per classification
- Leave Balances (`/admin/leave-balances`) — Should show balances table with hours per leave type

**Scheduling section:**
- Bid Periods (`/admin/schedule-periods`) — Should list schedule periods
- Vacation Bids (`/admin/vacation-bids`) — Should list vacation bid periods
- Holidays (`/admin/holidays`) — Should show holiday calendar

**Settings:**
- Settings (`/admin/settings`) — Should show org settings form

**Report for each page:** Page name, did it load, any errors (console or network), any visual issues (overlapping text, broken layout, missing data that should be there).

## A3: Supervisor Role — Navigation & Permissions

1. Log out, then log in as **Supervisor** (`sarah.chen@valleycom.org` / `admin123`)
2. **Check the sidebar:** Supervisor should see Operations section (Ops Dashboard, Daily Staffing, Approvals, Callout, Reports) and Team section, but should NOT see Configuration, People, or Scheduling admin sections.
3. Visit each page the supervisor CAN see. Confirm they load and show data.
4. Try navigating directly to an admin-only page by typing the URL:
   - `/admin/users` — Should show access denied or redirect, NOT the user list
   - `/admin/settings` — Same, should be blocked
   - `/admin/classifications` — Same
5. **Report:** Which pages are accessible, which are correctly blocked, any permission leaks.

## A4: Employee Role — Navigation & Permissions

1. Log out, then log in as **Employee** (`mike.johnson@valleycom.org` / `admin123`)
2. **Check the sidebar:** Employee should see personal sections only — Dashboard, My Schedule, Schedule, Duty Board, Requests (Leave/Trades/Sellback/Donations), Overtime (Available OT/Volunteered OT). NO Operations, Team, or Config sections.
3. Visit each page. Confirm they load.
4. Try navigating directly to restricted pages:
   - `/admin/dashboard` — Should be blocked
   - `/staffing/resolve` — Should be blocked (supervisor+ only)
   - `/approvals` — Should be blocked
   - `/admin/users` — Should be blocked
5. **On the Leave page:** Can the employee create a new leave request? Walk through the form — pick a leave type, date range, submit. Does it show as pending?
6. **On Available OT:** Does it show OT request slots? Can the employee volunteer for one?
7. **On My Dashboard:** Does it show their upcoming shifts, leave balances, any action items?
8. **Report:** Which pages are accessible, which are blocked, any permission leaks, form functionality.

## A5: Cross-Cutting Checks

With any login:
1. **Responsive/mobile:** Resize the browser to mobile width (~375px). Does the sidebar collapse to a hamburger? Can you navigate? Do tables scroll horizontally or break?
2. **Console errors:** At any point, are there persistent console errors (red) that appear on every page load? Note recurring ones.
3. **Network errors:** Are there any API calls that consistently return 4xx/5xx across multiple pages?
4. **Loading states:** When navigating between pages, do you see loading spinners/skeletons, or do pages flash empty then fill in? Note any pages that feel broken during load.
5. **Stale data after actions:** After creating/editing something (e.g., approve a leave request as admin, then switch to the employee view), does the data reflect the change?

**Report:** A summary of all cross-cutting issues found.

---

# Part B: Mandatory OT Bug Investigation

## Problem

When assigning mandatory OT to an employee who is already on shift (holdover or early callout), the Gantt view in StaffingResolvePage shows **only** the OT hours block. The employee's regular shift bar disappears, making it look like a day-off mandatory when it's not.

## Setup

1. Navigate to `http://localhost:5173`
2. Login as admin: `admin@valleycom.org` / `admin123`
3. Navigate to **Daily Staffing** (the StaffingResolvePage, route: `/staffing/resolve`)
4. Pick a date that has a **red block** (understaffed) for any classification — or note which date/classification combos show red. If none are red, try dates where leave requests reduce coverage.

## Investigation Steps

### Step 1: Capture the BEFORE state of day-grid

1. Open Chrome DevTools Network tab, filter to `XHR/Fetch`
2. Clear the network log
3. Load/refresh the StaffingResolvePage for the chosen date
4. Find the request to: `GET /api/coverage-plans/day-grid/{date}`
5. **Record the full JSON response.** Specifically note:
   - For each classification, for each block, list the `employees` array
   - For any employee who appears across multiple blocks, note their `assignment_id`, `shift_start`, `shift_end`, `is_overtime`, and which block indices they appear in
   - Count how many unique `assignment_id` values exist per employee per classification

**Question to answer:** Does each on-shift employee have exactly ONE `assignment_id` across all blocks they cover? Or do some have multiple?

### Step 2: Identify a target employee for mandatory OT

Pick an employee who:
- Is currently working a regular (non-OT) shift (`is_overtime: false`)
- Their shift ends at or near a red (understaffed) block boundary
- They are the same classification as the red block

Note down:
- Employee name and `user_id`
- Their `assignment_id` from the day-grid response
- Their `shift_start` and `shift_end`
- Which block indices they appear in (the `employees` arrays)

### Step 3: Click the red block to open the resolve sheet

1. Click the red block that's adjacent to the target employee's shift end (for holdover) or start (for early callout)
2. A bottom sheet should open with callout/OT request options
3. Note: Does the sheet call any additional API endpoints? Check Network tab for:
   - `GET /api/staffing/block-available?date=...&classification_id=...&block_start=...&block_end=...`
   - `GET /api/schedule/day/{date}` (used by the mandatory OT dialog for eligibility)
4. **Record the `block-available` response** — note `scheduled_shift_id`, `shift_template_name`, existing OT requests

### Step 4: Open Mandatory OT dialog and select the target employee

1. Click "Mandatory OT" button in the resolve sheet
2. The MandatoryOTDialog should open
3. **Check:** Does the target employee appear in the mandatory OT list? They should if they're on an adjacent shift.
4. Note their position in the list and the displayed OT time range (holdover or early callout)
5. **Check:** Is the displayed OT time range correct? For holdover it should be `shift_end` to `shift_end + 2h`. For early callout it should be `shift_start - 2h` to `shift_start`.

### Step 5: Assign the mandatory OT — capture all network traffic

1. Keep Network tab open and clear it
2. Select the target employee and click "Assign Mandatory OT"
3. **Capture these requests IN ORDER:**

   **Request A — Create OT Request:**
   - URL: `POST /api/ot-requests`
   - Record the request body (especially `date`, `start_time`, `end_time`, `classification_id`, `is_fixed_coverage`, `notes`)
   - Record the response (especially the `id` of the created OT request)
   - Record the HTTP status code

   **Request B — Assign to OT Request:**
   - URL: `POST /api/ot-requests/{id}/assign`
   - Record the request body (especially `user_id`, `ot_type`)
   - Record the response
   - Record the HTTP status code

   **Request C — Query invalidation refetches (there will be several):**
   - Look for refetches of `GET /api/coverage-plans/day-grid/{date}` — this is the critical one
   - Also look for refetches of `GET /api/schedule/day/{date}`, any `ot-requests` fetches, any `staffing` fetches
   - Note the order these fire in

### Step 6: Capture the AFTER state of day-grid (THE KEY STEP)

1. Find the `day-grid` refetch response from Step 5C
2. **Record the full JSON response.** Compare to the BEFORE response from Step 1.
3. **Critical questions:**

   a. **Does the target employee still appear in the blocks their regular shift covers?**
      - Look at the same block indices from Step 2
      - Is their original `assignment_id` still in the `employees` arrays?
      - Or has it disappeared?

   b. **Does the target employee appear in the new OT block?**
      - Look at the block(s) the OT time range covers
      - Is there a NEW entry with `is_overtime: true` and a different `assignment_id`?
      - What are the `shift_start`, `shift_end`, `shift_name` values on the OT entry?

   c. **Are there now TWO entries for this employee (regular + OT) or just ONE (OT only)?**
      - Scan ALL blocks for this employee's `user_id`
      - List every `assignment_id` associated with this user across all blocks
      - Compare to the BEFORE list

   d. **Did any OTHER employees disappear or change between BEFORE and AFTER?**

### Step 7: Check the frontend Gantt rendering

1. In the Elements tab, find the Gantt container for the relevant classification
2. Look for the employee's bar(s) — they should be positioned with CSS `left` and `width` percentages
3. **Questions:**
   - How many bars exist for this employee? (should be 2: regular + OT)
   - If only 1 bar, what are its `left%` and `width%` values? Do they match the OT window or the original shift?
   - Is there a bar with `left` near 0% that got clipped off-screen?

4. In the Console tab, check for any React errors or warnings after the mutation

### Step 8: Inspect React component state (React DevTools)

1. Open React DevTools (Components tab)
2. Find the `ClassificationRow` component for the affected classification
3. Look at its props/state:
   - `blocks` array — does each block still have the right `employees`?
   - The `uniqueAssignments` memo — how many entries does it have for the target employee?
   - If there's a `useMemo` for `uniqueAssignments`, what does it contain?
4. Find the `StaffingResolvePage` component
5. Check the `dayGrid` query data — is it the same as the network response, or has it been transformed?

### Step 9: Test the backend directly (optional confirmation)

If the day-grid response from Step 6 is ALREADY missing the regular assignment (bug is backend), run this in the browser console or via curl:

```
fetch('/api/coverage-plans/day-grid/{date}', { credentials: 'include' })
  .then(r => r.json())
  .then(d => {
    const targetUserId = '{user_id from Step 2}'
    d.classifications.forEach(c => {
      c.blocks.forEach(b => {
        const found = b.employees.filter(e => e.user_id === targetUserId)
        if (found.length) console.log(`Block ${b.block_index} (${b.start_time}-${b.end_time}):`, found)
      })
    })
  })
```

This confirms whether the backend is returning the employee's regular shift or not.

---

## What to Report Back

Please provide:

1. **BEFORE day-grid response** — just the blocks/employees for the affected classification (can truncate other classifications)
2. **AFTER day-grid response** — same classification, full blocks/employees
3. **The POST /api/ot-requests request body and response**
4. **The POST /api/ot-requests/{id}/assign request body and response**
5. **Answers to the critical questions in Step 6 (a through d)**
6. **The number of Gantt bars rendered for the target employee after assignment (Step 7)**
7. **Any console errors or React warnings**
8. **If the regular assignment is missing from the AFTER response: confirm via Step 9 that a fresh fetch also shows it missing**

## Likely Root Cause Hypotheses

The backend `day-grid` endpoint (`coverage_plans.rs:day_grid`) builds employee lists from 4 separate queries:
1. Regular assignments (today)
2. Overnight regular assignments (yesterday, midnight-crossing)
3. OT request assignments (today)
4. Overnight OT request assignments (yesterday, midnight-crossing)

It uses a `user_slot_covered` HashSet to prevent double-counting `(user_id, classification_id, slot)`. **If the OT assignment query runs BEFORE or interferes with the regular assignment tracking, the regular shift could get suppressed.** The key thing to determine is whether the bug is:

- **Backend:** The `day-grid` response is already wrong (regular assignment missing)
- **Frontend:** The `day-grid` response is correct but `uniqueAssignments` deduplication in `ClassificationRow` merges them incorrectly (e.g., if both entries somehow share the same `assignment_id`)

---

# Part C: Final Summary

After completing Parts A and B, provide a single consolidated report with:

1. **Auth:** Any issues with login/logout/session persistence across all 3 roles
2. **Permission leaks:** Any pages an employee or supervisor can reach that they shouldn't
3. **Broken pages:** Any pages that crash, show blank, or have 500 errors
4. **Console errors:** List of unique console errors seen (deduplicated)
5. **Network errors:** List of any consistently failing API calls (endpoint + status code)
6. **Visual/UX issues:** Overlapping elements, broken layouts, unreadable text, missing empty states
7. **Data issues:** Stale data, wrong counts, missing records that should be there
8. **Mandatory OT bug verdict:** Is the bug in the backend response or frontend rendering? Include the BEFORE/AFTER day-grid comparison data.
9. **Mobile:** Does the sidebar hamburger work? Any layout breaks at mobile width?

Rate each finding as: **Critical** (blocks usage), **Major** (wrong behavior but workaround exists), or **Minor** (cosmetic/polish).
