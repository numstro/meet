-- Add option_id column to rate_limits table to track which poll options have had invites sent
ALTER TABLE rate_limits 
ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE;

-- Create index for efficient queries by option_id
CREATE INDEX IF NOT EXISTS idx_rate_limits_option_id 
ON rate_limits(option_id);

-- Create index for queries by poll_id (via option_id join)
-- Note: This will be useful when querying which options in a poll have invites sent

