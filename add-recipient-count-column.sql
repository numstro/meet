-- Add recipient_count column to rate_limits table for exact email tracking
-- This allows us to track the exact number of emails sent per calendar invite

ALTER TABLE rate_limits 
ADD COLUMN IF NOT EXISTS recipient_count INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN rate_limits.recipient_count IS 'Number of email recipients for calendar invites (NULL for poll creation records)';

-- Create index for faster queries on calendar invite statistics
CREATE INDEX IF NOT EXISTS idx_rate_limits_recipient_count ON rate_limits(recipient_count) WHERE recipient_count IS NOT NULL;

