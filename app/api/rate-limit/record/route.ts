import { NextRequest, NextResponse } from 'next/server'
import { recordRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 
                     realIp || 
                     '127.0.0.1' // fallback for local development

    // Record the rate limit
    await recordRateLimit(ipAddress)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Rate limit recording error:', error)
    return NextResponse.json(
      { error: 'Failed to record rate limit' },
      { status: 500 }
    )
  }
}
