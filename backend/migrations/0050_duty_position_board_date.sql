-- Add board_date column to duty_positions
-- NULL = permanent position (shows every day)
-- Set to a date = date-specific position (only appears on that date's board)
ALTER TABLE duty_positions ADD COLUMN board_date DATE;
