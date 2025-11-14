-- Check what data we have in rate_limits table
-- This will help us understand why counts might be 0

-- 1. Check total records
SELECT COUNT(*) as total_records FROM rate_limits;

-- 2. Check records with creator_email (potential calendar invites)
SELECT 
  COUNT(*) as records_with_email,
  COUNT(DISTINCT ip_address) as unique_ips,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM rate_limits 
WHERE creator_email IS NOT NULL;

-- 3. Check records in last 24 hours
SELECT 
  COUNT(*) as records_last_24h,
  COUNT(CASE WHEN creator_email IS NOT NULL THEN 1 END) as invites_last_24h,
  COUNT(CASE WHEN creator_email IS NULL THEN 1 END) as polls_last_24h
FROM rate_limits 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- 4. Check recipient_count values
SELECT 
  COUNT(*) as total_records,
  COUNT(recipient_count) as records_with_recipient_count,
  SUM(recipient_count) as total_emails_sent,
  AVG(recipient_count) as avg_recipients_per_invite
FROM rate_limits 
WHERE creator_email IS NOT NULL;

-- 5. Sample of recent calendar invites
SELECT 
  id,
  ip_address,
  creator_email,
  recipient_count,
  created_at
FROM rate_limits 
WHERE creator_email IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

