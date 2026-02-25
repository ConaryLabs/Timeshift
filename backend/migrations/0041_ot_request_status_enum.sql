-- Create a proper PG enum for OT request status (was TEXT with CHECK constraint)
CREATE TYPE ot_request_status AS ENUM ('open', 'partially_filled', 'filled', 'cancelled');

-- Drop the CHECK constraint first (it blocks the type conversion)
ALTER TABLE ot_requests DROP CONSTRAINT ot_requests_status_check;

-- Convert the column from TEXT to the new enum
ALTER TABLE ot_requests
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE ot_request_status USING status::ot_request_status,
    ALTER COLUMN status SET DEFAULT 'open';
