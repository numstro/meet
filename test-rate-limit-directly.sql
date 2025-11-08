-- Simulate rate limit being hit by adding fake entries
-- This will test if rate limiting blocks creation without creating real polls

INSERT INTO rate_limits (ip_address, creator_email, creator_name, created_at) 
VALUES 
  ('75.54.101.187', 'test1@example.com', 'Test 1', NOW()),
  ('75.54.101.187', 'test2@example.com', 'Test 2', NOW()),
  ('75.54.101.187', 'test3@example.com', 'Test 3', NOW()),
  ('75.54.101.187', 'test4@example.com', 'Test 4', NOW());

-- Now check if rate limit API properly detects 5 total (1 real + 4 fake)
-- Visit: meet.numstro.com/api/rate-limit
-- Should show: "allowed": false, "remaining": 0

-- After testing, clean up the fake entries:
-- DELETE FROM rate_limits WHERE creator_email LIKE 'test%@example.com';
