I need you to explore ScheduleExpress (scheduleexpress.com) using Chrome DevTools MCP
to document features I haven't captured yet. I'm logged in as Peter Permenter at
Valleycom. The goal is to inform development of Timeshift, our replacement app.

## Priority 1: Answer these specific open questions

### Coverage: per-shift or per-day?
On the Coverage Grid (coverageGridView.do), the Max for "B Dispatcher" shows 13 but
daily totals are 24-30. This suggests coverage requirements are per-shift, not per-day
(Valleycom runs 24/7 with overlapping shifts). Can you confirm?
- Check if Coverage Grid has a Day view that breaks it down by time slot
- Look at coverageGridView.do?view=day — does it show per-shift or per-half-hour coverage?
- Check if there's a shift-level breakdown under each job category row

### "Valid Period" on Volunteered OT
On overtimeVolunteered.do, there's a "Valid Period" column. What does it contain?
- Navigate to overtimeVolunteered.do and capture a few rows with their Valid Period values
- Is it a date range? A shift time range? Something else?
- If there are no active volunteer entries, check overtimeAvailableList.do and volunteer
  for one temporarily to see the form fields (then delete it)

### Absence Create step 2 — absType behavior
On absenceCreate.do, after clicking "Continue" past the date picker:
- What does step 2 look like? Is there a dropdown for absence type/reason?
- What absence types are available in the dropdown?
- Are different fields shown depending on the type selected (e.g., sick vs vacation)?
- Is there a "partial day" option (request leave for only part of a shift)?
- What does "Continue w/RDO" do differently from "Continue"?

## Priority 2: Supervisor/admin screens we haven't explored

NOTE: I'm logged in as an employee, so some admin screens may not be accessible.
Explore what you can and note what's blocked.

### Schedule Management screens
- coverageAssignmentView.do — What does "View Coverage Assignment" show?
- positionAssignmentView.do — "Duty Assignment by Requirement" — what's the layout?
- positionAssignmentSummaryView.do?view=week — "Duty Assignment by User"
- scheduleCoverageList.do — "Coverage Exceptions" — what are they?

### Schedule Grid features
- On scheduleView.do, click the "Legend" link and capture its full contents
- Try the "Filter: New" and "Filter: Saved" features — what filter options exist?
- Click on an employee row to expand it — what detail appears?
- In Week view, are there any edit controls visible?

### OT workflow details
- overtimeUserRequest.do — What form fields does the OT request have?
- On overtimeAvailableList.do, what do the *, !, and $ symbols mean in practice?
  (Legend says: * = Queued, ! = Flagged, $ = Deferred)
- overtimeAssignView.do — what columns/actions are on assigned OT?

### Reports
- userReportList.do — What reports are available to employees?
- Capture the report names and any parameters they accept

### Special Assignments
- specialAssignmentView.do — What's listed here?
- If there are entries, click into one (specialAssignmentDetail.do) and capture the fields

### Messaging
- inbox.do?action=view — What does the messaging system look like?
- Message format, sender types, any categories?

## Priority 3: Anything else interesting

- Any JavaScript events or AJAX endpoints that reveal hidden functionality
- Form validation messages that hint at business rules
- Tooltip content on any elements (hover states)
- Any indication of permission levels (what would a supervisor see differently?)
- Check the page source/network tab for any API calls that return config data
  (shift definitions, coverage rules, etc.)

## Output format

Write findings to a markdown file. For each item:
1. What you found (with actual data/values observed)
2. Screenshot descriptions if visual layout matters
3. Questions or ambiguities that remain
4. Implications for Timeshift's design
