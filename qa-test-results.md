# Timeshift QA Test Results

**Date:** 2026-02-24
**Tester:** Chrome DevTools MCP
**Site:** https://forge.conarylabs.com

## Summary

- Total issues found: 4
- Critical (blocking): 1
- High (functional bug): 1
- Medium (UX/polish): 1
- Low (cosmetic/data): 1

---

## Phase 1: Employee (Mike Johnson)

### Login
- [x] Login successful (`mike.johnson@valleycom.org` / `admin123`)
- [x] Redirected to `/schedule` (not admin dashboard)
- Console errors: none

### Sidebar
- Visible items: Dashboard, My Schedule, Schedule, Leave, Trades, Sellback, Donations, Available OT, My Volunteered OT, Profile
- No "ADMIN" section visible (correct)
- Missing vs admin: Callout, Vacation Bids (employee view), and entire ADMIN section
- Restricted pages blocked:
  - `/admin/users` — Access Denied
  - `/admin/classifications` — Access Denied
  - `/admin/settings` — Access Denied
  - `/admin/schedule-periods` — Access Denied
  - `/admin/reports` — Access Denied
  - All show "Access Denied — You don't have permission to view this page." with "Back to Schedule" link

### My Dashboard
- OK — "Good afternoon, Mike", Today's Shift (Day Off), Next Shift (none), Upcoming Week (empty with "Full Schedule" link)
- Console errors: none

### My Schedule
- Week view: OK — Shows Sun-Sat with "Off" for each day, prev/next/today nav
- Month view: OK — Full calendar grid for February 2026
- Day view: Not available on My Schedule (only Week/Month toggles)
- Console errors: none

### My Profile
- Name: Mike Johnson ✓
- Email: mike.johnson@valleycom.org ✓
- Phone: 253-555-0201 ✓
- Employee ID: EMP001 ✓
- Classification: Communications Officer II ✓
- Employee Type: Regular Full Time ✓
- **Hire Date: Shows "—" (expected "June 1, 2018")** — see Issue #4
- Overall/BU/Classification Seniority: all "—" (not seeded)
- Preferences: Email toggle (on), SMS toggle (off), Schedule View (Week)
- Toggled SMS on → Save → "Preferences saved" toast → button disables → toggled back
- Console errors: none

### Leave Requests
- Page loads with "+ Request Leave" button, status filters (All/Pending/Approved/Denied), empty state
- Clicked "+ Request Leave" — inline form opens with Type dropdown (26 leave types), Start/End date pickers, Reason text field, Submit button (disabled until filled)
- Selected "Posted Vacation", set dates to 2026-03-15, entered reason
- **Submit fails with 422** — see Issue #1
- Console errors: none (error returned as API response)

### Trades
- Page loads with header, "+ New Trade" button, 5 status filters, search bar
- **"Insufficient permissions" toast appears** — see Issue #2
- Console errors: 2x `403` on `GET /api/users`

### Available OT
- OK — Available/Filled/All tabs, classification filter ("All positions"), date range filters
- Empty state: "No OT slots are currently available."
- No "+ Create" button for employees (correct — only supervisors/admins)
- Console errors: none

### Volunteered OT
- OK — Empty state: "You have not volunteered for any OT slots."
- Helpful "Browse Available OT" link to `/available-ot`
- Console errors: none

### Vacation Bids
- Not in employee sidebar
- Direct nav to `/vacation-bids` and `/bids` both redirect to `/dashboard`
- No employee vacation bid page exists (expected — may require active bid period)

### Logout
- [x] Sign out → redirected to `/login`
- [x] Navigating to `/dashboard` after logout → redirected to `/login` (protected pages blocked)

---

## Phase 2: Supervisor (Sarah Chen)

### Login
- [x] Login successful (`sarah.chen@valleycom.org` / `admin123`)
- [x] Redirected to `/schedule`
- Console errors: none

