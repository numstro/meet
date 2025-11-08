import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

// Force this route to be dynamic since we access headers
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 
                     realIp || 
                     '127.0.0.1' // fallback for local development

    // Check rate limit
    const rateLimitResult = await checkRateLimit(ipAddress)

    return NextResponse.json({
      allowed: rateLimitResult.allowed,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime.toISOString(),
      ipAddress: ipAddress // For debugging (remove in production)
    })
  } catch (error) {
    console.error('Rate limit API error:', error)
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    )
  }
}
