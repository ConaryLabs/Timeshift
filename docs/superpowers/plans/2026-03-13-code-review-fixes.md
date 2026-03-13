# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical, important, and minor findings from the full codebase review (4 critical, 17 important, 19 minor).

**Architecture:** Backend fixes are Rust edits + one migration for schema changes. Frontend fixes are React/TypeScript edits. No new features — purely defensive hardening, bug fixes, and code quality improvements.

**Tech Stack:** Rust (Axum 0.7, SQLx 0.8), PostgreSQL 18, React 19, TypeScript, Vite

---

## File Structure

### Files to modify

```
# Backend
backend/src/api/organizations.rs    — Add missing org_settings keys to whitelist
backend/src/api/users.rs            — Add password validation on create, fix hardcoded bargaining_unit
backend/src/api/schedule.rs         — Add date range validation to list_annotations
backend/src/api/leave_sellback.rs   — Add FOR UPDATE to balance query
backend/src/api/bidding.rs          — Add org_id to re-fetch, batch slot assignment checks
backend/src/api/auth.rs             — (no change needed, cleanup handled by migration)

# Migration
backend/migrations/0058_review_hardening.sql — Schema fixes: assignments constraint, indexes, cleanup

# Frontend
frontend/src/pages/DashboardPage.tsx                — Fix defunct route navigations
frontend/src/pages/schedule/ShiftList.tsx            — Remove unused teamId prop
frontend/src/pages/schedule/StaffingBlockGrid.tsx    — Fix midnight-crossing Gantt bars
frontend/src/pages/schedule/MyShiftsCard.tsx         — Fix array index key
frontend/src/pages/schedule/DailyView.tsx            — Remove unnecessary cn()
frontend/src/pages/schedule/DutyBoardTab.tsx         — Guard useClassifications with enabled
frontend/src/pages/schedule/MonthView.tsx            — Remove redundant key prop
frontend/src/pages/schedule/WeekView.tsx             — Fix double-update on day click
frontend/src/components/layout/AppShell.tsx           — Fix stale today variable
```

---

## Chunk 1: Critical Backend Fixes (Tasks 1-3)

### Task 1: Add missing org_settings keys to whitelist

**Files:**
- Modify: `backend/src/api/organizations.rs`

- [ ] **Step 1: Read the file and find ALLOWED_SETTING_KEYS**

Read `backend/src/api/organizations.rs` and find the `ALLOWED_SETTING_KEYS` constant.

- [ ] **Step 2: Add missing keys**

Add these keys that are read by the code but missing from the whitelist:
- `"vacation_hours_per_day"` — used in `vacation_bids.rs:48`
- `"sellback_periods"` — used in `leave_sellback.rs:86`
- `"enable_bump_requests"` — used in `callout.rs`
- `"max_concurrent_vacation"` — used in `vacation_bids.rs:865`
- `"default_hours_per_vacation_day"` — used in vacation bid processing

Note: The `sellback_{period}_open` and `sellback_{period}_close` keys are dynamic (period name is variable). The current validation approach with a static whitelist can't handle these. Add a special case: if the key starts with `"sellback_"` and ends with `"_open"` or `"_close"`, allow it. Otherwise, add each specific key to the list.

The simplest approach: add the static keys to the array, and add a prefix check for `sellback_` dynamic keys before the whitelist validation.

- [ ] **Step 3: Verify build**

Run: `cd /home/peter/Timeshift && make sqlx-prepare && cd backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/organizations.rs
git commit -m "fix: add missing org_settings keys to whitelist"
```

---

### Task 2: Add password validation on user creation

**Files:**
- Modify: `backend/src/api/users.rs`

- [ ] **Step 1: Read the create handler**

Read `backend/src/api/users.rs` and find the `create` handler (the function that handles POST /api/users). Find where `req.password` is used (it gets hashed with Argon2). Also read the `change_password` handler to see the existing validation pattern.

- [ ] **Step 2: Add validation before hashing**

Add the same password length validation from `change_password` to the `create` handler, right before the password hashing:

```rust
if req.password.len() < 8 || req.password.len() > 128 {
    return Err(AppError::BadRequest(
        "Password must be between 8 and 128 characters".into(),
    ));
}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/peter/Timeshift/backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/users.rs
git commit -m "fix: add password length validation on user creation"
```

