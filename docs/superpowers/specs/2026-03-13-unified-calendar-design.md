# Unified Calendar Design Spec

**Date:** 2026-03-13
**Status:** Approved
**Scope:** Frontend-only consolidation of schedule, staffing, duty board, and personal schedule views into a single role-aware calendar

## Problem

Supervisors currently navigate 4+ separate pages (SchedulePage, DayViewPage, StaffingResolvePage, DutyBoardPage) to understand and manage a single day's staffing picture. Employees have a separate MySchedulePage disconnected from the team view. Industry best practice is a unified view with layered information.

## Goals

1. Single `/schedule` route that adapts by role (supervisor vs. employee)
2. Unified daily view combining staffing block grid, shift list, duty board, and gap resolution actions
3. Week and month views that provide context and drill down into the daily view
4. No backend changes — reuse all existing API endpoints and hooks
5. Feature parity with all replaced pages before swap

## Non-Goals

- Backend API changes
- New data models or database changes
- Mobile-specific layouts (future work)
- Changes to `/duty-board/display` kiosk view
- New features beyond what currently exists (feature parity, not feature expansion)

## Design Notes

Several aspects of this design are intentional visual redesigns of existing functionality, not ports of the existing UI:

- **Block grid cells**: The existing StaffingResolvePage uses separate "Min" and "Actual" rows below Gantt bars. The new design uses `actual/required` fractions in each cell for density. This is a redesign.
- **Week view**: The existing SchedulePage week view is a 7-column chip grid. The new week view is a compact heatmap strip + daily view. This is a full rebuild.
- **Month view**: The existing month view uses per-shift coverage dots. The new month view uses full-cell heatmap coloring. This is a redesign.

---

## URL Structure & Routing

### Single route: `/schedule`

Query params control the view:

| URL | Behavior |
|-----|----------|
| `/schedule` | Today's daily view (default) |
| `/schedule?view=day&date=2026-03-13` | Explicit daily view |
| `/schedule?view=week&date=2026-03-09` | Week view (date = week start) |
| `/schedule?view=month&date=2026-03-01` | Month view (date = month start) |

View and date are URL-driven for bookmarkability and sharing. Default view preference persisted in the UI Zustand store per user.

### Removed routes

| Old Route | Absorbed Into |
|-----------|---------------|
| `/schedule/day/:date` | `?view=day&date=YYYY-MM-DD` |
| `/staffing/resolve` | Daily view block grid + action panel |
| `/my-schedule` | `/schedule` with role-aware rendering |
| `/duty-board` | Daily view "Duty Board" tab |

### Kept separate

- `/duty-board/display` — full-screen kiosk view with auto-refresh, no chrome. Untouched.

### Sidebar nav

- Single "Schedule" link for all roles
- "Duty Board Display" link visible to supervisors+ (opens in new tab)

---

## Daily View (The Core)

### Supervisor Layout

#### Header Bar
- Date display (e.g., "Friday, March 13, 2026")
- Prev / Today / Next day buttons
- View switcher: Day | Week | Month
- Team filter dropdown (All Teams + active teams) — carried forward from existing SchedulePage
- Print button
- Add Annotation button (supervisor only) — opens dialog to add note/alert/holiday for the date
- Annotation badges (notes, alerts, holidays) displayed below header
- SavedFilterBar below header — carried forward from existing SchedulePage

#### Top Half — Staffing Block Grid
- 12 columns: 2-hour blocks (00:00-02:00 through 22:00-00:00)
- One row per classification (COI, COII, SUP)
- Each cell displays `actual/required` fraction
- Cell color by status:
  - **Red**: below minimum (intensity scales with gap severity — -3 darker than -1)
  - **Yellow**: at minimum but below target
  - **Green**: at or above target
- Current time block highlighted with border/ring
- Summary row at top aggregates across all classifications
- Expanding a classification row reveals individual employee Gantt bars
- Clicking a red cell opens the slide-out action panel (matching existing behavior — yellow cells are not actionable since staffing is at minimum)

#### Bottom Half — Shift List
- One card per shift (colored header strip, shift name, times)
- Assignment chips inside each card (name, classification badge, OT badge, trade badge, notes icon)
- Coverage badge on each shift card: `actual/required` with color

#### Tabs (below shift list)
- **Schedule** (default): the shift list described above
- **Duty Board**: console position grid (see Duty Board Tab section)

### Employee Layout

#### Header Bar
Same as supervisor (date, nav, view switcher)

