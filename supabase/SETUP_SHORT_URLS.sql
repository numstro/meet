-- ============================================
-- SHORT URL SETUP FOR MEET APP
-- ============================================
-- Run these SQL scripts in order in your Supabase SQL Editor
-- Make sure you're in the correct Supabase project!

-- ============================================
-- STEP 1: Check if polls table exists
-- ============================================
-- Run this first to verify your polls table exists
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'polls'
ORDER BY ordinal_position;

-- If this returns rows, the table exists. Continue to Step 2.
-- If it returns no rows, you need to run the base schema first (doodle-schema.sql)

-- ============================================
-- STEP 2: Add short_id column to polls table
-- ============================================
-- This adds the short_id column (nullable for now)
ALTER TABLE polls ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Create unique index on short_id (allows NULL values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_polls_short_id 
ON polls(short_id) 
WHERE short_id IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'polls' AND column_name = 'short_id';

-- ============================================
-- STEP 3: Generate short_ids for existing polls
-- ============================================
-- This will generate 6-character short IDs for all polls that don't have one
DO $$
DECLARE
  poll_record RECORD;
  new_short_id TEXT;
  counter INTEGER;
BEGIN
  FOR poll_record IN SELECT id FROM polls WHERE short_id IS NULL LOOP
    counter := 0;
    LOOP
      -- Generate a 6-character random string (alphanumeric, uppercase)
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
        RAISE EXCEPTION 'Failed to generate unique short_id after 100 attempts for poll %', poll_record.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- STEP 4: Verify the results
-- ============================================
-- Check that all polls now have short_ids
SELECT 
  id,
  short_id,
  title,
  created_at,
  CASE 
    WHEN short_id IS NULL THEN '❌ Missing short_id'
    ELSE '✅ Has short_id'
  END as status
FROM polls
ORDER BY created_at DESC
LIMIT 20;

-- Count how many polls have short_ids
SELECT 
  COUNT(*) as total_polls,
  COUNT(short_id) as polls_with_short_id,
  COUNT(*) - COUNT(short_id) as polls_without_short_id
FROM polls;

-- ============================================
-- DONE! 
-- ============================================
-- After running these scripts:
-- 1. Wait 1-2 minutes for Supabase's schema cache to refresh
-- 2. Create a new poll - it should automatically get a short_id
-- 3. Existing polls will have short_ids generated
-- 4. The app will automatically redirect UUID URLs to short_id URLs



