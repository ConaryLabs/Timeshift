-- Expand accrual_transactions reason check to include donation and forfeiture types
DO $$
BEGIN
    -- Drop old constraint if it doesn't already include the new reasons
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accrual_transactions_reason_check'
          AND conrelid = 'accrual_transactions'::regclass
          AND NOT pg_get_constraintdef(oid) LIKE '%donation_out%'
    ) THEN
        ALTER TABLE accrual_transactions DROP CONSTRAINT accrual_transactions_reason_check;
    END IF;

    -- Add new constraint if it doesn't exist yet
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'accrual_transactions_reason_check'
          AND conrelid = 'accrual_transactions'::regclass
    ) THEN
        ALTER TABLE accrual_transactions
            ADD CONSTRAINT accrual_transactions_reason_check
            CHECK (reason = ANY (ARRAY['accrual', 'usage', 'adjustment', 'carryover', 'donation_out', 'donation_in', 'forfeiture']));
    END IF;
END $$;