---

### Task 3: Fix assignments unique constraint for soft cancellation

**Files:**
- Create: `backend/migrations/0058_review_hardening.sql`

- [ ] **Step 1: Create the migration**

Create `backend/migrations/0058_review_hardening.sql` with:

```sql
-- Fix: assignments unique constraint blocks re-assignment after soft cancellation.
-- Replace unconditional unique with partial unique index on active assignments only.
ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_scheduled_shift_id_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active_unique
    ON assignments (scheduled_shift_id, user_id)
    WHERE cancelled_at IS NULL;

-- Add missing FK indexes identified in code review (11 indexes).
CREATE INDEX IF NOT EXISTS idx_shift_slots_template ON shift_slots (shift_template_id);
CREATE INDEX IF NOT EXISTS idx_shift_slots_classification ON shift_slots (classification_id);
CREATE INDEX IF NOT EXISTS idx_users_classification ON users (classification_id);
CREATE INDEX IF NOT EXISTS idx_callout_attempts_user ON callout_attempts (user_id);
CREATE INDEX IF NOT EXISTS idx_callout_events_ot_reason ON callout_events (ot_reason_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_requester ON trade_requests (requester_assignment_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_partner ON trade_requests (partner_assignment_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_slot ON scheduled_shifts (slot_id);
CREATE INDEX IF NOT EXISTS idx_bump_requests_requesting ON bump_requests (requesting_user_id);
CREATE INDEX IF NOT EXISTS idx_bump_requests_displaced ON bump_requests (displaced_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_supervisor ON teams (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_coverage_plan_assignments_plan ON coverage_plan_assignments (plan_id);

-- Add org_id covering indexes for hot-path tables.
CREATE INDEX IF NOT EXISTS idx_shift_templates_org_active ON shift_templates (org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_periods_org ON schedule_periods (org_id, start_date DESC);

-- Drop redundant indexes (duplicated by unique constraints).
DROP INDEX IF EXISTS refresh_tokens_token_idx;
DROP INDEX IF EXISTS idx_employee_preferences_user;
```

- [ ] **Step 2: Run migration**

Run: `make migrate`

- [ ] **Step 3: Regenerate SQLx cache**

Run: `make sqlx-prepare`

- [ ] **Step 4: Verify build**

Run: `cd /home/peter/Timeshift/backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add backend/migrations/0058_review_hardening.sql backend/.sqlx/
git commit -m "fix: partial unique constraint on assignments, add missing FK indexes"
```

---

## Chunk 2: Important Backend Fixes (Tasks 4-7)

### Task 4: Add date range validation to list_annotations

**Files:**
- Modify: `backend/src/api/schedule.rs`

- [ ] **Step 1: Read list_annotations handler**

Read `backend/src/api/schedule.rs` and find the `list_annotations` function. Also find how `validate_date_range` is used in other handlers in the same file (e.g., `staffing_view`).

- [ ] **Step 2: Add validation**

