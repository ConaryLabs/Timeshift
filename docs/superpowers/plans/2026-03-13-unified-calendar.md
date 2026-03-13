# Unified Calendar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate SchedulePage, DayViewPage, StaffingResolvePage, DutyBoardPage, and MySchedulePage into a single role-aware `/schedule` route with day/week/month views.

**Architecture:** A single `SchedulePage` component reads `view` and `date` from URL search params and renders `DailyView`, `WeekView`, or `MonthView`. Each view reuses existing hooks (`useDayView`, `useDayGrid`, `useDutyBoard`, `useScheduleGrid`, `useStaffing`, `useMySchedule`) without backend changes. Role detection via `usePermissions()` shows/hides supervisor-only controls (action panel, edit actions, annotations). The old pages are kept functional until the final route swap.

**Tech Stack:** React 19, TypeScript, Vite, React Router 7, React Query, Zustand, shadcn/ui (Sheet, Tabs, Dialog), Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-13-unified-calendar-design.md`

---

## File Structure

### New files to create

```
frontend/src/pages/schedule/
├── UnifiedSchedulePage.tsx      — Route component: URL param handling, view switcher, lazy-loads views
├── ScheduleHeader.tsx           — Shared header: date nav, view switcher, team filter, print, annotations
├── DailyView.tsx                — Core composite: block grid + shift list + tabs (schedule/duty board)
├── WeekView.tsx                 — 7-day heatmap strip + DailyView for selected day
├── MonthView.tsx                — Calendar grid with heatmap cells
├── StaffingBlockGrid.tsx        — 2-hour × classification heatmap grid (all roles, read-only for employees)
├── ShiftList.tsx                — Shift cards with assignment chips and coverage badges
├── DutyBoardTab.tsx             — Position × block grid (all roles, edit gated to supervisor+)
├── ActionPanel.tsx              — Slide-out Sheet for gap resolution (supervisor only)
├── MyShiftsCard.tsx             — Employee personal shift cards with quick actions
├── AssignmentChip.tsx           — Shared colored chip for assignment display
└── types.ts                     — Shared types and constants for unified calendar
```

### Files to modify

```
frontend/src/store/ui.ts         — Add preferredScheduleView field + bump version to 3
frontend/src/App.tsx             — Add new route, keep old routes until final swap
frontend/src/components/layout/AppShell.tsx — Update sidebar nav items
frontend/src/lib/dutyBoard.ts    — Extract getPositionColor() from DutyBoardDisplayPage (Task 7)
frontend/src/pages/DutyBoardDisplayPage.tsx — Import getPositionColor from lib instead of local definition
```

### Files to delete (final task only)

```
frontend/src/pages/SchedulePage.tsx
frontend/src/pages/DayViewPage.tsx
frontend/src/pages/StaffingResolvePage.tsx
frontend/src/pages/DutyBoardPage.tsx
frontend/src/pages/MySchedulePage.tsx
```

### Files reused as-is (no modifications)

```
frontend/src/hooks/useSchedule.ts       — useStaffing, useScheduleGrid, useDayView, useAnnotations, useCreateAnnotation
frontend/src/hooks/useStaffing.ts       — useBlockAvailable, useMandatoryOtOrder
frontend/src/hooks/useCoverage.ts       — useDayGrid, useCoverageGaps
frontend/src/hooks/useDutyBoard.ts      — useDutyBoard, useCellAction, useAvailableStaff, useConsoleHours
frontend/src/hooks/useEmployee.ts       — useMySchedule, useMyPreferences
frontend/src/hooks/usePermissions.ts    — isManager, isAdmin, role checks
frontend/src/hooks/useCallout.ts       — useCalloutList, useCalloutVolunteers, useCreateCalloutEvent, useRecordAttempt, useAdvanceCalloutStep
frontend/src/hooks/useOt.ts            — useCreateOtRequest
frontend/src/components/SavedFilterBar.tsx
frontend/src/components/coverage/MandatoryOTDialog.tsx
frontend/src/components/coverage/DayOffMandatoryDialog.tsx
frontend/src/components/coverage/SmsAlertDialog.tsx
frontend/src/components/callout/StepIndicator.tsx
frontend/src/lib/dutyBoard.ts           — BLOCK_LABELS, getCurrentBlockIndex, buildAssignmentMap
frontend/src/lib/format.ts              — formatTime, formatDate, contrastText, DAY_LABELS, toLocalDateStr
frontend/src/api/schedule.ts            — AssignmentView, GridCell, DayViewEntry types
frontend/src/api/employee.ts            — MyScheduleEntry type
frontend/src/api/dutyBoard.ts           — BoardAssignment, AvailableEmployee types
frontend/src/api/staffing.ts            — BlockAvailable type
frontend/src/api/coveragePlans.ts       — ClassificationGap type
```

---

## Chunk 1: Foundation (Tasks 1-3)

### Task 1: Add `preferredScheduleView` to Zustand UI Store

**Files:**
- Modify: `frontend/src/store/ui.ts`

- [ ] **Step 1: Read the current store file**

Read `frontend/src/store/ui.ts` to confirm the current shape (version 2).

- [ ] **Step 2: Add the new field and bump version**

Add `preferredScheduleView` to the interface and store, bump persist version to 3 with migration:

```typescript
// Add to UIState interface:
preferredScheduleView: 'day' | 'week' | 'month'
setPreferredScheduleView: (view: 'day' | 'week' | 'month') => void

