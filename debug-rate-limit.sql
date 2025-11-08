-- Check Kenny's rate limit status
-- Count polls by IP in last 24 hours
SELECT 
  COUNT(*) as poll_count,
  MIN(created_at) as first_poll,
  MAX(created_at) as last_poll
FROM rate_limits 
WHERE ip_address = '75.54.101.187' 
AND created_at >= NOW() - INTERVAL '24 hours';

-- Show all polls by Kenny's IP
SELECT 
  ip_address, 
  creator_email, 
  creator_name, 
  created_at,
  AGE(NOW(), created_at) as time_ago
FROM rate_limits 
WHERE ip_address = '75.54.101.187' 
ORDER BY created_at DESC;
