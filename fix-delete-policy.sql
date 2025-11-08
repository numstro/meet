-- Add missing DELETE policy for polls table
-- This allows polls to be deleted, which is needed for proper deletion functionality

-- Add DELETE policy for polls
CREATE POLICY "Anyone can delete polls" ON polls FOR DELETE USING (true);

-- Add DELETE policy for poll_options (should inherit from CASCADE but being explicit)
CREATE POLICY "Anyone can delete poll options" ON poll_options FOR DELETE USING (true);

-- Add DELETE policy for poll_responses (should inherit from CASCADE but being explicit) 
CREATE POLICY "Anyone can delete poll responses" ON poll_responses FOR DELETE USING (true);

-- Verify policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('polls', 'poll_options', 'poll_responses')
ORDER BY tablename, cmd;
