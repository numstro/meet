-- Backfill short_ids for existing polls that don't have one
-- This will generate short IDs for any polls that were created before the schema cache refreshed

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

-- Verify the update
SELECT id, short_id, title FROM polls ORDER BY created_at DESC LIMIT 10;

