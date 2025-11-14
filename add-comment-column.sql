-- Add comment column to poll_responses table
-- This allows participants to add comments to their votes

ALTER TABLE poll_responses
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN poll_responses.comment IS 'Optional comment from participant about their vote for this time slot';



