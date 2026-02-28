-- Allow cancelling vacation bid periods
ALTER TABLE vacation_bid_periods DROP CONSTRAINT IF EXISTS vacation_bid_periods_status_check;
ALTER TABLE vacation_bid_periods ADD CONSTRAINT vacation_bid_periods_status_check
  CHECK (status IN ('draft', 'open', 'in_progress', 'completed', 'cancelled'));