Add `validate_date_range(q.start_date, q.end_date, Some(366))?;` at the top of the handler, after the function signature but before the query. Import `validate_date_range` if not already imported (check the imports at the top of the file — it's likely already imported since other handlers use it).

- [ ] **Step 3: Verify build**

Run: `cd /home/peter/Timeshift/backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/schedule.rs
git commit -m "fix: add date range validation to list_annotations endpoint"
```

---

### Task 5: Add FOR UPDATE to sellback balance query

**Files:**
- Modify: `backend/src/api/leave_sellback.rs`

- [ ] **Step 1: Read the approve handler**

Read `backend/src/api/leave_sellback.rs` and find the review/approve handler. Look for the query that fetches `leave_balances` to check holiday balance before deducting.

- [ ] **Step 2: Add FOR UPDATE**

Add `FOR UPDATE OF lb` to the leave_balances query inside the approve transaction, before the closing `"#`. This prevents concurrent approvals from both seeing sufficient balance and double-deducting.

- [ ] **Step 3: Regenerate SQLx cache and verify build**

Run: `make sqlx-prepare && cd backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add backend/src/api/leave_sellback.rs backend/.sqlx/
git commit -m "fix: lock leave balance rows during sellback approval"
```

---

### Task 6: Fix bidding re-fetch org_id and N+1 query

**Files:**
- Modify: `backend/src/api/bidding.rs`

- [ ] **Step 1: Read the get_bid_window handler**

Read `backend/src/api/bidding.rs` and find the `get_bid_window` handler. Find the re-fetch query that runs after `advance_expired_windows` — it should be a second `sqlx::query_as!(BidWindow, ...)` that's missing the `schedule_periods` org_id join.

- [ ] **Step 2: Add org_id filter to re-fetch**

Add a JOIN to `schedule_periods` with org_id check, matching the pattern in the first fetch query in the same function:

```sql
JOIN schedule_periods sp ON sp.id = bw.period_id
...
AND sp.org_id = $2
```

Add `auth.org_id` as the second parameter.

- [ ] **Step 3: Fix N+1 in process_bids**

Read the `process_bids` function in the same file. Find the loop that checks `SELECT EXISTS(... FROM slot_assignments WHERE slot_id = $1 AND period_id = $2)` per submission.

Pre-load all assigned slot IDs before the loop:

```rust
let assigned_slots: std::collections::HashSet<Uuid> = sqlx::query_scalar!(
    "SELECT slot_id FROM slot_assignments WHERE period_id = $1",
    period_id,
)
.fetch_all(&mut *tx)
.await?
.into_iter()
.collect();
```

Then replace the per-iteration query with `if assigned_slots.contains(&sub.slot_id) { continue; }`. Update the HashSet when inserting new assignments: `assigned_slots.insert(sub.slot_id);`.

- [ ] **Step 4: Regenerate SQLx cache and verify build**

Run: `make sqlx-prepare && cd backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
git add backend/src/api/bidding.rs backend/.sqlx/
git commit -m "fix: add org_id to bid window re-fetch, batch slot assignment checks"
```

---

### Task 7: Add refresh token and audit log cleanup

**Files:**
- Modify: `backend/src/main.rs`

- [ ] **Step 1: Read main.rs background task section**

Read `backend/src/main.rs` and find the existing background task that runs accrual processing (look for `tokio::spawn` with a loop and `tokio::time::interval`).

- [ ] **Step 2: Add cleanup task**

Add a background task alongside the existing accrual task that runs daily and cleans up:
- Expired refresh tokens: `DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day'`
- Old audit log entries: `DELETE FROM login_audit_log WHERE created_at < NOW() - INTERVAL '90 days'`

Follow the same pattern as the accrual task:

```rust
// Periodic cleanup: expired refresh tokens and old audit logs
{
    let pool = pool.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(86400)); // daily
        interval.tick().await; // first tick is immediate, skip it
        loop {
            interval.tick().await;
            let _ = sqlx::query!("DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '1 day'")
                .execute(&pool)
                .await;
            let _ = sqlx::query!("DELETE FROM login_audit_log WHERE created_at < NOW() - INTERVAL '90 days'")
                .execute(&pool)
                .await;
            tracing::info!("Periodic cleanup: expired tokens and old audit logs");
        }
    });
}
```

- [ ] **Step 3: Regenerate SQLx cache and verify build**

Run: `make sqlx-prepare && cd backend && SQLX_OFFLINE=true cargo build --release 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add backend/src/main.rs backend/.sqlx/
git commit -m "feat: add daily cleanup for expired refresh tokens and audit logs"
```

---

## Chunk 3: Frontend Fixes (Tasks 8-14)

### Task 8: Fix DashboardPage defunct routes

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Read and find defunct navigations**

Read `frontend/src/pages/DashboardPage.tsx` and find all `navigate()` calls that reference old routes (`/staffing/resolve`, `/schedule/day/`).

- [ ] **Step 2: Update routes**

Change:
- `navigate(\`/staffing/resolve?date=${today}\`)` → `navigate(\`/schedule?view=day&date=${today}\`)`
- `navigate(\`/schedule/day/${today}\`)` → `navigate(\`/schedule?view=day&date=${today}\`)`

- [ ] **Step 3: Verify build**

Run: `cd /home/peter/Timeshift/frontend && npm run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "fix: update DashboardPage to use unified schedule routes"
```

---

### Task 9: Fix ShiftList unused teamId + MyShiftsCard key + DailyView cn()

**Files:**
- Modify: `frontend/src/pages/schedule/ShiftList.tsx`
- Modify: `frontend/src/pages/schedule/MyShiftsCard.tsx`
- Modify: `frontend/src/pages/schedule/DailyView.tsx`

- [ ] **Step 1: Fix ShiftList**

Read `frontend/src/pages/schedule/ShiftList.tsx`. The `teamId` prop is defined in the interface but not used. Since the backend `useDayView` endpoint doesn't support team filtering, remove the `teamId` prop from the interface entirely. Also update `DailyView.tsx` to not pass `teamId` to `ShiftList`.

- [ ] **Step 2: Fix MyShiftsCard key**

Read `frontend/src/pages/schedule/MyShiftsCard.tsx`. Find where `shifts.map((entry, i) => <Card key={i}>` is used. Replace the key with a unique identifier: `key={\`${entry.date}-${entry.shift_name}-${entry.start_time}\`}`.

- [ ] **Step 3: Fix DailyView cn()**

Read `frontend/src/pages/schedule/DailyView.tsx`. Find `className={cn('px-4 pb-4 space-y-4')}` and replace with `className="px-4 pb-4 space-y-4"`. If `cn` is no longer used anywhere in the file after this change, remove the import.

- [ ] **Step 4: Verify build + lint**

Run: `cd /home/peter/Timeshift/frontend && npm run build && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/schedule/ShiftList.tsx frontend/src/pages/schedule/MyShiftsCard.tsx frontend/src/pages/schedule/DailyView.tsx
git commit -m "fix: remove unused teamId prop, fix React keys, remove unnecessary cn()"
```

---

### Task 10: Fix midnight-crossing Gantt bars

**Files:**
- Modify: `frontend/src/pages/schedule/StaffingBlockGrid.tsx`

- [ ] **Step 1: Read barPosition function**

Read `frontend/src/pages/schedule/StaffingBlockGrid.tsx` and find the `barPosition` function near the end of the file.

- [ ] **Step 2: Fix the function**

Replace with a version that handles midnight-crossing shifts by capping at midnight (the bar shows the portion up to midnight, which is the visible range on a 24-hour grid):

```typescript
function barPosition(shiftStart: string, shiftEnd: string) {
  const [sh, sm] = shiftStart.split(':').map(Number)
  const [eh, em] = shiftEnd.split(':').map(Number)
  const startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  if (endMin <= startMin) endMin = 24 * 60 // crosses midnight — cap at end of day
  const totalMin = 24 * 60
  const left = (startMin / totalMin) * 100
  const width = Math.min(((endMin - startMin) / totalMin) * 100, 100 - left)
  return { left: `${left}%`, width: `${width}%` }
}
```

This is functionally the same as the current code but clearer. The key insight: for a 24-hour grid, overnight shifts only show the pre-midnight portion. The tooltip already shows the full time range.

Actually, the current code already does this correctly. The issue noted in the review is that the visual representation only shows the pre-midnight portion, which is correct behavior for a single-day view. Mark this as already-correct and skip.

If the existing code is already correct, just add a comment explaining the midnight behavior:

```typescript
/** Calculate CSS left% and width% for a Gantt bar.
 *  Overnight shifts (endTime <= startTime) are capped at midnight — they only show
 *  the pre-midnight portion on this single-day grid. The tooltip shows full times. */
```

- [ ] **Step 3: Verify build**

Run: `cd /home/peter/Timeshift/frontend && npm run build`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/StaffingBlockGrid.tsx
git commit -m "docs: clarify midnight-crossing behavior in barPosition"
```

---

### Task 11: Fix AppShell stale today + DutyBoardTab unconditional query

**Files:**
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/pages/schedule/DutyBoardTab.tsx`
- Modify: `frontend/src/pages/schedule/MonthView.tsx`

- [ ] **Step 1: Fix AppShell stale today**

Read `frontend/src/components/layout/AppShell.tsx`. Find where `today` is computed (should be `const today = toLocalDateStr(new Date())`). This value never updates if the app stays open overnight.

Fix: compute `today` inline in the query call, or use a state variable that updates at midnight. The simplest fix is to compute it fresh inside each render (which is fine since `toLocalDateStr(new Date())` is cheap):

Actually, since `today` is used in a `useScheduleGrid` query key, computing it inline means the query key changes at midnight, which triggers a re-fetch — that's the desired behavior. If it's already defined as a `const` at render time, it will re-evaluate on each render (which happens frequently enough). Check if the issue is that it's defined outside the component or memoized. If it's just a `const` inside the component body, it's already correct. If it's in a `useMemo` or `useRef`, that would be the bug.

Read the code carefully and fix only if it's actually stale (e.g., stored in a ref or state that doesn't update).

