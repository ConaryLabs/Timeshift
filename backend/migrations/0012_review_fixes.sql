-- Fix issues found during code review

-- Issue 3: vacation_bids missing UNIQUE on (window, preference_rank)
CREATE UNIQUE INDEX uq_vacation_bids_window_rank
    ON vacation_bids (vacation_bid_window_id, preference_rank);

-- Issue 4: ot_queue_positions needs position uniqueness within classification/year
CREATE UNIQUE INDEX uq_ot_queue_position
    ON ot_queue_positions (org_id, classification_id, fiscal_year, position);

-- Issue 5: leave_request_lines needs unique date per request
CREATE UNIQUE INDEX uq_leave_request_lines_date
    ON leave_request_lines (leave_request_id, date);

-- Issue 15: callout_events.current_step default to first step for new events
ALTER TABLE callout_events
    ALTER COLUMN current_step SET DEFAULT 'volunteers';
