# Timeshift QA Test Plan — Chrome DevTools MCP

Test the production site at **https://forge.conarylabs.com** by logging in as each role and exercising features. Record all findings (bugs, console errors, UI issues, access control problems) in `qa-test-results.md`.

## Setup

- Open `qa-test-results.md` for writing. Use the template at the bottom of this document.
- Before each test section, open the browser console and clear it.
- After each page navigation or action, check the console for errors/warnings and note them.

---

## Phase 1: Employee Login (Mike Johnson)

### 1.1 Login
- Navigate to https://forge.conarylabs.com
- Log in with `mike.johnson@valleycom.org` / `admin123`
- Verify: redirected to employee dashboard (not admin)
- Record: what page loads, any console errors

### 1.2 Sidebar Navigation
- Record every sidebar link visible to this user
- Verify these admin-only pages are NOT accessible (try navigating directly):
  - `/users` (User Management)
  - `/classifications` (Classifications)
  - `/org-settings` (Organization Settings)
  - `/schedule/periods` (Schedule Periods)
  - `/reports` (Reports)
- Record: what happens when accessing restricted pages (redirect? error? blank?)

### 1.3 My Dashboard
- Navigate to My Dashboard
- Record: what widgets/cards are shown, any data displayed, any errors

### 1.4 My Schedule
- Navigate to My Schedule
- Try switching between Week, Month, Day views
- Record: does the calendar render? Any data? Any console errors?

### 1.5 My Profile
- Navigate to My Profile
- Verify profile info displays correctly:
  - Name: Mike Johnson
  - Email: mike.johnson@valleycom.org
  - Classification: Communications Officer II
  - Employee Type: Regular Full Time
  - Hire Date: June 1, 2018
- Try toggling Email/SMS notification preferences
- Click "Save Preferences"
- Record: does save succeed? Toast message? Console errors?

### 1.6 Leave Requests
- Navigate to Leave page
- Record: what is shown (empty list expected for new user)
- Click "New Request" or equivalent
- Try submitting a leave request (use a future date, type: Posted Vacation)
- Record: does the form open? Can it be submitted? Any validation errors?
- If created, try cancelling it
- Record: results of each action

### 1.7 Trades
- Navigate to Trades page
- Record: what is shown

### 1.8 Available OT
- Navigate to Available OT
- Record: what is shown (may be empty)
- If any OT requests exist, try volunteering

### 1.9 Volunteered OT
- Navigate to Volunteered OT
- Record: what is shown

### 1.10 Vacation Bids
- Navigate to Vacation Bids (employee view)
- Record: what is shown

### 1.11 Logout
- Click logout
- Verify: redirected to login page
- Verify: cannot access protected pages after logout

---

## Phase 2: Supervisor Login (Sarah Chen)

### 2.1 Login
- Log in with `sarah.chen@valleycom.org` / `admin123`
- Record: what page loads, sidebar items visible

### 2.2 Sidebar — Supervisor vs Employee
- Record every sidebar link visible
- Compare to Mike Johnson's sidebar — note any additional items
- Supervisors should see schedule management, leave approval, and similar management features

### 2.3 Schedule Views
- Navigate to Schedule (grid view)
- Record: does the grid render? Teams visible? Any console errors?
- Navigate to Day View (click a date or go to `/schedule/day/2026-02-24`)
- Record: does day view render?

### 2.4 Leave Management
- Navigate to Leave page
- Verify: supervisor should see all leave requests (not just their own)
- If Mike's leave request from Phase 1 exists, try approving or denying it
- Record: results

### 2.5 Trade Management
- Navigate to Trades
- Record: can supervisor see/review trades?

### 2.6 Callout
- Navigate to Callout
- Record: what is shown, can supervisor create a callout event?

### 2.7 OT Requests (Admin)
- Navigate to OT Requests management
- Try creating a new OT request
- Record: form fields available, validation, submission result

### 2.8 Restricted Admin Pages
- Try navigating directly to admin-only pages:
  - `/users`
  - `/classifications`
  - `/org-settings`
- Record: which pages are accessible to supervisor, which are blocked

### 2.9 Logout
- Log out

---

## Phase 3: Admin Login (System Admin)

### 3.1 Login
- Log in with `admin@valleycom.org` / `admin123`
- Record: what page loads, all sidebar items visible

### 3.2 User Management
- Navigate to Users page
- Verify all 5 users are listed
- Click on a user to view details
- Record: user list renders correctly? All fields populated?

