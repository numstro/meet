-- Create table for banned IP addresses
CREATE TABLE IF NOT EXISTS banned_ips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  banned_by TEXT, -- Admin email/name who banned this IP
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE, -- NULL means permanent ban
  is_active BOOLEAN DEFAULT true
);

-- Create table for tracking rate limit violations
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  creator_email TEXT,
  creator_name TEXT,
  violation_type TEXT DEFAULT 'rate_limit_exceeded', -- Could expand to other violations
  attempted_action TEXT, -- e.g., 'create_poll'
  current_count INTEGER, -- How many polls they already created
  limit_exceeded INTEGER, -- What limit they tried to exceed
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_banned_ips_ip_address ON banned_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_banned_ips_active ON banned_ips(is_active);
CREATE INDEX IF NOT EXISTS idx_banned_ips_expires ON banned_ips(expires_at);

CREATE INDEX IF NOT EXISTS idx_violations_ip_created ON rate_limit_violations(ip_address, created_at);
CREATE INDEX IF NOT EXISTS idx_violations_email ON rate_limit_violations(creator_email);
CREATE INDEX IF NOT EXISTS idx_violations_created_at ON rate_limit_violations(created_at);

-- Add Row Level Security
ALTER TABLE banned_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- Policies for banned_ips
CREATE POLICY "Service role can manage banned IPs" ON banned_ips
  FOR ALL USING (auth.role() = 'service_role');

-- Policies for rate_limit_violations
CREATE POLICY "Service role can manage violations" ON rate_limit_violations
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON banned_ips TO anon;
GRANT ALL ON banned_ips TO authenticated;
GRANT ALL ON banned_ips TO service_role;

GRANT ALL ON rate_limit_violations TO anon;
GRANT ALL ON rate_limit_violations TO authenticated;
GRANT ALL ON rate_limit_violations TO service_role;

-- Function to check if an IP is banned
CREATE OR REPLACE FUNCTION is_ip_banned(check_ip_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM banned_ips 
    WHERE ip_address = check_ip_address 
    AND is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired bans
CREATE OR REPLACE FUNCTION cleanup_expired_bans()
RETURNS void AS $$
BEGIN
  UPDATE banned_ips 
  SET is_active = false 
  WHERE expires_at IS NOT NULL 
  AND expires_at <= NOW() 
  AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
