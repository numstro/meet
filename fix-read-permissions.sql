-- Fix RLS policies to allow API to read rate_limits table

-- Drop existing policies that might be blocking reads
DROP POLICY IF EXISTS "Allow inserts for rate limiting" ON rate_limits;
DROP POLICY IF EXISTS "Allow reads for service role" ON rate_limits;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON rate_limits;

-- Create policies that allow both reading and writing
CREATE POLICY "Allow all operations for rate limiting" ON rate_limits
    FOR ALL USING (true);

-- Alternative: Disable RLS entirely for this table (simpler)
-- ALTER TABLE rate_limits DISABLE ROW LEVEL SECURITY;

-- Test the fix
SELECT COUNT(*) as total_records FROM rate_limits;
SELECT COUNT(*) as records_with_email FROM rate_limits WHERE creator_email IS NOT NULL;
