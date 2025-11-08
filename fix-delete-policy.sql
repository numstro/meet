-- Simple fix: Add DELETE policy for polls
-- The CASCADE constraints will handle poll_options and poll_responses automatically

CREATE POLICY "Anyone can delete polls" ON polls FOR DELETE USING (true);
