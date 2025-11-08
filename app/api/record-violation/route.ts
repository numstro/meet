import { NextRequest, NextResponse } from 'next/server'
import { recordViolation } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🚨 VIOLATION ENDPOINT CALLED')
    
    // Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 
                     realIp || 
                     '127.0.0.1'

    // Get user agent
    const userAgent = request.headers.get('user-agent') || 'Unknown'

    // Get violation details from request body
    const { creatorEmail, creatorName, violationType, attemptedAction } = await request.json()

    console.log('🚨 VIOLATION DATA:', {
      ipAddress,
      creatorEmail,
      creatorName,
      violationType,
      attemptedAction,
      userAgent
    })

    // Record the violation
    await recordViolation(
      ipAddress,
      creatorEmail,
      creatorName,
      violationType || 'rate_limit_exceeded',
      userAgent,
      attemptedAction || 'create_poll'
    )

    console.log('🚨 VIOLATION RECORDED SUCCESSFULLY')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('🚨 VIOLATION RECORDING ERROR:', error)
    return NextResponse.json(
      { error: 'Failed to record violation', details: error.message },
      { status: 500 }
    )
  }
}
