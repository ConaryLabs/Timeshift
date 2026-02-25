-- Track when a bid window was auto-advanced (expired without submission)
ALTER TABLE bid_windows ADD COLUMN auto_advanced_at TIMESTAMPTZ DEFAULT NULL;
