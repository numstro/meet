import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // Get IP address for logging
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'
    
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex')
    
    // Set expiration (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    // Store magic link in database
    const { error: dbError } = await supabase
      .from('magic_links')
      .insert({
        email: email.toLowerCase(),
        token,
        expires_at: expiresAt.toISOString(),
        ip_address: ip,
        user_agent: userAgent
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ 
        error: 'Failed to generate magic link', 
        details: dbError.message,
        code: dbError.code 
      }, { status: 500 })
    }

    // Create magic link URL
    const magicUrl = `${request.nextUrl.origin}/auth/magic?token=${token}`

    // Send email with magic link (only if API key is available)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: email,
          subject: 'Your Magic Link',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>🪄 Access Your Polls</h2>
              <p>Click the link below to access and manage your polls:</p>
              
              <div style="margin: 30px 0;">
                <a href="${magicUrl}" 
                   style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Access My Polls
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px;">
                This link expires in 15 minutes for security.<br>
                If you didn't request this, you can safely ignore this email.
              </p>
              
              <p style="color: #999; font-size: 12px;">
                Or copy this link: ${magicUrl}
              </p>
            </div>
          `
        })
      } catch (emailError) {
        console.error('Email error:', emailError)
        // Don't fail the request if email fails - user can still use the link
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Magic link sent to your email',
      // In development, also return the link
      ...(process.env.NODE_ENV === 'development' && { magicUrl })
    })

  } catch (error) {
    console.error('Magic link generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
