-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create availability_slots table
CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_email TEXT NOT NULL,
  guest_name TEXT,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_booking_time CHECK (start_time < end_time),
  CONSTRAINT future_booking CHECK (booking_date >= CURRENT_DATE)
);

-- Enable Row Level Security
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for availability_slots
CREATE POLICY "Users can view all availability slots" ON availability_slots
  FOR SELECT USING (true);

CREATE POLICY "Users can manage their own availability slots" ON availability_slots
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for bookings
CREATE POLICY "Users can view their own bookings as host" ON bookings
  FOR SELECT USING (auth.uid() = host_user_id);

CREATE POLICY "Users can view bookings with their email as guest" ON bookings
  FOR SELECT USING (auth.email() = guest_email);

CREATE POLICY "Users can create bookings" ON bookings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own bookings as host" ON bookings
  FOR UPDATE USING (auth.uid() = host_user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_availability_slots_user_day ON availability_slots(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_bookings_host_date ON bookings(host_user_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_guest_email ON bookings(guest_email);

-- Function to check for booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflict(
  p_host_user_id UUID,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_booking_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bookings
    WHERE host_user_id = p_host_user_id
      AND booking_date = p_booking_date
      AND status = 'confirmed'
      AND (p_booking_id IS NULL OR id != p_booking_id)
      AND (
        (start_time <= p_start_time AND end_time > p_start_time) OR
        (start_time < p_end_time AND end_time >= p_end_time) OR
        (start_time >= p_start_time AND end_time <= p_end_time)
      )
  );
END;
$$ LANGUAGE plpgsql;

