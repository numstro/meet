import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Lightweight endpoint to keep the Supabase project active.
// Hit this every few days to prevent the free-tier project from being paused.
export async function GET() {
  try {
    // Minimal query — just check the connection is alive
    const { error } = await supabase.from('polls').select('id').limit(1)
    if (error) throw error
    return NextResponse.json({ ok: true, ts: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
