-- Track how an OT assignment was obtained and whether it was later cancelled.
ALTER TABLE assignments
    ADD COLUMN ot_type VARCHAR(20),       -- 'voluntary', 'elective', 'mandatory' (NULL for non-OT shifts)
    ADD COLUMN cancelled_at TIMESTAMPTZ;  -- set when employee backs out of OT
