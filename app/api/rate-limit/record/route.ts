import { NextRequest, NextResponse } from 'next/server'
import { recordRateLimit } from '@/lib/rate-limit'

// Force this route to be dynamic since we access headers
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 
                     realIp || 
                     '127.0.0.1' // fallback for local development

    // Get optional email and name from request body
    const body = await request.json().catch(() => ({}))
    const { creatorEmail, creatorName } = body

    // Record the rate limit with optional user info
    await recordRateLimit(ipAddress, creatorEmail, creatorName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Rate limit recording error:', error)
    return NextResponse.json(
      { error: 'Failed to record rate limit' },
      { status: 500 }
    )
  }
}
