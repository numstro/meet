-- Magic Links Authentication Table
-- Stores secure tokens for email-based authentication

CREATE TABLE IF NOT EXISTS magic_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_links_expires ON magic_links(expires_at);

-- RLS Policies
ALTER TABLE magic_links ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all magic links
CREATE POLICY "Service role can manage magic links" ON magic_links 
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON magic_links TO anon, authenticated, service_role;

-- Cleanup function for expired tokens (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_magic_links()
RETURNS void AS $$
BEGIN
  DELETE FROM magic_links 
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;
