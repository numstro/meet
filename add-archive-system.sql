-- Add archive system to polls table
-- This enables tracking of expired and deleted polls

-- Add deleted_at column for soft deletes
ALTER TABLE polls ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_polls_deleted_at ON polls(deleted_at);
CREATE INDEX IF NOT EXISTS idx_polls_deadline ON polls(deadline);

-- Create a view for easy poll status queries
CREATE OR REPLACE VIEW poll_status AS
SELECT 
  *,
  CASE 
    WHEN deleted_at IS NOT NULL THEN 'deleted'
    WHEN deadline IS NOT NULL AND deadline::date < CURRENT_DATE THEN 'expired'
    ELSE 'active'
  END as status
FROM polls;

-- Grant access to the view
GRANT SELECT ON poll_status TO anon, authenticated, service_role;
