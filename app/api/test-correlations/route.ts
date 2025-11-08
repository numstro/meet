import { NextResponse } from 'next/server'
import { supabase, isDemoMode } from '@/lib/supabase'

export async function GET() {
  try {
    if (isDemoMode) {
      return NextResponse.json({ 
        error: 'Demo mode active', 
        correlations: [] 
      })
    }

    // Get all rate limits data (same query as monitoring dashboard)
    const { data: allRateLimits, error } = await supabase
      .from('rate_limits')
      .select('*')
      .not('creator_email', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ 
        error: error.message, 
        correlations: [] 
      })
    }

    // Process the same way as monitoring dashboard
    const emailGroups: Record<string, any[]> = {}
    
    allRateLimits?.forEach((record: any) => {
      if (record.creator_email && record.creator_email.trim()) {
        const email = record.creator_email.trim()
        if (!emailGroups[email]) {
          emailGroups[email] = []
        }
        emailGroups[email].push(record)
      }
    })

    // Convert to correlation format
    const correlations = Object.entries(emailGroups).map(([email, records]) => {
      const ips = Array.from(new Set(records.map(r => r.ip_address)))
      const names = records.map(r => r.creator_name).filter(n => n)
      const latestName = names[names.length - 1] || 'Unknown'
      
      return {
        email,
        name: latestName,
        ip_addresses: ips,
        poll_count: records.length,
        first_seen: records[records.length - 1].created_at,
        last_seen: records[0].created_at
      }
    })

    return NextResponse.json({
      rawRecords: allRateLimits?.length || 0,
      emailGroups: Object.keys(emailGroups),
      correlations,
      success: true
    })

  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message, 
      correlations: [] 
    }, { status: 500 })
  }
}
