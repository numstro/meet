import { createClient } from '@supabase/supabase-js'
import { createDemoSupabase } from './demo-data'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Use real Supabase if environment variables are set, otherwise use demo mode
export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://demo.supabase.co') 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createDemoSupabase() as any

// Flag to indicate if we're in demo mode
export const isDemoMode = !supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://demo.supabase.co'

export type Database = {
  public: {
    Tables: {
      availability_slots: {
        Row: {
          id: string
          user_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          created_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          host_user_id: string
          guest_email: string
          guest_name: string | null
          booking_date: string
          start_time: string
          end_time: string
          notes: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          host_user_id: string
          guest_email: string
          guest_name?: string | null
          booking_date: string
          start_time: string
          end_time: string
          notes?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          host_user_id?: string
          guest_email?: string
          guest_name?: string | null
          booking_date?: string
          start_time?: string
          end_time?: string
          notes?: string | null
          status?: string
          created_at?: string
        }
      }
    }
  }
}
