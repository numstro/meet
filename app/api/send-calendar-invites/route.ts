import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Resend } from 'resend'
import ical, { 
  ICalCalendarMethod, 
  ICalAttendeeStatus, 
  ICalAttendeeType,
  ICalEventStatus,
  ICalEventBusyStatus
} from 'ical-generator'

export const dynamic = 'force-dynamic'

// Helper function to convert time bucket to actual time
function getTimeFromBucket(date: string, timeBucket: string): { start: Date; end: Date } {
  const eventDate = new Date(date)
  
  // Set time based on bucket (each event lasts 4 hours)
  let startHour = 8 // Morning: 8 AM
  let endHour = 12 // Morning: 12 PM
  
  if (timeBucket === 'afternoon') {
    startHour = 13 // Afternoon: 1 PM
    endHour = 17 // Afternoon: 5 PM
  } else if (timeBucket === 'evening') {
    startHour = 17 // Evening: 5 PM
    endHour = 21 // Evening: 9 PM
  }
  
  const start = new Date(eventDate)
  start.setHours(startHour, 0, 0, 0)
  
  const end = new Date(eventDate)
  end.setHours(endHour, 0, 0, 0)
  
  return { start, end }
}

export async function POST(request: NextRequest) {
  try {
    const { pollId, optionId, creatorEmail, startTime, endTime, timezone } = await request.json()
    
    if (!pollId || !optionId || !creatorEmail || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: pollId, optionId, creatorEmail, startTime, endTime' },
        { status: 400 }
      )
    }

    // Use provided timezone or fallback to America/Los_Angeles
    // Validate timezone format (IANA timezone identifier)
    const validTimezone = timezone && typeof timezone === 'string' && timezone.length > 0
      ? timezone
      : 'America/Los_Angeles'

    // Verify creator email matches poll creator
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('*')
      .eq('id', pollId)
      .eq('creator_email', creatorEmail.toLowerCase())
      .single()

    if (pollError || !poll) {
      return NextResponse.json(
        { error: 'Unauthorized: Only the poll creator can send calendar invites. The email you entered does not match the poll creator\'s email.' },
        { status: 403 }
      )
    }

    // Get the selected poll option
    const { data: pollOption, error: optionError } = await supabase
      .from('poll_options')
      .select('*')
      .eq('id', optionId)
      .eq('poll_id', pollId)
      .single()

    if (optionError || !pollOption) {
      return NextResponse.json(
        { error: 'Poll option not found' },
        { status: 404 }
      )
    }

    // Get all voters who voted "yes" or "maybe" for this option
    const { data: votes, error: votesError } = await supabase
      .from('poll_responses')
      .select('participant_email, participant_name')
      .eq('poll_id', pollId)
      .eq('option_id', optionId)
      .in('response', ['yes', 'maybe'])

    if (votesError) {
      return NextResponse.json(
        { error: 'Failed to fetch voters' },
        { status: 500 }
      )
    }

    if (!votes || votes.length === 0) {
      return NextResponse.json(
        { error: 'No voters found for this option' },
        { status: 400 }
      )
    }

    // Type the votes properly
    type Voter = { participant_email: string; participant_name: string }
    const typedVotes = votes as Voter[]

    // Get unique voters (in case someone voted multiple times)
    const uniqueVoters = Array.from(
      new Map(typedVotes.map(v => [v.participant_email, v])).values()
    )

    // Generate calendar event times
    const timeBucket = pollOption.option_text || 'morning'
    
    // Parse times (format: "HH:MM") - these are either custom or defaults from frontend
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    // Create dates in local timezone
    // Use the date string and construct a proper date-time string
    const dateStrRaw = pollOption.option_date // Format: YYYY-MM-DD
    
    // Create date objects in local timezone (will be converted to UTC by ical-generator)
    const start = new Date(`${dateStrRaw}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`)
    const end = new Date(`${dateStrRaw}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`)
    
    // Check if event is in the past (compare dates only, ignoring time to avoid timezone issues)
    // Get today's date at midnight in the same timezone
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eventDate = new Date(start)
    eventDate.setHours(0, 0, 0, 0)
    
    // Only reject if the event date is before today (not same day)
    if (eventDate < today) {
      return NextResponse.json(
        { error: 'Cannot send calendar invites for events in the past' },
        { status: 400 }
      )
    }
    
    // Format date/time for display
    const dateStr = new Date(pollOption.option_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
    
    // Format time string for display
    const formatTime = (date: Date) => {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
    }
    const timeStr = `${formatTime(start)} - ${formatTime(end)}`

    // Create calendar event with explicit timezone
    // Use the user's detected timezone to ensure times are interpreted correctly by Gmail/calendar apps
    // METHOD:REQUEST is required for Gmail to recognize this as an interactive meeting invite
    const calendar = ical({ 
      name: poll.title,
      timezone: validTimezone,
      method: ICalCalendarMethod.REQUEST, // Required for Gmail to render inline event card
      prodId: {
        company: 'Numstro',
        product: 'Meet',
        language: 'EN'
      }
    })
    
    const event = calendar.createEvent({
      start,
      end,
      timezone: validTimezone, // Use detected timezone from user's browser
      summary: poll.title,
      description: poll.description || '',
      location: poll.location || '',
      url: `${request.nextUrl.origin}/poll/${pollId}`,
      organizer: {
        name: poll.creator_name,
        email: poll.creator_email
      },
      attendees: uniqueVoters.map(v => ({
        name: v.participant_name || v.participant_email,
        email: v.participant_email,
        rsvp: true,
        status: ICalAttendeeStatus.NEEDSACTION,
        type: ICalAttendeeType.INDIVIDUAL
      })),
      status: ICalEventStatus.CONFIRMED,
      busystatus: ICalEventBusyStatus.BUSY,
      // Add unique ID to ensure Gmail recognizes it as a unique event
      id: `${pollId}-${optionId}-${Date.now()}@${request.nextUrl.hostname}`,
      // Sequence number for updates/cancellations (start at 0, increment on changes)
      sequence: 0
    })

    // Generate .ics file content
    const icsContent = calendar.toString()
    
    // Validate .ics content is not empty
    if (!icsContent || icsContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate calendar invite' },
        { status: 500 }
      )
    }

    // Send emails with calendar invite
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const emailResults = []

    // Resend rate limit: 2 requests per second
    // Add delay between emails to avoid rate limiting
    for (let i = 0; i < uniqueVoters.length; i++) {
      const voter = uniqueVoters[i]
      try {
        await resend.emails.send({
          from: 'Meetup <noreply@numstro.com>',
          to: voter.participant_email,
          reply_to: poll.creator_email,
          subject: `📅 Calendar Invite: ${poll.title}`,
          // Add calendar invite as attachment
          // Note: Resend auto-detects .ics files, but we can't set custom Content-Type header
          // The METHOD:REQUEST in the .ics file itself should be sufficient for Gmail
          attachments: [
            {
              filename: 'invite.ics',
              content: Buffer.from(icsContent).toString('base64')
            }
          ],
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">📅 Calendar Invite</h2>
              
              <p>Hi ${voter.participant_name || 'there'},</p>
              
              <p><strong>${poll.creator_name}</strong> has scheduled the meeting based on your availability:</p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #111827;">${poll.title}</h3>
                ${poll.description ? `<p style="color: #4b5563;">${poll.description}</p>` : ''}
                
                <div style="margin-top: 15px;">
                  <p style="margin: 5px 0;"><strong>📅 Date:</strong> ${dateStr}</p>
                  <p style="margin: 5px 0;"><strong>🕐 Time:</strong> ${timeStr}</p>
                  ${poll.location ? `<p style="margin: 5px 0;"><strong>📍 Location:</strong> ${poll.location}</p>` : ''}
                </div>
              </div>
              
              <p style="color: #6b7280; font-size: 14px;">
                A calendar invite has been attached to this email. Please add it to your calendar.
              </p>
              
              <div style="margin: 30px 0;">
                <a href="${request.nextUrl.origin}/poll/${pollId}" 
                   style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Poll
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                This invite was sent because you voted "yes" or "maybe" for this time slot.
              </p>
            </div>
          `
        })
        
        emailResults.push({ email: voter.participant_email, success: true })
      } catch (emailErr: any) {
        console.error(`Failed to send email to ${voter.participant_email}:`, emailErr)
        emailResults.push({ 
          email: voter.participant_email, 
          success: false, 
        })
      }
      
      // Rate limiting: wait 600ms between emails (allows ~1.67 requests/second, under the 2/sec limit)
      // Only wait if not the last email
      if (i < uniqueVoters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600))
      }
    }

    const successCount = emailResults.filter(r => r.success).length
    const failCount = emailResults.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Calendar invites sent to ${successCount} participant${successCount !== 1 ? 's' : ''}`,
      sent: successCount,
      failed: failCount,
      total: uniqueVoters.length
    })

  } catch (error: any) {
    console.error('Send calendar invites error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

