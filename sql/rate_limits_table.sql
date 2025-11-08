-- Create rate_limits table for tracking poll creation rate limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created 
ON rate_limits(ip_address, created_at);

-- Create index for cleanup queries  
CREATE INDEX IF NOT EXISTS idx_rate_limits_created_at 
ON rate_limits(created_at);

-- Add Row Level Security (RLS) - only allow service role access
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role can manage rate limits" ON rate_limits
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically clean up old rate limit records (older than 48 hours)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits 
  WHERE created_at < NOW() - INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run cleanup daily (if pg_cron extension is available)
-- Note: This might not work on all Supabase plans - can be run manually if needed
-- SELECT cron.schedule('cleanup-rate-limits', '0 2 * * *', 'SELECT cleanup_old_rate_limits();');

-- Grant necessary permissions
GRANT ALL ON rate_limits TO anon;
GRANT ALL ON rate_limits TO authenticated;
GRANT ALL ON rate_limits TO service_role;
