-- Add IP tracking to polls table for rate limiting
-- This makes polls table the single source of truth

-- Add creator_ip column to polls table
ALTER TABLE polls ADD COLUMN creator_ip TEXT;

-- Update existing polls with Kenny's IP (one-time migration)
UPDATE polls 
SET creator_ip = '75.54.101.187' 
WHERE creator_email = 'kennyjchang@gmail.com';

-- Add index for fast IP-based queries
CREATE INDEX IF NOT EXISTS idx_polls_creator_ip_created ON polls(creator_ip, created_at DESC);

-- Verify the update worked
SELECT 
  id,
  title,
  creator_email,
  creator_ip,
  created_at
FROM polls 
WHERE creator_email = 'kennyjchang@gmail.com'
ORDER BY created_at DESC
LIMIT 5;
