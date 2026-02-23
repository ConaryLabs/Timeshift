-- Goal 167: Shift Bid System Contract Compliance

-- M2: Sequential bid unlock — track unlock/approval state per window
ALTER TABLE bid_windows
    ADD COLUMN unlocked_at  TIMESTAMPTZ,
    ADD COLUMN approved_at  TIMESTAMPTZ,
    ADD COLUMN approved_by  UUID REFERENCES users(id);

-- M3: Bargaining unit per schedule period for BU-specific bid filtering
ALTER TABLE schedule_periods
    ADD COLUMN bargaining_unit TEXT CHECK (bargaining_unit IN ('vccea', 'vcsg'));

-- M4: Flex slot designation
ALTER TABLE shift_slots
    ADD COLUMN is_flex BOOLEAN NOT NULL DEFAULT FALSE;
