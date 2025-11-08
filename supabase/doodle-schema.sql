-- Doodle-style polling schema

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  creator_name TEXT NOT NULL,
  creator_email TEXT NOT NULL,
  location TEXT,
  deadline DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Poll options (date/time combinations)
CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  option_text TEXT, -- For custom text options
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participant responses
CREATE TABLE IF NOT EXISTS poll_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  response TEXT CHECK (response IN ('yes', 'no', 'maybe')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(poll_id, option_id, participant_email)
);

-- Enable Row Level Security
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow public access for polls (since no auth required)
CREATE POLICY "Anyone can view polls" ON polls FOR SELECT USING (true);
CREATE POLICY "Anyone can create polls" ON polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Creators can update their polls" ON polls FOR UPDATE USING (true);

CREATE POLICY "Anyone can view poll options" ON poll_options FOR SELECT USING (true);
CREATE POLICY "Anyone can create poll options" ON poll_options FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view responses" ON poll_responses FOR SELECT USING (true);
CREATE POLICY "Anyone can create responses" ON poll_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Participants can update their own responses" ON poll_responses 
  FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_polls_created_at ON polls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_poll_id ON poll_responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_responses_participant ON poll_responses(participant_email);

-- Function to get poll summary
CREATE OR REPLACE FUNCTION get_poll_summary(poll_uuid UUID)
RETURNS TABLE (
  option_id UUID,
  option_date DATE,
  start_time TIME,
  end_time TIME,
  option_text TEXT,
  yes_count BIGINT,
  no_count BIGINT,
  maybe_count BIGINT,
  total_responses BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    po.id,
    po.option_date,
    po.start_time,
    po.end_time,
    po.option_text,
    COUNT(CASE WHEN pr.response = 'yes' THEN 1 END) as yes_count,
    COUNT(CASE WHEN pr.response = 'no' THEN 1 END) as no_count,
    COUNT(CASE WHEN pr.response = 'maybe' THEN 1 END) as maybe_count,
    COUNT(pr.response) as total_responses
  FROM poll_options po
  LEFT JOIN poll_responses pr ON po.id = pr.option_id
  WHERE po.poll_id = poll_uuid
  GROUP BY po.id, po.option_date, po.start_time, po.end_time, po.option_text
  ORDER BY po.option_date, po.start_time;
END;
$$ LANGUAGE plpgsql;

