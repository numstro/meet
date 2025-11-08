import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    resendConfig: {
      hasApiKey: !!process.env.RESEND_API_KEY,
      apiKeyLength: process.env.RESEND_API_KEY?.length || 0,
      apiKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 5) || 'none'
    },
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || 'local'
  })
}