### Sidebar
- Visible items: Dashboard, My Schedule, Schedule, Leave, Trades, Sellback, Donations, Available OT, My Volunteered OT, **Callout**, Profile
- ADMIN section: **Ops Dashboard, Teams, Reports** (3 items only)
- Additional vs employee: **Callout** (in main nav), plus ADMIN section with Ops Dashboard, Teams, Reports
- Missing vs admin: Classifications, Shift Templates, Coverage, Users, OT Queue, Leave Balances, Bid Periods, Vacation Bids, Holidays, Settings

### Schedule Views
- Schedule grid: OK — Week/Board/Month tabs, team filter, date nav, print button
- Day View (`/schedule/day/2026-02-24`): **OK — renders correctly!** Shows all 10 shifts with times and (+1) next-day indicators. Previously a 500 error (now fixed).
- Console errors: none

### Leave Management
- Supervisor view shows "Viewing all employee requests" subtitle, search by name, status filters
- No "+ Request Leave" button (different from employee view — correct for review role)
- Empty list (no requests exist — Mike's attempt failed with 422)
- Console errors: none

### Callout
- OK — Two-panel layout (Events + detail), "+ Initiate Callout" button visible
- Empty state: "No callout events — Initiate a callout when coverage is needed."
- Console errors: none

### OT Requests
- Supervisor sees "+ Create OT Request" button (employee doesn't)
- Create dialog opens with: Date, Start Time, End Time, Classification (required), Location, Fixed coverage checkbox (checked by default), Notes
- Create button disabled until required fields filled
- Dialog works correctly (tested open/cancel flow)
- Console errors: none

### Restricted Pages
- `/admin/users` — Access Denied ✓
- `/admin/classifications` — Access Denied ✓
- `/admin/settings` — Access Denied ✓

### Logout
- [x] Sign out → redirected to `/login`

---

## Phase 3: Admin (System Admin)

### Login
- [x] Login successful (`admin@valleycom.org` / `admin123`)
- [x] Redirected to `/schedule`
- Full sidebar: Dashboard, My Schedule, Schedule, Leave, Trades, Sellback, Donations, Available OT, My Volunteered OT, Callout, Profile + ADMIN (Ops Dashboard, Classifications, Shift Templates, Coverage, Teams, Users, OT Queue, Leave Balances, Bid Periods, Vacation Bids, Holidays, Reports, Settings)
- Console errors: none

### User Management
- [x] All 5 users listed: Admin System, Chen Sarah, Johnson Mike, Park Lisa, Rivera James
- Table shows Name, Email, Role, Classification, Type, Status (active toggle), Edit button
- Admin's own active toggle is correctly disabled (can't deactivate self)
- Search, role filter, classification filter, include-inactive toggle all present
- Console errors: none

### Classifications
- [x] 3 classifications shown: Communications Officer I (COI), Communications Officer II (COII), Supervisor (SUP)
- Table with Name, Abbreviation, Order, Status (Active), Edit button
- "+ Add Classification" button present
- Console errors: none

### Teams
- [x] 10 teams listed (Team 1–10)
- Team 1 has Sarah Chen as supervisor; Teams 2-10 show "—"
- Each has 9 slots, Active status, Edit button
- Team names are clickable buttons for drill-down
- Console errors: none

### Schedule Periods
- OK — "+ Add Period" button, empty state "No schedule periods"
- Console errors: none

### Shift Templates
- [x] 10 templates listed (04-1400 through 22-0800)
- Table shows Name, Time Range, Duration, Color (hex), active toggle, Edit button
- Durations: 10h and 12h shifts
- Console errors: none

### Coverage Requirements
- OK — "+ Add Requirement" button, shift and classification filters
- Empty state: "No coverage requirements configured"
- Console errors: none

### Leave Balances
- OK — Two tabs (Employee Balances / Accrual Schedules)
- Employee selector dropdown
- Console errors: none

### OT Queue
- OK — Classification selector, Fiscal Year selector (2026), Queue Order and OT Hours sections
- Empty state for both sections
- Console errors: none

### Vacation Bids
- OK — Year selector (2026), "+ New Period" button
- One existing period: 2026 Round 1, Draft status, "Open Bidding" button
- Console errors: none

### Holiday Calendar
- OK — Year selector (2026), "+ Add Holiday" button
- Empty state: "No holidays for this year"
- Console errors: none

### Reports
- OK — 3 tabs: Coverage, OT Summary, Leave Summary
- Coverage tab: date range filters (defaulted to current 2-week span), team filter
- Empty state: "No scheduled shifts in this range"
- Console errors: none

### Org Settings
- [x] Org name: "Valley Communications Center"
- [x] Timezone: "America/Los Angeles"
- Configuration: Fiscal Year Start Month (January), Pay Period Type (Biweekly), Bid Cycle (6 months)
- Details: Slug "valleycom", Created 2/20/2026
- Individual save buttons per section, "Save Changes" disabled until edit
- Console errors: none

### Logout
- Not tested (continuing from admin session)

---

## Phase 4: Cross-Cutting

### Console Errors
| Page | User | Error |
|------|------|-------|
| Trades | Mike Johnson (employee) | 2x `GET /api/users` 403 |

All other pages across all 3 roles: **zero console errors**.

### Broken Links
| Link | From Page | Result |
|------|-----------|--------|
| `/vacation-bids` | Direct nav (employee) | Redirects to `/dashboard` (no employee vacation bid route) |
| `/bids` | Direct nav (employee) | Redirects to `/dashboard` |

No broken sidebar links. All navigation works correctly.

### Role Enforcement
- **Employee → admin pages**: All 5 tested routes show "Access Denied" page (correct)
- **Supervisor → admin-only pages**: `/admin/users`, `/admin/classifications`, `/admin/settings` all show "Access Denied" (correct)
- **Supervisor accessible admin pages**: Ops Dashboard, Teams, Reports (correct subset)
- **Post-logout protection**: Protected pages redirect to `/login` after sign out (correct)
- Backend API enforcement: `/api/users` returns 403 for employee role (correct, but causes Trades page issue)

### Layout Issues
- None observed during testing (desktop viewport)
- Previous audit noted Schedule page toolbar overflow on mobile (375px) — not re-tested

### Error Handling
- Leave request 422 shows generic "Failed to submit leave request" toast — could benefit from more specific error message
- Trades 403 shows "Insufficient permissions" toast — confusing since the page is accessible, only the user list fetch fails
- All "Access Denied" pages have consistent design with "Back to Schedule" link

---

## Issue List

| # | Severity | Phase | Page | Description |
|---|----------|-------|------|-------------|
| 1 | **Critical** | 1 | Leave Requests | Leave request submission fails with 422. Backend rejects date strings — `start_date: invalid type: string "2026-03-15", expected a Date`. Frontend sends ISO date strings but backend deserializer expects a different type. **No user can create leave requests.** |
| 2 | **High** | 1 | Trades | Trades page fetches `GET /api/users` which returns 403 for employees. Page shows "Insufficient permissions" toast and 2 console errors. The trades list itself loads (200) but the user list needed for the "trade with" dropdown is blocked. **Employees cannot use trades.** |
| 3 | **Medium** | 1 | Vacation Bids | No employee-facing vacation bid page exists. Routes `/vacation-bids` and `/bids` redirect to dashboard. Sidebar doesn't show it either. May be by design (feature not built for employees yet) but the test plan expected an employee view. |
| 4 | **Low** | 1 | My Profile | Hire Date shows "—" for Mike Johnson. Seed data specifies June 1, 2018. Either the seed doesn't populate `hire_date` or the profile page isn't reading it. All 3 seniority dates also show "—" (likely not seeded). |