// Add to store defaults:
preferredScheduleView: 'day',
setPreferredScheduleView: (view) => set({ preferredScheduleView: view }),

// Update persist config:
version: 3,
migrate: (persistedState, version) => {
  const state = persistedState as UIState
  if (version < 2) {
    return { ...state, collapsedSections: {}, preferredScheduleView: 'day' as const }
  }
  if (version < 3) {
    return { ...state, preferredScheduleView: 'day' as const }
  }
  return state
},
```

- [ ] **Step 3: Verify the frontend builds**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store/ui.ts
git commit -m "feat: add preferredScheduleView to UI store (v3 migration)"
```

---

### Task 2: Create shared types and constants

**Files:**
- Create: `frontend/src/pages/schedule/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// frontend/src/pages/schedule/types.ts

export type CalendarView = 'day' | 'week' | 'month'

export const BLOCK_COUNT = 12
export const BLOCK_HOURS = 2

/** 2-hour block labels for display: "00:00", "02:00", ..., "22:00" */
export const BLOCK_TIME_LABELS = Array.from({ length: BLOCK_COUNT }, (_, i) => {
  const h = i * BLOCK_HOURS
  return `${String(h).padStart(2, '0')}:00`
})

/** Format a block index as a time range: "06:00–08:00" */
export function blockRangeLabel(blockIndex: number): string {
  const start = blockIndex * BLOCK_HOURS
  const end = start + BLOCK_HOURS
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
  return `${fmt(start)}–${fmt(end)}`
}

/** Coverage status color classes for Tailwind */
export const STATUS_COLORS = {
  red: {
    bg: 'bg-red-100',
    bgDark: 'bg-red-200',
    text: 'text-red-800',
    border: 'border-red-300',
    ring: 'ring-red-400',
  },
  yellow: {
    bg: 'bg-yellow-100',
    bgDark: 'bg-yellow-200',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    ring: 'ring-yellow-400',
  },
  green: {
    bg: 'bg-green-100',
    bgDark: 'bg-green-200',
    text: 'text-green-800',
    border: 'border-green-300',
    ring: 'ring-green-400',
  },
} as const

export type CoverageStatus = keyof typeof STATUS_COLORS

/** Get intensity class for gap severity (darker red for larger gaps) */
export function gapIntensityClass(shortage: number): string {
  if (shortage <= 0) return STATUS_COLORS.green.bg
  if (shortage === 1) return 'bg-red-100'
  if (shortage === 2) return 'bg-red-200'
  return 'bg-red-300' // 3+
}

/** Selected block state for action panel.
 *  Field names match existing StaffingResolvePage convention. */
export interface SelectedBlock {
  classificationId: string
  classificationAbbr: string   // matches existing code (not "Abbreviation")
  blockIndex: number
  blockStart: string  // "06:00"
  blockEnd: string    // "08:00"
  min: number         // minimum required staffing
  actual: number      // current staffing level
  // Derived: shortage = Math.max(0, min - actual)
}

/**
 * Key API types used by the block grid (from @/api/coveragePlans):
 *
 * DayGridResponse { date, classifications: DayGridClassification[], blocks: CoverageBlock[] }
 * DayGridClassification { classification_id, abbreviation, blocks: ClassificationBlock[] }
 * ClassificationBlock { block_index, start_time, end_time, min, target, actual, status: 'green'|'yellow'|'red', employees: BlockEmployee[] }
 * CoverageBlock { block_index, total_target, total_actual, status: 'green'|'yellow'|'red' }
 * BlockEmployee { user_id, first_name, last_name, classification_abbreviation, shift_name, shift_start, shift_end, is_overtime, assignment_id }
 *
 * GridCell (from @/api/schedule) does NOT have coverage_status.
 * Derive status: actual < required → 'red', actual === required → 'yellow', actual > required → 'green'.
 * When coverage_by_classification is undefined, show overall shortage only.
 */
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/schedule/types.ts
git commit -m "feat: add shared types and constants for unified calendar"
```

---

### Task 3: Create AssignmentChip component

**Files:**
- Create: `frontend/src/pages/schedule/AssignmentChip.tsx`
- Reference: `frontend/src/pages/SchedulePage.tsx` (lines ~300-400 for existing chip rendering)

- [ ] **Step 1: Read the existing chip implementation**

Read the `AssignmentChip` / chip rendering section in `frontend/src/pages/SchedulePage.tsx` to understand the current props and styling.

- [ ] **Step 2: Create the extracted component**

Extract the chip into a reusable component. The chip displays: name, classification badge, OT badge, trade indicator, notes tooltip, shift color.

