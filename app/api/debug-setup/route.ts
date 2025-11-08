import { NextRequest, NextResponse } from 'next/server'
import { supabase, isDemoMode } from '@/lib/supabase'

// Force this route to be dynamic since we access headers
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 
                     realIp || 
                     '127.0.0.1'

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      isDemoMode,
      ipAddress,
      supabaseConfig: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlValue: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'
      },
      tableTests: {}
    }

    // Only test database if not in demo mode
    if (!isDemoMode) {
      try {
        // Test rate_limits table structure
        const { data: rateLimitsTest, error: rateLimitsError } = await supabase
          .from('rate_limits')
          .select('*')
          .limit(1)

        debugInfo.tableTests.rate_limits = {
          exists: !rateLimitsError,
          error: rateLimitsError?.message || null,
          sampleRecord: rateLimitsTest?.[0] || null
        }

        // Test banned_ips table
        const { data: bannedIpsTest, error: bannedIpsError } = await supabase
          .from('banned_ips')
          .select('*')
          .limit(1)

        debugInfo.tableTests.banned_ips = {
          exists: !bannedIpsError,
          error: bannedIpsError?.message || null
        }

        // Test rate_limit_violations table
        const { data: violationsTest, error: violationsError } = await supabase
          .from('rate_limit_violations')
          .select('*')
          .limit(1)

        debugInfo.tableTests.rate_limit_violations = {
          exists: !violationsError,
          error: violationsError?.message || null
        }

        // Check if rate_limits has email columns
        const { data: rateLimitsWithEmail } = await supabase
          .from('rate_limits')
          .select('creator_email, creator_name')
          .limit(1)

        debugInfo.tableTests.rate_limits_has_email_columns = !!rateLimitsWithEmail

      } catch (dbError: any) {
        debugInfo.tableTests.error = dbError.message
      }
    }

    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error: any) {
    console.error('Debug setup API error:', error)
    return NextResponse.json(
      { 
        error: 'Debug failed', 
        details: error.message,
        isDemoMode 
      },
      { status: 500 }
    )
  }
}
