import { NextRequest, NextResponse } from 'next/server'
import { supabase, isDemoMode } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      isDemoMode,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      // Test actual connection
      connectionTest: await testConnection()
    })
  } catch (err) {
    return NextResponse.json({
      error: 'Error: ' + (err as Error).message,
      timestamp: new Date().toISOString()
    })
  }
}

async function testConnection() {
  try {
    const { data, error } = await supabase.from('polls').select('id').limit(1)
    return {
      success: !error,
      error: error?.message || null,
      recordCount: data?.length || 0
    }
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message
    }
  }
}