#### Top Section — "My Shifts"
- Prominent card(s) showing the employee's own shifts for the day (or "Day Off" card)
- Quick action buttons: Request Leave, Request Trade (matching existing MySchedulePage actions)

#### Middle Section — Staffing Block Grid (collapsible, default collapsed)
- Same 2-hour block × classification heatmap as supervisor view, but read-only
- Shows `actual/required` fractions and color coding (red/yellow/green)
- Expanding a classification row reveals employee Gantt bars
- No cell click actions — red cells are not interactive for employees
- No action panel

#### Bottom Section — "Team Schedule" (collapsible, default collapsed)
- Shift list with coverage badges (same as supervisor view, read-only)
- Duty Board tab (read-only)

#### Not visible to employees
- Action panel (gap resolution slide-out)
- Add Annotation button
- Any edit/assign/mandate actions

---

## Week View

### Layout
- **Top: 7-day heatmap strip** — horizontal row of day cells (Sun-Sat)
  - Each cell: day abbreviation, date number
  - Background colored by worst coverage status (red/yellow/green)
  - Gap count badge in corner (e.g., "-4" red pill)
  - Selected day has prominent ring/border
  - Clicking a day updates the daily view below
- **Bottom: full daily view** for the selected day (exactly as described above, role-aware)

### Navigation
- Prev/Next move by week
- Today snaps to current week with today selected

### Employee Version
- Day cells show personal shift indicator (colored dot if working, hollow if off) plus coverage heatmap coloring (employees can see staffing levels)
- Gap count badge visible (read-only awareness)
- Selected day shows employee daily view below

---

## Month View

### Layout
- Standard calendar grid (6 rows x 7 columns, Sun-Sat)
- Each day cell:
  - Date number (bold if today, muted if outside current month)
  - Background tint: worst coverage status (red/yellow/green), light enough for readable text
  - Gap count badge if gaps exist (e.g., "-3" red pill)
  - Today gets ring/border highlight
- Clicking a day navigates to `?view=day&date=YYYY-MM-DD`

### Supervisor Extras
- Hover tooltip: gap breakdown by classification (e.g., "COI: -2, COII: -1, SUP: OK")

### Employee Version
- Day cells show personal shift indicators:
  - Colored dot/bar matching shift color if working
  - Empty/muted if day off
  - Leave request indicator icon if leave pending/approved
- Coverage heatmap coloring and gap count badges visible (read-only staffing awareness)

### Navigation
- Prev/Next move by month
- Today snaps to current month

---

## Action Panel

Slide-out right-side sheet for resolving staffing gaps. Supervisor only.

### Trigger
Clicking a red cell in the block grid (yellow cells are at minimum — not actionable).

### Panel Header
- Classification name + time block (e.g., "COI - 06:00-08:00")
- Shortage indicator (e.g., "2 below minimum")

### Panel Sections (scrollable)

1. **Active Callout** (if exists)
   - Status badge, step indicator
   - Volunteer list
   - Progress controls (advance/retreat step)
   - Link to full callout detail page

2. **Existing OT Requests** (if any overlap this block)
   - Cards: status, volunteer count, assignment count
   - Link to OT request detail

3. **Available Employees**
   - Sorted by OT queue position (lowest hours = highest priority)
   - Each row: queue position, name, classification (cross-class badge), OT hours, phone link, availability status
   - One-click assign button

4. **Action Buttons** (sticky at panel bottom)
   - Start Callout
   - Create OT Request
   - Send SMS Alert
   - Mandate On-Shift
   - Mandate Day-Off

---

## Duty Board Tab

Visible to all roles. Editable by supervisor+ only.

### Layout
- Columns: 12 two-hour blocks (same axis as staffing grid)
- Rows: one per duty position
- Current time block highlighted
- Cell states:
  - **Assigned**: employee first name, background tinted by position category color from DutyBoardDisplayPage's existing color scheme (Fire=red, Police/Data/Regional=blue, Break=green, Access/CR=tan — determined by position name prefix matching, same logic as the display page)
  - **OT Needed**: "OT" on yellow background
  - **Closed**: "X" on muted background
  - **Empty**: blank

### Supervisor Interactions
- Click cell: assignment dialog (available staff sorted by console hours, assign/clear/mark OT)
- Console Hours button: sheet with monthly hours breakdown
- Add Position button: date-specific position row
- Link to open `/duty-board/display` in new tab

### Employee View
- Same grid, fully visible, read-only
- No click actions, no Add Position
- Console Hours button: visible to all roles (read-only data, no reason to restrict)
- Employee's own name highlighted/bolded

