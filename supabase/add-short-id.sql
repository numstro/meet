-- Add short_id column to polls table for shorter URLs
-- Migration: Add short_id column and generate IDs for existing polls

-- Add short_id column (nullable initially for existing polls)
ALTER TABLE polls ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Create unique index on short_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_polls_short_id ON polls(short_id) WHERE short_id IS NOT NULL;

-- Generate short_ids for existing polls that don't have one
-- Using a simple function to generate 6-character alphanumeric IDs
DO $$
DECLARE
  poll_record RECORD;
  new_short_id TEXT;
  counter INTEGER;
BEGIN
  FOR poll_record IN SELECT id FROM polls WHERE short_id IS NULL LOOP
    counter := 0;
    LOOP
      -- Generate a 6-character random string (alphanumeric, case-sensitive)
      -- Using a combination of random numbers and characters
      new_short_id := upper(
        substr(md5(random()::text || poll_record.id::text || clock_timestamp()::text), 1, 6)
      );
      
      -- Check if this short_id already exists
      IF NOT EXISTS (SELECT 1 FROM polls WHERE short_id = new_short_id) THEN
        UPDATE polls SET short_id = new_short_id WHERE id = poll_record.id;
        EXIT;
      END IF;
      
      counter := counter + 1;
      -- Safety: prevent infinite loop
      IF counter > 100 THEN
        RAISE EXCEPTION 'Failed to generate unique short_id after 100 attempts';
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Make short_id NOT NULL for new polls (but keep nullable for now to avoid breaking existing code)
-- We'll enforce NOT NULL in application code for new polls

