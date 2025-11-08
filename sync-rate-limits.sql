-- Sync rate_limits table with actual polls created
-- This fixes the data inconsistency where polls were created but not tracked in rate_limits

-- First, let's see the current mismatch
SELECT 
  p.creator_email,
  p.creator_name,
  COUNT(p.id) as actual_polls,
  COALESCE(rl.tracked_polls, 0) as tracked_polls,
  COUNT(p.id) - COALESCE(rl.tracked_polls, 0) as missing_records
FROM polls p
LEFT JOIN (
  SELECT creator_email, COUNT(*) as tracked_polls 
  FROM rate_limits 
  WHERE creator_email IS NOT NULL 
  GROUP BY creator_email
) rl ON p.creator_email = rl.creator_email
WHERE p.creator_email IS NOT NULL
GROUP BY p.creator_email, p.creator_name, rl.tracked_polls
HAVING COUNT(p.id) != COALESCE(rl.tracked_polls, 0)
ORDER BY actual_polls DESC;

-- Create missing rate_limit records for polls that weren't tracked
-- This will backfill the missing data
INSERT INTO rate_limits (ip_address, creator_email, creator_name, created_at)
SELECT 
  '75.54.101.187' as ip_address, -- Use Kenny's IP for existing polls
  creator_email,
  creator_name,
  created_at
FROM polls 
WHERE creator_email = 'kennyjchang@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM rate_limits 
  WHERE rate_limits.creator_email = polls.creator_email 
  AND rate_limits.created_at = polls.created_at
);

-- Verify the fix worked
SELECT 
  'After sync:' as status,
  creator_email,
  COUNT(*) as total_rate_limit_records
FROM rate_limits 
WHERE creator_email = 'kennyjchang@gmail.com'
GROUP BY creator_email;