---

## Component Architecture

### New/Refactored Components

```
SchedulePage.tsx              — Route component, URL param handling, view switcher
  ScheduleHeader.tsx          — Date nav, view switcher, print (shared across views)
  DailyView.tsx               — Core composite daily view
    StaffingBlockGrid.tsx     — 2-hour x classification heatmap (supervisor only)
    ShiftList.tsx             — Shift cards with assignment chips
    DutyBoardTab.tsx          — Position x block grid (all roles, edit gated)
    ActionPanel.tsx           — Slide-out gap resolution sheet (supervisor only)
    MyShiftsCard.tsx          — Employee personal shift section
  WeekView.tsx                — 7-day heatmap strip + DailyView for selected day
  MonthView.tsx               — Calendar grid with heatmap cells
```

### Data Flow
- All views share URL-driven date anchor state via `useSearchParams`
- DailyView fetches multiple hooks in parallel:
  - `useDayGrid(date)` — block grid data (classifications, 2-hour blocks, employee Gantt bars)
  - `useDayView(date)` — shift-level entries with assignments (for shift list)
  - `useDutyBoard(date)` — position assignments (for duty board tab, only fetched when tab active; no refetchInterval — that is only for the kiosk display page)
  - `useAnnotations(date, date)` — date annotations
  - `useBlockAvailable(date, classificationId, blockStart, blockEnd)` — fetched on-demand when action panel opens
- Loading state: show skeleton/spinner until both `useDayGrid` and `useDayView` resolve. Duty board tab shows its own loading state independently.
- WeekView additionally uses `useScheduleGrid(weekStart, weekEnd)` for the 7-day heatmap strip coverage data
- MonthView uses `useScheduleGrid(monthStart, monthEnd)` for the calendar grid coverage data
- Role detection via existing `usePermissions()` hook
- View preference: add `preferredScheduleView: 'day' | 'week' | 'month'` field to `useUIStore` (Zustand, localStorage-persisted). Default: `'day'`. Requires bumping store version to 3 and adding a migration case.
- Team filter state: use existing `selectedTeamId` from `useUIStore`
- Saved filters: use existing `useSavedFilters()` hook

### Deleted After Migration
- `DayViewPage.tsx`
- `StaffingResolvePage.tsx`
- `DutyBoardPage.tsx`
- `MySchedulePage.tsx`
- Related route definitions

### Unchanged
- `/duty-board/display` (DutyBoardDisplayPage.tsx)
- All backend API endpoints
- All API modules and hooks

### Implementation Notes
- `DailyView`, `WeekView`, and `MonthView` should be lazy-loaded via `React.lazy()` (consistent with existing page-level lazy loading pattern)
- Keyboard accessibility: the staffing block grid cells should support `tabIndex`, `role="button"`, `aria-label`, and Enter/Space handlers (matching existing DutyBoardPage pattern)
- Print styles: the block grid and Gantt bars need print-specific CSS. Defer detailed print styling as a follow-up task after core functionality works.
- The existing "Available OT" link from DayViewPage is not needed in the unified view — the action panel already provides direct access to OT request creation and available employee lists

---

## Migration & Rollout Strategy

**Build new, then swap.** No incremental modification of existing pages.

### Phases

1. **Build DailyView** — block grid + shift list + action panel + duty board tab + employee variant. Verify feature parity against StaffingResolvePage and DayViewPage.

2. **Build WeekView and MonthView** — thin wrappers around DailyView. Week = heatmap strip + DailyView. Month = heatmap calendar grid.

3. **Build SchedulePage shell** — header, view switcher, URL param handling, role detection.

4. **Swap routes** — point `/schedule` to new page, remove old routes, update sidebar nav.

5. **Delete old pages** — remove replaced page files and route definitions.

### Risk Mitigation
- Old pages stay functional until route swap — production never breaks
- Can test at temporary route (e.g., `/schedule-v2`) before swapping
- Duty board display page untouched throughout

---

## Industry Context

This design aligns with the direction of leading scheduling tools (Vector Scheduling, UKG TeleStaff Cloud, Pace Scheduler). Key differentiators over competitors:

- **Real-time staffing heatmap with integrated gap resolution** — most competitors separate the "view" from the "act" workflow
- **Role-aware single entry point** — reduces navigation complexity vs. TeleStaff's module-heavy approach
- **2-hour block granularity with color-intensity scaling** — more actionable than simple shift-level coverage badges
- **Duty board integrated as a tab** — competitors treat this as an entirely separate product
