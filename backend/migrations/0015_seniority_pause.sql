-- Seniority accrual pause/resume tracking.
--
-- Contract rules:
--   Seniority PAUSES on: unpaid LOA > 30 days, LWOP, layoff
--   Seniority CONTINUES (exceptions): OJI/L&I, pregnancy/maternity, military
--   "Pause" not "break" — dates advance by days-paused on return to active
--
-- Design:
--   users.employee_status tracks current employment/leave status
--   seniority_records.accrual_pause_started_at records when the pause began (null = not paused)
--   seniority_records.accrual_paused_days_total accumulates all past pause durations
--
-- Resume logic (in application layer): when status → 'active', if accrual_pause_started_at
--   is set, advance all three seniority dates by (CURRENT_DATE - accrual_pause_started_at),
--   accumulate that into accrual_paused_days_total, then clear accrual_pause_started_at.

CREATE TYPE employee_status_enum AS ENUM (
    'active',
    'unpaid_loa',   -- unpaid leave of absence (pauses unless exception)
    'lwop',         -- leave without pay (pauses unless exception)
    'layoff',       -- laid off; recall rights typically 18 months
    'separated'     -- permanently separated from employment
);

ALTER TABLE users
    ADD COLUMN employee_status employee_status_enum NOT NULL DEFAULT 'active';

ALTER TABLE seniority_records
    ADD COLUMN accrual_pause_started_at  DATE,
    ADD COLUMN accrual_paused_days_total INT  NOT NULL DEFAULT 0;

COMMENT ON COLUMN seniority_records.accrual_pause_started_at IS
    'Date the current accrual pause began; NULL means accrual is running normally.';
COMMENT ON COLUMN seniority_records.accrual_paused_days_total IS
    'Cumulative days of non-exception pauses (used for audit/reporting).';