```typescript
// frontend/src/pages/schedule/AssignmentChip.tsx
import { cn } from '@/lib/utils'
import { contrastText } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { StickyNote } from 'lucide-react'

interface AssignmentChipProps {
  firstName: string
  lastName: string
  shiftColor: string
  classificationAbbreviation?: string | null
  isOvertime?: boolean
  isTrade?: boolean
  crossesMidnight?: boolean
  notes?: string | null
  position?: string | null
  teamName?: string | null
  compact?: boolean
  highlighted?: boolean
  className?: string
}

export function AssignmentChip({
  firstName,
  lastName,
  shiftColor,
  classificationAbbreviation,
  isOvertime,
  isTrade,
  crossesMidnight,
  notes,
  position,
  teamName,
  compact,
  highlighted,
  className,
}: AssignmentChipProps) {
  const textColor = contrastText(shiftColor)
  const label = compact ? `${lastName}` : `${lastName}, ${firstName.charAt(0)}`

  const chip = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        highlighted && 'ring-2 ring-primary',
        className,
      )}
      style={{ backgroundColor: shiftColor, color: textColor }}
    >
      {label}
      {classificationAbbreviation && (
        <span className="opacity-75 text-[10px]">{classificationAbbreviation}</span>
      )}
      {isOvertime && (
        <Badge variant="outline" className="h-3.5 px-0.5 text-[9px] border-current">OT</Badge>
      )}
      {isTrade && <span className="text-[10px]">↔</span>}
      {crossesMidnight && <span className="text-[10px]">→</span>}
      {notes && <StickyNote className="h-2.5 w-2.5 opacity-60" />}
    </span>
  )

  // Wrap in tooltip if there's extra info to show
  const tooltipLines = [
    `${firstName} ${lastName}`,
    classificationAbbreviation && `Classification: ${classificationAbbreviation}`,
    position && `Position: ${position}`,
    teamName && `Team: ${teamName}`,
    isOvertime && 'Overtime',
    isTrade && 'Trade',
    notes && `Notes: ${notes}`,
  ].filter(Boolean)

  if (tooltipLines.length <= 1) return chip

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent className="text-xs">
        {tooltipLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/AssignmentChip.tsx
git commit -m "feat: extract AssignmentChip component for unified calendar"
```

---

## Chunk 2: Daily View Core (Tasks 4-7)

### Task 4: Create MyShiftsCard (employee top section)

**Files:**
- Create: `frontend/src/pages/schedule/MyShiftsCard.tsx`
- Reference: `frontend/src/pages/MySchedulePage.tsx` (for existing personal shift rendering and DayActionMenu)

- [ ] **Step 1: Read the existing MySchedulePage**

Read `frontend/src/pages/MySchedulePage.tsx` to understand how personal shifts are displayed and what actions are available (Request Leave, Request Trade).

- [ ] **Step 2: Create MyShiftsCard**

This shows the employee's own shifts for the selected date, with quick action buttons.

```typescript
// frontend/src/pages/schedule/MyShiftsCard.tsx
import { useMySchedule } from '@/hooks/queries'
import { formatTime, toLocalDateStr } from '@/lib/format'
import { contrastText } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CalendarOff, ArrowLeftRight, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface MyShiftsCardProps {
  date: Date
}

export function MyShiftsCard({ date }: MyShiftsCardProps) {
  const dateStr = toLocalDateStr(date)
  const navigate = useNavigate()
  const { data: entries } = useMySchedule(dateStr, dateStr)

  const dayEntries = entries?.filter((e) => e.date === dateStr) ?? []

  if (dayEntries.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <CalendarOff className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Day Off</p>
            <p className="text-sm text-muted-foreground">No shifts scheduled for this day</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">My Shifts</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/leave')}>
            <ClipboardList className="h-3.5 w-3.5 mr-1" /> Request Leave
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/trades')}>
            <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Request Trade
          </Button>
        </div>
      </div>
      {dayEntries.map((entry, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-3 py-3">
            <div
              className="w-1.5 self-stretch rounded-full"
              style={{ backgroundColor: entry.shift_color }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{entry.shift_name}</p>
              <p className="text-sm text-muted-foreground">
                {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                {entry.crosses_midnight && ' →'}
              </p>
            </div>
            {entry.is_overtime && (
              <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded">OT</span>
            )}
            {entry.team_name && (
              <span className="text-xs text-muted-foreground">{entry.team_name}</span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/MyShiftsCard.tsx
git commit -m "feat: add MyShiftsCard for employee daily view"
```

---

### Task 5: Create StaffingBlockGrid

**Files:**
- Create: `frontend/src/pages/schedule/StaffingBlockGrid.tsx`
- Reference: `frontend/src/pages/StaffingResolvePage.tsx` (lines ~150-250 for block grid, ~830-890 for ClassificationRow)

- [ ] **Step 1: Read the existing StaffingResolvePage block grid**

Read `frontend/src/pages/StaffingResolvePage.tsx` to understand:
- The `useDayGrid()` hook return shape
- How classification rows with Gantt bars are rendered
- How Min/Actual rows display coverage
- The block click handler that opens the action panel

- [ ] **Step 2: Create StaffingBlockGrid**

This is the 2-hour × classification heatmap. Read-only for employees, clickable (red cells) for supervisors.

The component should:
- Render a summary row aggregating all classifications
- Render one row per classification showing `actual/required` per 2-hour block
- Color cells by coverage status with intensity scaling for gap severity
- Highlight the current time block
- Support expanding a classification row to show employee Gantt bars
- Call `onBlockClick(block: SelectedBlock)` when a supervisor clicks a red cell
- Accept `readonly` prop (true for employees) to disable click interactions

