import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { to, creatorName, pollTitle, pollUrl } = await request.json()

    if (!process.env.RESEND_API_KEY) {
      console.log('Resend API key not configured, skipping email')
      return NextResponse.json({ success: true, message: 'Email skipped - no API key' })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data, error } = await resend.emails.send({
      from: 'Meetup <noreply@numstro.com>',
      to: [to],
      subject: `Your poll is live: ${pollTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1d4ed8;">Your poll is live!</h2>

          <p>Hi ${creatorName},</p>

          <p>You created a poll: <strong>${pollTitle}</strong></p>

          <p>Share this link with your participants so they can vote on times:</p>

          <div style="margin: 24px 0;">
            <a href="${pollUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Poll</a>
          </div>

          <p style="color: #6b7280; font-size: 14px; word-break: break-all;">${pollUrl}</p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">

          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from Meetup.
          </p>
        </div>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Email API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
