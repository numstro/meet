-- Add soft delete columns to poll_responses table
-- is_active: false when participant leaves the poll (self-removal)
-- is_deleted: true when organizer removes participant (admin removal)

ALTER TABLE poll_responses 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_poll_responses_is_active ON poll_responses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_poll_responses_is_deleted ON poll_responses(is_deleted) WHERE is_deleted = false;

-- Update RLS policy to allow participants to update their own is_active flag
-- (Organizers can update is_deleted via service role key in API routes)

COMMENT ON COLUMN poll_responses.is_active IS 'Set to false when participant leaves the poll. Their votes are hidden but preserved for audit.';
COMMENT ON COLUMN poll_responses.is_deleted IS 'Set to true when organizer removes participant. Their votes are hidden and excluded from counts.';

