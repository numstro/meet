import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, recordViolation } from '@/lib/rate-limit'

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

    // Get user agent for violation tracking
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    // Check rate limit
    const rateLimitResult = await checkRateLimit(ipAddress)

    // If not allowed, record the violation (but don't block the API response)
    if (!rateLimitResult.allowed && rateLimitResult.reason) {
      try {
        // We don't have email/name at this stage, will get them when they try to create
        await recordViolation(ipAddress, undefined, undefined, 'rate_limit_exceeded', userAgent, 'create_poll')
      } catch (violationError) {
        console.error('Failed to record violation:', violationError)
        // Don't fail the request if violation recording fails
      }
    }

    return NextResponse.json({
      allowed: rateLimitResult.allowed,
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime.toISOString(),
      reason: rateLimitResult.reason,
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
