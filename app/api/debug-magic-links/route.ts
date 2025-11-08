import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Test if we can access the magic_links table
    const { data, error, count } = await supabase
      .from('magic_links')
      .select('*', { count: 'exact' })
      .limit(1)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      tableExists: !error,
      error: error?.message || null,
      recordCount: count,
      sampleData: data?.[0] || null,
      supabaseConfig: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL
      }
    })
  } catch (err) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      error: 'Unexpected error: ' + (err as Error).message,
      tableExists: false
    })
  }
}