### 3.3 Classifications
- Navigate to Classifications
- Verify 3 classifications shown (COI, COII, Supervisor)
- Record: any issues

### 3.4 Teams
- Navigate to Teams
- Verify 10 teams listed
- Click Team 1 — verify Sarah Chen is listed as supervisor
- Record: team detail page content

### 3.5 Schedule Periods
- Navigate to Schedule Periods
- Try creating a new schedule period (use a future date range)
- Record: form works? Created successfully?
- If created, try deleting it to clean up

### 3.6 Shift Templates
- Navigate to Shift Templates
- Verify 10 templates listed (04-1400 through 22-0800)
- Record: any issues

### 3.7 Coverage Requirements
- Navigate to Coverage Requirements
- Record: what is shown

### 3.8 Leave Balances
- Navigate to Leave Balances
- Record: are all users listed? Any balances shown?

### 3.9 OT Queue
- Navigate to OT Queue
- Record: what is shown

### 3.10 Vacation Bids (Admin)
- Navigate to Vacation Bids admin
- Click "+ New Period" button
- Fill in: Year 2026, Round 1, Bargaining Unit "(All employees)"
- Click Create
- Record: does the dialog open without crashing? Does creation succeed?
- If created, try "Open Bidding" and then delete the period to clean up

### 3.11 Holiday Calendar
- Navigate to Holiday Calendar
- Record: what is shown, try adding a holiday

### 3.12 Reports
- Navigate to Reports
- Check Coverage, OT Summary, Leave Summary tabs/pages
- Record: do reports render? Any data?

### 3.13 Organization Settings
- Navigate to Org Settings
- Verify org name, timezone displayed
- Verify configuration section (Fiscal Year, Pay Period, Bid Cycle) renders
- Do NOT change values — just verify the page loads correctly
- Record: any issues

### 3.14 Logout
- Log out

---

## Phase 4: Cross-Cutting Checks

### 4.1 Console Errors
- Summarize all console errors/warnings found across all phases
- Note which pages and which users

### 4.2 Broken Links / 404s
- List any navigation links that lead to 404 or blank pages

### 4.3 Role Enforcement
- Summarize: were employees blocked from admin pages? Were supervisors blocked from admin-only pages?

### 4.4 Responsive/Layout
- Note any layout issues, overflow, or broken styling observed

### 4.5 Error Handling
- Note any unhandled errors, "Something went wrong" screens, or missing error messages

---

## Results Template

Use this template for `qa-test-results.md`:

```markdown
# Timeshift QA Test Results

**Date:** [date]
**Tester:** Chrome DevTools MCP
**Site:** https://forge.conarylabs.com

## Summary

- Total issues found: [N]
- Critical (blocking): [N]
- High (functional bug): [N]
- Medium (UX/polish): [N]
- Low (cosmetic): [N]

## Phase 1: Employee (Mike Johnson)

### Login
- [ ] Login successful
- [ ] Redirected to correct page
- Console errors: [none / list]

### Sidebar
- Visible items: [list]
- Restricted pages blocked: [yes/no, details]

### My Dashboard
- [notes]

### My Schedule
- [notes]

### My Profile
- [notes]

### Leave Requests
- [notes]

### Trades
- [notes]

### Available OT
- [notes]

### Volunteered OT
- [notes]

### Vacation Bids
- [notes]

---

## Phase 2: Supervisor (Sarah Chen)

### Login
- [notes]

### Sidebar
- Visible items: [list]
- Additional vs employee: [list]

### Schedule Views
- [notes]

### Leave Management
- [notes]

### Callout
- [notes]

### OT Requests
- [notes]

### Restricted Pages
- [notes]

---

## Phase 3: Admin (System Admin)

### Login
- [notes]

### User Management
- [notes]

### Classifications
- [notes]

### Teams
- [notes]

### Schedule Periods
- [notes]

### Shift Templates
- [notes]

### Coverage Requirements
- [notes]

### Leave Balances
- [notes]

### OT Queue
- [notes]

### Vacation Bids
- [notes]

### Holiday Calendar
- [notes]

### Reports
- [notes]

### Org Settings
- [notes]

---

## Phase 4: Cross-Cutting

### Console Errors
| Page | User | Error |
|------|------|-------|
| | | |

### Broken Links
| Link | From Page | Result |
|------|-----------|--------|
| | | |

### Role Enforcement
- [summary]

### Layout Issues
- [notes]

### Error Handling
- [notes]

---

## Issue List

| # | Severity | Phase | Page | Description |
|---|----------|-------|------|-------------|
| 1 | | | | |
```