Reference the existing `StaffingResolvePage.tsx` for the exact data shape from `useDayGrid()` and replicate the Gantt bar rendering within expandable classification rows.

Key patterns to preserve from existing code:
- Gantt bar coloring: indigo for regular shifts, amber for OT
- Time range tooltip on hover for each Gantt bar
- Cell fraction display: show `actual/min` (using `ClassificationBlock.actual` and `ClassificationBlock.min`)
- Cell color: use `ClassificationBlock.status` field directly ('red'/'yellow'/'green') — this is computed server-side
- Use `gapIntensityClass(min - actual)` for red cells to vary intensity by severity
- Red cell = `block.status === 'red'` → clickable (matching existing behavior)
- Green/yellow cells = not clickable
- Use `getCurrentBlockIndex()` from `@/lib/dutyBoard` for current block highlighting
- Summary row uses `CoverageBlock` data: `total_actual/total_target` with `CoverageBlock.status`

Data shape (from `useDayGrid(date)` → `DayGridResponse`):
- `response.classifications[]` — array of `DayGridClassification`, each with `classification_id`, `abbreviation`, `blocks: ClassificationBlock[]`
- `response.blocks[]` — array of `CoverageBlock` for the summary row
- Each `ClassificationBlock` has: `block_index`, `start_time`, `end_time`, `min`, `target`, `actual`, `status`, `employees: BlockEmployee[]`
- Each `BlockEmployee` has: `user_id`, `first_name`, `last_name`, `classification_abbreviation`, `shift_name`, `shift_start`, `shift_end`, `is_overtime`, `assignment_id`

Props interface:
```typescript
interface StaffingBlockGridProps {
  date: string                             // "YYYY-MM-DD"
  readonly?: boolean                       // true for employees
  onBlockClick?: (block: SelectedBlock) => void  // supervisor only
}
```

The component calls `useDayGrid(date)` internally. Import types from `@/api/coveragePlans`.

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/StaffingBlockGrid.tsx
git commit -m "feat: add StaffingBlockGrid for unified daily view"
```

---

### Task 6: Create ShiftList

**Files:**
- Create: `frontend/src/pages/schedule/ShiftList.tsx`
- Reference: `frontend/src/pages/DayViewPage.tsx` (for shift card layout, coverage indicators, Gantt bars)

- [ ] **Step 1: Read the existing DayViewPage**

Read `frontend/src/pages/DayViewPage.tsx` to understand:
- How `useDayView()` data is rendered as shift cards
- The `CoverageIndicator` component and shortage breakdown display
- Assignment badge rendering within each shift card

- [ ] **Step 2: Create ShiftList**

Renders one card per shift for the day with assignment chips and coverage badges.

Props interface:
```typescript
interface ShiftListProps {
  date: string                    // "YYYY-MM-DD"
  showCoverage?: boolean          // true for supervisors, false for employees (per spec update: now true for all)
  teamId?: string | null          // optional team filter
}
```

The component calls `useDayView(date)` internally.

Each shift card shows:
- Colored header strip with shift name and times
- Coverage badge: `actual/required` with color (matching `coverage_status` from DayViewEntry)
- If shortage and supervisor: breakdown by classification (e.g., "COI −1")
- Assignment chips using the `AssignmentChip` component from Task 3
- All roles see coverage numbers (per spec: employees can view staffing levels read-only)

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/ShiftList.tsx
git commit -m "feat: add ShiftList for unified daily view"
```

---

### Task 7: Create DutyBoardTab

**Files:**
- Create: `frontend/src/pages/schedule/DutyBoardTab.tsx`
- Reference: `frontend/src/pages/DutyBoardPage.tsx` (full file — position grid, cell rendering, assignment dialog, console hours sheet)
- Reference: `frontend/src/pages/DutyBoardDisplayPage.tsx` (lines 8-22 for `getPositionColor()`)

- [ ] **Step 1: Read existing DutyBoardPage and DutyBoardDisplayPage**

Read both files to understand:
- Position grid rendering with 12 time block columns
- Cell state rendering (assigned, OT needed, closed, empty)
- Assignment dialog (available staff sorted by console hours)
- Console Hours sheet
- Position category color function from DutyBoardDisplayPage

- [ ] **Step 2: Create DutyBoardTab**

This is the position × block grid shown as a tab within the daily view. Visible to all roles. Edit actions gated to supervisor+.

Props interface:
```typescript
interface DutyBoardTabProps {
  date: string                    // "YYYY-MM-DD"
}
```

