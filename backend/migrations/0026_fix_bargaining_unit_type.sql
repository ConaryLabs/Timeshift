-- Convert bargaining_unit columns from TEXT CHECK to bargaining_unit_enum for type safety.
-- Drops the auto-generated CHECK constraints before altering the column type.

ALTER TABLE vacation_bid_periods
    DROP CONSTRAINT IF EXISTS vacation_bid_periods_bargaining_unit_check,
    ALTER COLUMN bargaining_unit TYPE bargaining_unit_enum
        USING bargaining_unit::bargaining_unit_enum;

ALTER TABLE schedule_periods
    DROP CONSTRAINT IF EXISTS schedule_periods_bargaining_unit_check,
    ALTER COLUMN bargaining_unit TYPE bargaining_unit_enum
        USING bargaining_unit::bargaining_unit_enum;
