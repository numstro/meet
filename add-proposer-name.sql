-- Add proposer name tracking to poll_options table
-- This allows us to show who suggested each time option

ALTER TABLE poll_options ADD COLUMN proposed_by_name TEXT;

-- Update existing options to show they were created by the poll creator
-- We'll use the creator_name from the polls table
UPDATE poll_options 
SET proposed_by_name = (
  SELECT creator_name 
  FROM polls 
  WHERE polls.id = poll_options.poll_id
)
WHERE proposed_by_name IS NULL;

-- Add index for performance (optional)
CREATE INDEX IF NOT EXISTS idx_poll_options_proposed_by ON poll_options(proposed_by_name);
