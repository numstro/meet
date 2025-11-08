import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    const { to, name, date, time } = await request.json()

    if (!process.env.RESEND_API_KEY) {
      console.log('Resend API key not configured, skipping email')
      return NextResponse.json({ success: true, message: 'Email skipped - no API key' })
    }

    const resend = new Resend(process.env.RESEND_API_KEY)

    const dateObj = new Date(`${date}T${time}`)
    const formattedDateTime = dateObj.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    const { data, error } = await resend.emails.send({
      from: 'Schedule App <noreply@yourdomain.com>', // Replace with your domain
      to: [to],
      subject: 'Meeting Confirmation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Meeting Confirmed! 🎉</h2>
          
          <p>Hi ${name},</p>
          
          <p>Your meeting has been successfully scheduled for:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0; color: #2563eb;">📅 ${formattedDateTime}</h3>
          </div>
          
          <p>We'll send you a reminder before the meeting.</p>
          
          <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated message from Schedule App.
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

