-- Add creator_admin_key column to polls table
-- This allows creators to access admin features (delete poll, send invites) without login
ALTER TABLE polls
ADD COLUMN IF NOT EXISTS creator_admin_key TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_polls_creator_admin_key ON polls(creator_admin_key);