The component:
- Calls `useDutyBoard(date)` internally (no refetchInterval — that's only for kiosk display)
- Renders positions as rows, 12 two-hour blocks as columns
- Uses position category colors: extract `getPositionColor()` from `DutyBoardDisplayPage.tsx` into `@/lib/dutyBoard.ts` (it determines color by position name prefix: Fire=red, Police/Data/Regional=blue, Break=green, Access/CR=tan). Import from `@/lib/dutyBoard` in both DutyBoardTab and DutyBoardDisplayPage to avoid duplication.
- Highlights current time block via `getCurrentBlockIndex()`
- Cell states: Assigned (first name, category color bg), OT Needed ("OT" on yellow), Closed ("X" on muted), Empty (blank)
- Supervisor interactions: cell click opens assignment dialog (reuse `useCellAction`, `useAvailableStaff`, `useConsoleHours` hooks), Console Hours button, Add Position button
- Employee view: same grid, read-only, no cell click, Console Hours button visible (read-only data), employee's own name bolded
- Keyboard accessible: `tabIndex={0}`, `role="button"`, `aria-label`, Enter/Space handlers on interactive cells

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/DutyBoardTab.tsx
git commit -m "feat: add DutyBoardTab for unified daily view"
```

---

## Chunk 3: Action Panel + Daily View Assembly (Tasks 8-10)

### Task 8: Create ActionPanel

**Files:**
- Create: `frontend/src/pages/schedule/ActionPanel.tsx`
- Reference: `frontend/src/pages/StaffingResolvePage.tsx` (lines ~400-800 for the right-side panel content)

- [ ] **Step 1: Read the existing action panel in StaffingResolvePage**

Read `frontend/src/pages/StaffingResolvePage.tsx` focusing on the Sheet (right panel) content:
- Block header with classification + time range + shortage
- Active callout card (status, step indicator, volunteer list, progress controls)
- Existing OT requests list
- Available employees table (sorted by OT queue position)
- Action buttons (Start Callout, Create OT Request, Send SMS, Mandate On-Shift, Mandate Day-Off)
- All the dialog components used (MandatoryOTDialog, DayOffMandatoryDialog, SmsAlertDialog)
- Mutations: `useCreateCalloutEvent`, `useRecordAttempt`, `useAdvanceCalloutStep`, `useCreateOtRequest`

- [ ] **Step 2: Create ActionPanel**

Supervisor-only slide-out Sheet for resolving staffing gaps. Triggered when a red cell is clicked in the block grid.

Props interface:
```typescript
interface ActionPanelProps {
  date: string
  block: SelectedBlock | null     // null = closed
  onClose: () => void
}
```

The component:
- Renders inside a shadcn `Sheet` (side="right"), open when `block` is non-null
- Header: classification abbreviation + time range + shortage count
- Sections (scrollable):
  1. Active Callout (if exists) — status badge, step indicator, volunteer list, advance/retreat controls, link to `/callout`
  2. Existing OT Requests — cards with status, volunteer count, link to `/ot-requests/:id`
  3. Available Employees — table sorted by OT queue position, with one-click assign
- Sticky footer: Start Callout, Create OT Request, Send SMS Alert, Mandate On-Shift, Mandate Day-Off buttons
- Reuses existing hooks: `useBlockAvailable(date, classificationId, blockStart, blockEnd)`, `useCalloutList`, `useCalloutVolunteers`, `useCoverageGaps`
- Reuses existing dialogs: `MandatoryOTDialog`, `DayOffMandatoryDialog`, `SmsAlertDialog`
- Reuses existing mutations: `useCreateCalloutEvent`, `useRecordAttempt`, `useAdvanceCalloutStep`, `useCreateOtRequest`
- Reuses `StepIndicator` component from `@/components/callout/StepIndicator`

Port the logic from `StaffingResolvePage.tsx`'s right panel section. The key data flow:
- `useBlockAvailable` is called with the selected block's date, classificationId, blockStart, blockEnd
- `useCalloutList` and `useCalloutVolunteers` are called when there's an active callout for this block
- Available employees are sorted by `queue_position` (OT queue order)

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/ActionPanel.tsx
git commit -m "feat: add ActionPanel for gap resolution in unified daily view"
```

---

### Task 9: Create ScheduleHeader

**Files:**
- Create: `frontend/src/pages/schedule/ScheduleHeader.tsx`
- Reference: `frontend/src/pages/SchedulePage.tsx` (lines ~170-230 for header, team filter, view tabs)
- Reference: `frontend/src/pages/DayViewPage.tsx` (lines ~60-90 for day header, annotation button)

- [ ] **Step 1: Read existing headers**

Read the header sections of `SchedulePage.tsx` and `DayViewPage.tsx` to understand:
- Date navigation (prev/today/next)
- View mode tabs
- Team filter dropdown
- Print button
- Annotation button and dialog

- [ ] **Step 2: Create ScheduleHeader**

Shared header used by all views.

Props interface:
```typescript
interface ScheduleHeaderProps {
  date: Date
  view: CalendarView
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarView) => void
}
```

The component renders:
- **Left side**: Date display (format depends on view: full date for day, week range for week, month/year for month)
- **Center**: Prev / Today / Next buttons (step size depends on view: ±1 day, ±1 week, ±1 month)
- **Right side**: View switcher (Day | Week | Month segmented control), Team filter dropdown, Print button
- **Below (supervisor only)**: Add Annotation button (opens dialog using `useCreateAnnotation`)
- **Below**: Annotation badges for the current date (using `useAnnotations`)
- **Below**: `SavedFilterBar` component (reused from existing)

Team filter uses `useTeams()` hook and `selectedTeamId` from `useUIStore`.

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/ScheduleHeader.tsx
git commit -m "feat: add ScheduleHeader with date nav, view switcher, filters"
```

---

### Task 10: Assemble DailyView

**Files:**
- Create: `frontend/src/pages/schedule/DailyView.tsx`

- [ ] **Step 1: Create DailyView**

Composite component that assembles the daily view from sub-components.

Props interface:
```typescript
interface DailyViewProps {
  date: Date
  teamId?: string | null
}
```

The component:
- Uses `usePermissions()` to detect role
- Manages `selectedBlock` state for the action panel
- **Supervisor layout**:
  - `StaffingBlockGrid` (top half) — with `onBlockClick` handler
  - `Tabs` component with two tabs:
    - "Schedule" tab: `ShiftList`
    - "Duty Board" tab: `DutyBoardTab`
  - `ActionPanel` (slide-out, controlled by `selectedBlock` state)
- **Employee layout**:
  - `MyShiftsCard` (top section — personal shifts)
  - Collapsible "Team Schedule" section (default collapsed, uses `collapsedSections` from `useUIStore`):
    - `StaffingBlockGrid` with `readonly` prop (collapsible within team schedule)
    - `Tabs` with Schedule and Duty Board tabs (same as supervisor, but DutyBoardTab is read-only automatically via permissions)
  - No `ActionPanel`

Loading state: show `LoadingState` spinner until `useDayGrid` and `useDayView` both resolve (check via `isLoading` from both hooks).

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/schedule/DailyView.tsx
git commit -m "feat: assemble DailyView composite component"
```

---

## Chunk 4: Week and Month Views (Tasks 11-12)

### Task 11: Create WeekView

**Files:**
- Create: `frontend/src/pages/schedule/WeekView.tsx`

- [ ] **Step 1: Create WeekView**

Props interface:
```typescript
interface WeekViewProps {
  date: Date              // any date within the week (will normalize to week start)
  onDateChange: (date: Date) => void
  teamId?: string | null
}
```

The component:
- Computes week start (Sunday) and end (Saturday) from the `date` prop
- Converts dates to strings with `toLocalDateStr()` from `@/lib/format` before passing to hooks
- Calls `useScheduleGrid(toLocalDateStr(weekStart), toLocalDateStr(weekEnd), teamId)` to get `GridCell[]` coverage data
- Manages `selectedDay` state (defaults to `date` prop, or today if today is within the week)
- **Top: 7-day heatmap strip**
  - Horizontal row of 7 day cells
  - Each cell: day abbreviation (from `DAY_LABELS`), date number
  - **Supervisor**: background colored by worst coverage status across all shifts for that day. `GridCell` has no `coverage_status` field — derive it: `actual < required → 'red'`, `actual === required → 'yellow'`, `actual > required → 'green'`. If ANY cell for a day is red → day is red, else if any yellow → yellow, else green.
  - Gap count badge in corner showing total shortage: `Math.max(0, coverage_required - coverage_actual)` summed across all `GridCell`s for that date. If `coverage_by_classification` is available, use its `shortage` values; otherwise compute from the top-level fields.
  - **Employee**: coverage heatmap coloring visible (read-only), plus personal shift indicator (colored dot matching shift color if working, hollow circle if off — use `useMySchedule` for personal data)
  - Selected day: `ring-2 ring-primary` border
  - Click handler: set `selectedDay` and call `onDateChange` to update URL
  - Today: subtle highlight (e.g., font-bold on date number)
- **Bottom: DailyView** for the selected day (renders the full `DailyView` component from Task 10)

**Important:** Export as a named export (`export function WeekView`) — Task 13's lazy import expects `.then((m) => ({ default: m.WeekView }))`.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/schedule/WeekView.tsx
git commit -m "feat: add WeekView with heatmap strip and daily drill-down"
```

---

### Task 12: Create MonthView

**Files:**
- Create: `frontend/src/pages/schedule/MonthView.tsx`

- [ ] **Step 1: Create MonthView**

Props interface:
```typescript
interface MonthViewProps {
  date: Date              // any date within the month (will normalize to month start)
  onDateChange: (date: Date) => void
  teamId?: string | null
}
```

The component:
- Computes month start, end, and the 6-week grid range (including padding days from prev/next month)
- Converts dates to strings with `toLocalDateStr()` from `@/lib/format` before passing to hooks
- Calls `useScheduleGrid(toLocalDateStr(gridStart), toLocalDateStr(gridEnd), teamId)` to get `GridCell[]` coverage data
- For employees: also calls `useMySchedule(toLocalDateStr(gridStart), toLocalDateStr(gridEnd))` for personal shift indicators
- **Calendar grid** (6 rows × 7 columns, Sun–Sat):
  - Column headers: day abbreviations from `DAY_LABELS`
  - Each day cell:
    - Date number (bold if today, `text-muted-foreground` if outside current month)
    - Background tint: worst coverage status for that day (light enough for readable text — use `STATUS_COLORS[status].bg` from types.ts)
    - Gap count badge if gaps exist (red pill showing e.g., "−3")
    - Today: `ring-2 ring-primary/50` border
    - **Employee additions**: colored dot/bar matching shift color if working, muted if day off, small icon if leave request pending/approved
    - **Supervisor hover**: tooltip showing gap breakdown by classification. `GridCell.coverage_by_classification` is `ClassificationCoverageDetail[] | undefined`. When defined, show per-classification shortages (e.g., "COI: −2, COII: −1, SUP: OK"). When `undefined`, show overall shortage only (e.g., "Short by 3").
    - **Cell coverage status derivation** (same as WeekView): `actual < required → 'red'`, `actual === required → 'yellow'`, `actual > required → 'green'`. Worst status across all GridCells for a date determines the cell color.
  - Click handler: navigate to `?view=day&date=YYYY-MM-DD` via `onDateChange`

**Important:** Export as a named export (`export function MonthView`) — Task 13's lazy import expects `.then((m) => ({ default: m.MonthView }))`.

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/schedule/MonthView.tsx
git commit -m "feat: add MonthView with heatmap calendar grid"
```

---

## Chunk 5: Page Shell, Routing & Cleanup (Tasks 13-16)

### Task 13: Create UnifiedSchedulePage shell

**Files:**
- Create: `frontend/src/pages/schedule/UnifiedSchedulePage.tsx`

- [ ] **Step 1: Create the page component**

```typescript
// frontend/src/pages/schedule/UnifiedSchedulePage.tsx
import { lazy, Suspense, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUIStore } from '@/store/ui'
import { toLocalDateStr } from '@/lib/format'
import { ScheduleHeader } from './ScheduleHeader'
import { LoadingState } from '@/components/ui/loading-state'
import type { CalendarView } from './types'

const DailyView = lazy(() => import('./DailyView').then((m) => ({ default: m.DailyView })))
const WeekView = lazy(() => import('./WeekView').then((m) => ({ default: m.WeekView })))
const MonthView = lazy(() => import('./MonthView').then((m) => ({ default: m.MonthView })))

function parseDate(str: string | null): Date {
  if (str) {
    const d = new Date(str + 'T00:00:00')
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

export default function UnifiedSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const preferredView = useUIStore((s) => s.preferredScheduleView)
  const setPreferredView = useUIStore((s) => s.setPreferredScheduleView)
  const selectedTeamId = useUIStore((s) => s.selectedTeamId)

  const view = (searchParams.get('view') as CalendarView) || preferredView
  const date = parseDate(searchParams.get('date'))

  const setView = useCallback((v: CalendarView) => {
    setPreferredView(v)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', v)
      return next
    }, { replace: true })
  }, [setPreferredView, setSearchParams])

  const setDate = useCallback((d: Date) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('date', toLocalDateStr(d))
      return next
    }, { replace: true })
  }, [setSearchParams])

  return (
    <div className="space-y-4 p-4">
      <ScheduleHeader
        date={date}
        view={view}
        onDateChange={setDate}
        onViewChange={setView}
      />
      <Suspense fallback={<LoadingState />}>
        {view === 'day' && <DailyView date={date} teamId={selectedTeamId} />}
        {view === 'week' && <WeekView date={date} onDateChange={setDate} teamId={selectedTeamId} />}
        {view === 'month' && <MonthView date={date} onDateChange={setDate} teamId={selectedTeamId} />}
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/schedule/UnifiedSchedulePage.tsx
git commit -m "feat: add UnifiedSchedulePage shell with URL-driven state"
```

---

### Task 14: Wire up routes (parallel testing)

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read App.tsx**

Read `frontend/src/App.tsx` to confirm current route structure.

- [ ] **Step 2: Add the new route alongside old routes**

Add the unified schedule page at a temporary route for parallel testing. Keep all old routes intact.

Add lazy import at top:
```typescript
const UnifiedSchedulePage = lazy(() => import('@/pages/schedule/UnifiedSchedulePage'))
```

Add route inside the `RequireAuth` section (after existing `schedule` route):
```typescript
<Route path="schedule-v2" element={<PageSuspense><UnifiedSchedulePage /></PageSuspense>} />
```

- [ ] **Step 3: Verify build and test manually**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

Start the dev server (`make frontend`) and verify:
- Navigate to `/schedule-v2` — should render the unified page
- Navigate to `/schedule-v2?view=day&date=2026-03-13` — daily view
- Navigate to `/schedule-v2?view=week&date=2026-03-09` — week view
- Navigate to `/schedule-v2?view=month&date=2026-03-01` — month view
- Old routes (`/schedule`, `/schedule/day/2026-03-13`, `/staffing/resolve`, `/duty-board`, `/my-schedule`) still work

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add /schedule-v2 route for parallel testing"
```

---

### Task 15: Swap routes and update sidebar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Read AppShell.tsx sidebar nav**

Read `frontend/src/components/layout/AppShell.tsx` lines 80-120 to understand the current nav item structure.

- [ ] **Step 2: Update routes in App.tsx**

Replace old routes with the unified page:

1. Remove old lazy imports: `SchedulePage`, `DayViewPage`, `StaffingResolvePage`, `DutyBoardPage`, `MySchedulePage`
2. Add `useParams` to the react-router-dom import:
   ```typescript
   import { Navigate, Route, Routes, useParams } from 'react-router-dom'
   ```
3. Add `DayViewRedirect` component above the `App` function:
   ```typescript
   function DayViewRedirect() {
     const { date } = useParams()
     return <Navigate to={`/schedule?view=day&date=${date}`} replace />
   }
   ```
4. Replace routes:
   - Remove: `path="my-schedule"` (line 78), `path="schedule"` (line 80), `path="schedule/day/:date"` (line 81), `path="staffing/resolve"` (lines 107-114), `path="duty-board"` (line 90) routes
   - **WARNING**: Do NOT remove `path="duty-board/display"` at line 283 — it is OUTSIDE the auth wrapper and must stay
   - Add: `path="schedule"` pointing to `UnifiedSchedulePage` (no role guard — all roles access it)
   - Remove: `path="schedule-v2"` temporary route
   - Add redirects for old URLs:
     ```typescript
     <Route path="my-schedule" element={<Navigate to="/schedule" replace />} />
     <Route path="schedule/day/:date" element={<DayViewRedirect />} />
     <Route path="staffing/resolve" element={<Navigate to="/schedule" replace />} />
     <Route path="duty-board" element={<Navigate to="/schedule" replace />} />
     ```

- [ ] **Step 3: Update sidebar nav in AppShell.tsx**

In the `useNavItems()` function:

1. Remove `{ to: '/my-schedule', label: 'My Schedule', ... }` from the personal group (line 105)
2. Remove `{ to: '/duty-board', label: 'Duty Board', ... }` from the Schedule group (line 112) — it's now a tab within the daily view
3. The Schedule group should be:
   ```typescript
   {
     label: 'Schedule',
     items: [
       { to: '/schedule', label: 'Schedule', icon: <Calendar className="h-4 w-4" /> },
     ],
   },
   ```
4. In the Operations group (managers only), update Daily Staffing link (line 91):
   - Change `{ to: '/staffing/resolve', ... }` to `{ to: '/schedule?view=day', label: 'Daily Staffing', ... }`
5. Add "Duty Board Display" link to Operations group (managers only) — opens kiosk view in new tab:
   ```typescript
   { to: '/duty-board/display', label: 'Duty Board Display', icon: <Monitor className="h-4 w-4" /> },
   ```
   Import `Monitor` from `lucide-react`. Make the nav item open in a new tab (add `target: '_blank'` handling in the sidebar renderer if not already supported).

6. Update coverage gap popover navigation links in AppShell (lines ~546-599):
   - Line 547: `navigate(\`/staffing/resolve?date=${today}&classification=${cls.classification_abbreviation}\`)` → `navigate(\`/schedule?view=day&date=${today}\`)`
   - Line 574: `navigate(\`/schedule/day/${today}\`)` → `navigate(\`/schedule?view=day&date=${today}\`)`
   - Line 586: `navigate(\`/schedule/day/${today}\`)` → `navigate(\`/schedule?view=day&date=${today}\`)`
   - Line 596: `navigate(\`/staffing/resolve?date=${today}${classParam}\`)` → `navigate(\`/schedule?view=day&date=${today}\`)`

   **Note:** The old `classification` query param is lost in this migration. The unified page does not support a classification URL param to auto-open a specific block. This is an acceptable regression — the supervisor sees all classifications in the block grid and can click the relevant one.

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: No lint errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/AppShell.tsx
git commit -m "feat: swap routes to unified calendar, update sidebar nav"
```

---

### Task 16: Delete old pages

**Files:**
- Delete: `frontend/src/pages/SchedulePage.tsx`
- Delete: `frontend/src/pages/DayViewPage.tsx`
- Delete: `frontend/src/pages/StaffingResolvePage.tsx`
- Delete: `frontend/src/pages/DutyBoardPage.tsx`
- Delete: `frontend/src/pages/MySchedulePage.tsx`

- [ ] **Step 1: Verify no remaining imports of old pages**

Search for any imports of the deleted pages in the codebase:

```bash
cd frontend && grep -r "pages/SchedulePage\|pages/DayViewPage\|pages/StaffingResolvePage\|pages/DutyBoardPage\|pages/MySchedulePage" src/
```

Expected: No results (all imports should have been removed in Task 15). If any remain, fix them first.

- [ ] **Step 2: Delete the files**

```bash
git rm frontend/src/pages/SchedulePage.tsx frontend/src/pages/DayViewPage.tsx frontend/src/pages/StaffingResolvePage.tsx frontend/src/pages/DutyBoardPage.tsx frontend/src/pages/MySchedulePage.tsx
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Run lint**

Run: `cd frontend && npm run lint`
Expected: No lint errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: delete old pages replaced by unified calendar"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|------------------|
| 1: Foundation | 1-3 | Zustand store update, shared types, AssignmentChip |
| 2: Daily View Core | 4-7 | MyShiftsCard, StaffingBlockGrid, ShiftList, DutyBoardTab |
| 3: Action Panel + Assembly | 8-10 | ActionPanel, ScheduleHeader, DailyView composite |
| 4: Week & Month | 11-12 | WeekView, MonthView |
| 5: Routing & Cleanup | 13-16 | Page shell, route wiring, route swap, old page deletion |

**Total: 16 tasks, 5 chunks, 0 backend changes.**
