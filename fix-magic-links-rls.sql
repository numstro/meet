-- Fix RLS policy for magic_links table
-- The current policy only allows service_role, but we need anon role to insert

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Service role can manage magic links" ON magic_links;

-- Create policies that allow anon role to insert and service_role to manage
CREATE POLICY "Allow anon to insert magic links" ON magic_links 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow service role to manage magic links" ON magic_links 
  FOR ALL USING (auth.role() = 'service_role');

-- Verify the policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'magic_links'
ORDER BY cmd;