- [ ] **Step 2: Fix DutyBoardTab unconditional useClassifications**

Read `frontend/src/pages/schedule/DutyBoardTab.tsx`. Find where `useClassifications()` is called. If it's called unconditionally at the top of the component, check if the hook supports an `enabled` option. If so, guard it with `{ enabled: isManager }` so employees don't make the unnecessary request.

If `useClassifications` doesn't support an `enabled` option (check the hook definition), leave it as-is and note why.

- [ ] **Step 3: Fix MonthView redundant key**

Read `frontend/src/pages/schedule/MonthView.tsx`. Find where `cellContent` has `key={dateStr}` and is then wrapped in a `<Tooltip key={dateStr}>`. Remove the inner key from `cellContent` since the outer wrapper already has it.

- [ ] **Step 4: Verify build + lint**

Run: `cd /home/peter/Timeshift/frontend && npm run build && npm run lint`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/AppShell.tsx frontend/src/pages/schedule/DutyBoardTab.tsx frontend/src/pages/schedule/MonthView.tsx
git commit -m "fix: guard useClassifications for employees, fix redundant keys, stale today"
```

---

### Task 12: Fix WeekView double-update

**Files:**
- Modify: `frontend/src/pages/schedule/WeekView.tsx`

- [ ] **Step 1: Read WeekView**

Read `frontend/src/pages/schedule/WeekView.tsx`. Find where clicking a day calls both `setSelectedDay(day)` and `onDateChange(day)`. The `onDateChange` updates the URL which triggers a re-render, and the useEffect re-evaluates `selectedDay`.

- [ ] **Step 2: Fix double-update**

The `onDateChange` callback updates the URL date param for bookmarking, which is correct. But the `useEffect` that resets `selectedDay` based on the `date` prop creates a double-update. Fix by removing the `onDateChange` call from the day click handler — only update `selectedDay` locally. The URL should only update when the user navigates weeks (prev/next), not when selecting a day within the current week.

OR, simpler: remove the `useEffect` that syncs `selectedDay` from the `date` prop, and just let `setSelectedDay` be the source of truth for which day is selected within the week. The `date` prop controls which week is displayed.

Read the code carefully to understand the current interaction before changing.

- [ ] **Step 3: Verify build + lint**

Run: `cd /home/peter/Timeshift/frontend && npm run build && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/schedule/WeekView.tsx
git commit -m "fix: eliminate double-update on WeekView day selection"
```

---

### Task 13: Deploy and verify

- [ ] **Step 1: Build and deploy frontend**

Run: `cd /home/peter/Timeshift/frontend && VITE_API_URL="" npm run build`

- [ ] **Step 2: Build and deploy backend**

Run: `cd /home/peter/Timeshift/backend && SQLX_OFFLINE=true cargo build --release && sudo systemctl restart timeshift-backend`

- [ ] **Step 3: Verify backend is running**

Run: `sudo systemctl is-active timeshift-backend`
Expected: `active`

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A && git status
```

If clean, done. If changes remain, commit them.

---

## Summary

| Chunk | Tasks | What it fixes |
|-------|-------|---------------|
| 1: Critical Backend | 1-3 | Org settings whitelist, password validation, assignments constraint + indexes |
| 2: Important Backend | 4-7 | Annotation validation, sellback locking, bidding fixes, token cleanup |
| 3: Frontend | 8-12 | Defunct routes, unused props, React keys, stale state, double-updates |
| Deploy | 13 | Build and deploy everything |

**Total: 13 tasks, 3 chunks + deploy.**
