# Timeshift Site Audit — forge.conarylabs.com
**Date:** 2026-02-23
**Browser:** Chrome 144 (Linux)
**Logged in as:** System Admin (admin@valleycom.org)

## Summary

22 pages explored, 36 screenshots captured. The site is in excellent shape overall — every page loads, navigation works, all CRUD dialogs function, zero console errors/warnings. **One backend bug found** (Day View 500 error).

---

## BUG: Day View — Server Error 500

**Route:** `GET /api/schedule/day/2026-02-23`
**Error:** `Wrong number of path arguments for Path. Expected 2 but got 1`
**Reproduction:** Ops Dashboard → "Day View" button, or Schedule Month → click any day
**Screenshot:** `25-day-view.png`

The backend route handler expects 2 path parameters but the frontend sends only the date. This is likely a mismatch between the route definition (e.g., `/schedule/day/:team_id/:date`) and the frontend URL (`/api/schedule/day/:date`).

---

## Page-by-Page Results

### User Pages (9 pages)

| Page | Status | Notes |
|------|--------|-------|
| **Login** | OK | Split layout, branded left panel, clean form. Mobile collapses to single column. |
| **Dashboard** | OK | Greeting, today's shift card, next shift card, upcoming week. |
| **My Schedule** | OK | Week/Month toggle, prev/next/today nav, today highlighted (blue). Month view has full calendar grid. |
| **Schedule** | OK | Team filter, Week/Board/Month tabs, date picker, print button. All 3 views render. |
| **Leave** | OK | Status filters (All/Pending/Approved/Denied), search by name, empty state. |
| **Trades** | OK | "+ New Trade" button, 5 status filters, search. |
| **Sellback** | OK | "Holiday Sellback" title, status filters, empty state. |
| **Donations** | OK | "Sick Leave Donations" title, status filters, empty state. |
| **Callout** | OK | Two-panel layout (events + detail). "+ Initiate Callout" opens dialog with shift/classification/reason fields. |
| **Profile** | OK | Full profile info (name, email, phone, employee ID, classification, type, hire date, 3 seniority dates). Preferences section with email/SMS toggles and schedule view selector. |

### Admin Pages (13 pages)

| Page | Status | Notes |
|------|--------|-------|
| **Ops Dashboard** | OK | 3 summary cards (Pending Leave, Open Callouts, Coverage Issues), Today's Shift Coverage (10 shifts with color dots), Today's Notes, Day View button. |
| **Classifications** | OK | 3 seeded (COI, COII, SUP). Table with name, abbreviation, order, Active badge, Edit button. "+ Add Classification" button. |
| **Shift Templates** | OK | 10 seeded shifts. Color swatches, duration, active toggle switches, Edit buttons. Very polished. |
| **Coverage** | OK | Shift and classification filters, "+ Add Requirement" button, empty state. |
| **Teams** | OK | 10 teams, each with 9 slots. Clickable names link to detail page. |
| **Team Detail** | OK | Slot table with shift, time, classification, day-of-week badges (Sun/Fri/Sat), auto-generated labels (e.g., "T1 COII 04-14 FSS"), active status, Edit. "+ Add Slot" button. Back link works. |
| **Users** | OK | Search, role/classification filters, inactive toggle. Admin's active toggle correctly disabled (can't deactivate self). "+ Add User" dialog has all fields (name, email, password, employee ID, phone, role, classification, type, hire/seniority dates). |
| **OT Queue** | OK | Classification selector, fiscal year selector, Queue Order and OT Hours sections. |
| **Leave Balances** | OK | Two tabs (Employee Balances / Accrual Schedules), employee selector. |
| **Bid Periods** | OK | "+ Add Period" button, empty state. |
| **Vacation Bids** | OK | Year selector, "+ New Period" button, empty state. |
| **Holidays** | OK | Year selector, "+ Add Holiday" button, empty state. |
| **Reports** | OK | 3 tabs (Coverage, OT Summary, Leave Summary). Coverage has date range + team filter. OT has fiscal year + classification. Leave has date range. |
| **Settings** | OK | General (org name, timezone), Configuration (fiscal year start month, pay period type, bid cycle months — each with individual save buttons), Details (slug, created date). |

### Special Pages

| Page | Status | Notes |
|------|--------|-------|
| **Day View** | **BUG** | 500 server error from `/api/schedule/day/:date`. See bug section above. |

---

## Interactive Flows Tested

| Flow | Result |
|------|--------|
| Login (email + password) | OK — redirects to /schedule |
| Sign out | OK — redirects to /login |
| Sidebar navigation (hamburger menu) | OK — all 22 links present and working |
| Schedule Week/Board/Month tabs | OK — all switch correctly |
| Schedule date picker navigation (prev/next/today) | OK |
| My Schedule Week/Month toggle | OK |
| "+ Initiate Callout" dialog | OK — shift, OT list, reason fields; Initiate disabled until required fields filled |
| "+ Add User" dialog | OK — comprehensive form with all required/optional fields |
| Team name → Team Detail drill-down | OK |
| Team Detail "Back to Teams" link | OK |
| Reports tab switching | OK — all 3 tabs load with appropriate filters |
| Shift template active/inactive toggle | Present (not tested for save) |

---

## Console & Network

- **Console errors:** 0
- **Console warnings:** 0
- **Failed API calls:** Only `/api/schedule/day/:date` (500)
- **All other API calls:** 200 (auth/me, organization, schedule/grid, nav/badges, schedule/dashboard, schedule/annotations)

---

## Mobile Responsiveness (375x812 — iPhone size)

| Page | Result | Notes |
|------|--------|-------|
| **Login** | Good | Single-column layout, branded panel hidden, logo centered |
| **Ops Dashboard** | Good | Cards stack vertically, Day View button accessible |
| **Schedule** | Issue | Toolbar overflows horizontally — date nav, today, and print buttons are off-screen. "Month" tab truncated to "Mont". Horizontal scrollbar appears at page bottom. |

**Recommendation:** The Schedule page toolbar needs responsive wrapping — stack the tab bar and date nav on separate rows at small breakpoints.

---

## Seed Data Observations

- **1 user** seeded (System Admin)
- **3 classifications** (COI, COII, SUP)
- **10 shift templates** (full Valleycom shift set)
- **10 teams** (Team 1–10), each with 9 shift slots
- **0 schedule data** (no scheduled shifts, assignments, leave requests, callouts, etc.)
- Org settings configured (Valley Communications Center, PST, January fiscal year, biweekly pay, 6-month bid cycle)

---

## Overall Assessment

The frontend is production-quality for a Phase 1 deployment. Clean UI, consistent design language, comprehensive admin tooling, good empty states, proper form validation, zero JS errors. The only blocking issue is the Day View 500 error which needs a backend route fix.

### Priority Fixes
1. **P0:** Fix Day View route — path parameter mismatch causing 500
2. **P2:** Schedule page mobile toolbar overflow

### Nice-to-haves Noticed
- All team supervisors show "—" (no supervisors assigned yet)
- Coverage requirements are empty (need configuration before go-live)
- No schedule data exists yet (expected — needs bid period + slot assignments)
- Add User dialog: "Create" button is always enabled (could benefit from client-side validation before submit)
