-- Vacation bid period compliance fields
ALTER TABLE vacation_bid_periods
    ADD COLUMN allowance_hours     INT,
    ADD COLUMN min_block_hours     INT,
    ADD COLUMN bargaining_unit     TEXT CHECK (bargaining_unit IN ('vccea', 'vcsg'));
