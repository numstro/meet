-- Diagnostic queries to find why monitoring shows 0s

-- 1. Check if recipient_count column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rate_limits' 
AND column_name = 'recipient_count';

-- 2. Check ALL calendar invites (with creator_email)
SELECT 
  COUNT(*) as total_invites,
  COUNT(recipient_count) as invites_with_recipient_count,
  MIN(created_at) as earliest_invite,
  MAX(created_at) as latest_invite
FROM rate_limits 
WHERE creator_email IS NOT NULL;

-- 3. Check invites in last 24 hours
SELECT 
  COUNT(*) as invites_last_24h,
  SUM(COALESCE(recipient_count, 1)) as estimated_emails,
  created_at
FROM rate_limits 
WHERE creator_email IS NOT NULL
AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY created_at
ORDER BY created_at DESC;

-- 4. Check recent calendar invites with details
SELECT 
  id,
  ip_address,
  creator_email,
  recipient_count,
  created_at,
  NOW() - created_at as age
FROM rate_limits 
WHERE creator_email IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check if polls created today have creator_ip
SELECT 
  COUNT(*) as polls_today,
  COUNT(creator_ip) as polls_with_ip,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM polls
WHERE created_at >= CURRENT_DATE;

-- 6. Check recent polls
SELECT 
  id,
  title,
  creator_ip,
  creator_email,
  created_at,
  NOW() - created_at as age
FROM polls
ORDER BY created_at DESC
LIMIT 5;

