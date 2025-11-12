import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer'
import ical, { 
  ICalCalendarMethod, 
  ICalAttendeeStatus, 
  ICalAttendeeType,
  ICalEventStatus,
  ICalEventBusyStatus
} from 'ical-generator'
import { getVtimezoneComponent } from '@touch4it/ical-timezones'

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
    
    console.log(`[Calendar Invites] Found ${votes.length} vote(s) from ${uniqueVoters.length} unique voter(s):`, uniqueVoters.map(v => `${v.participant_name || v.participant_email} (${v.participant_email})`))

    // Generate calendar event times
    const timeBucket = pollOption.option_text || 'morning'
    
    // Parse times (format: "HH:MM") - these are either custom or defaults from frontend
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    // Create dates in the user's local timezone (matching Google Calendar's format)
    // We'll use timezone-aware times with VTIMEZONE blocks for Gmail compatibility
    const dateStrRaw = pollOption.option_date // Format: YYYY-MM-DD
    const [year, month, day] = dateStrRaw.split('-').map(Number)
    
    // Helper to create a Date object representing a local time in a specific timezone
    // Strategy: Create a date as if the local time were UTC, then calculate the actual UTC time
    // by finding what UTC time corresponds to the desired local time in the target timezone
    const createLocalDate = (dateStr: string, hour: number, min: number): Date => {
      const [y, m, d] = dateStr.split('-').map(Number)
      
      // Create a date string representing the desired local time
      const dateStrISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
      
      // Start with the assumption that this local time is UTC
      let candidateUTC = new Date(dateStrISO + 'Z')
      
      // Check what local time this UTC time represents in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: validTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      
      // Iteratively adjust until we get the right local time
      // (This handles DST transitions correctly)
      for (let attempts = 0; attempts < 3; attempts++) {
        const parts = formatter.formatToParts(candidateUTC)
        const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
        const tzMin = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
        
        // If we got the right time, we're done
        if (tzHour === hour && tzMin === min) {
          return candidateUTC
        }
        
        // Calculate offset and adjust
        const desiredMinutes = hour * 60 + min
        const actualMinutes = tzHour * 60 + tzMin
        const offsetMinutes = desiredMinutes - actualMinutes
        candidateUTC = new Date(candidateUTC.getTime() + (offsetMinutes * 60 * 1000))
      }
      
      return candidateUTC
    }
    
    // Create dates representing the local times in the user's timezone
    const start = createLocalDate(dateStrRaw, startHour, startMin)
    const end = createLocalDate(dateStrRaw, endHour, endMin)
    
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

    // Create calendar event with timezone-aware times (matching Google Calendar's format)
    // This will generate VTIMEZONE blocks automatically for Gmail compatibility
    // METHOD:REQUEST is required for Gmail to recognize this as an interactive meeting invite
    // NOTE: Do NOT include 'name' property - it's not a valid ICS property and causes Gmail to reject
    let calendar
    try {
      calendar = ical({ 
        timezone: {
          name: validTimezone,
          generator: getVtimezoneComponent // Generate VTIMEZONE blocks (matching Google's format)
        },
        method: ICalCalendarMethod.REQUEST, // Required for Gmail to render inline event card
        prodId: {
          company: 'Numstro',
          product: 'Meet',
          language: 'EN'
        }
      })
    } catch (error) {
      console.error('Error creating calendar with timezone generator:', error)
      // Fallback: create calendar without timezone generator (will use default)
      calendar = ical({ 
        timezone: validTimezone,
        method: ICalCalendarMethod.REQUEST,
        prodId: {
          company: 'Numstro',
          product: 'Meet',
          language: 'EN'
        }
      })
    }
    
    // Generate shorter UID to avoid line folding issues (max 75 chars)
    // Format: pollId-optionId-timestamp@domain (truncate if needed)
    const shortPollId = pollId.substring(0, 8) // First 8 chars of poll ID
    const shortOptionId = optionId.substring(0, 8) // First 8 chars of option ID
    const timestamp = Date.now().toString().slice(-10) // Last 10 digits of timestamp
    const shortHostname = request.nextUrl.hostname.replace('www.', '').substring(0, 20) // Max 20 chars
    const eventUid = `${shortPollId}-${shortOptionId}-${timestamp}@${shortHostname}`
    
    // Build event data object
    // Match Google Calendar's format as closely as possible for Gmail compatibility
    const now = new Date()
    const eventData: any = {
      start,
      end,
      timezone: validTimezone, // Specify timezone for this event (will use TZID format like Google)
      summary: poll.title,
      location: poll.location || undefined, // Only include if not empty
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
      id: eventUid, // Use shorter UID
      // Sequence number for updates/cancellations (start at 0, increment on changes)
      sequence: 0,
      // Add optional properties that Google Calendar includes (may help Gmail recognition)
      stamp: now, // DTSTAMP (already set by ical-generator, but explicit is better)
      created: now, // CREATED timestamp (when event was created)
      lastModified: now // LAST-MODIFIED timestamp (when event was last modified)
    }
    
    // Only include description if it has a value (empty descriptions cause issues)
    if (poll.description && poll.description.trim().length > 0) {
      eventData.description = poll.description
    }
    
    const event = calendar.createEvent(eventData)
    
    // Add TRANSP:OPAQUE property (indicates event blocks time, like Google Calendar)
    // This is not directly supported by ical-generator, so we'll add it manually after generation

    // Generate .ics file content - keep it simple!
    let icsContent = calendar.toString()
    
    // Essential fixes only:
    // 1. Remove invalid NAME property (causes Gmail to reject)
    icsContent = icsContent.replace(/^NAME:.*$/gm, '')
    
    // 2. Remove non-standard timezone properties (VTIMEZONE is the standard way)
    icsContent = icsContent.replace(/^TIMEZONE-ID:.*$/gm, '')
    icsContent = icsContent.replace(/^X-WR-TIMEZONE:.*$/gm, '')
    
    // 3. Ensure VTIMEZONE block is present (critical for Gmail to parse TZID)
    if (!icsContent.includes('BEGIN:VTIMEZONE')) {
      try {
        // Check if getVtimezoneComponent is available
        if (typeof getVtimezoneComponent !== 'function') {
          console.error('[ICS Generation] ERROR: getVtimezoneComponent is not a function')
          throw new Error('VTIMEZONE generator not available')
        }
        
        const vtimezone = getVtimezoneComponent(validTimezone)
        console.log('[ICS Generation] getVtimezoneComponent result type:', typeof vtimezone, 'is null?', vtimezone === null)
        
        if (!vtimezone || vtimezone === null || vtimezone === undefined) {
          console.error('[ICS Generation] ERROR: getVtimezoneComponent returned null/undefined for timezone:', validTimezone)
          throw new Error('VTIMEZONE generation returned null')
        }
        
        const vtimezoneString = String(vtimezone)
        if (vtimezoneString === 'null' || vtimezoneString === 'undefined' || !vtimezoneString.includes('BEGIN:VTIMEZONE')) {
          console.error('[ICS Generation] ERROR: Generated VTIMEZONE block is invalid. String value:', vtimezoneString.substring(0, 100))
          throw new Error('VTIMEZONE block validation failed')
        }
        
        const normalizedVtimezone = vtimezoneString.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
        const beforeReplace = icsContent
        icsContent = icsContent.replace(/(METHOD:REQUEST[\r\n]+)/, `$1${normalizedVtimezone}\r\n`)
        
        if (icsContent === beforeReplace) {
          console.error('[ICS Generation] ERROR: Regex replacement failed - VTIMEZONE not inserted')
          throw new Error('VTIMEZONE insertion failed')
        }
        
        if (!icsContent.includes('BEGIN:VTIMEZONE')) {
          console.error('[ICS Generation] ERROR: VTIMEZONE block not found after insertion')
          throw new Error('VTIMEZONE verification failed')
        }
        
        console.log('[ICS Generation] Successfully injected VTIMEZONE block')
      } catch (error: any) {
        console.error('[ICS Generation] CRITICAL: Failed to inject VTIMEZONE block:', error.message || error)
        // Without VTIMEZONE, Gmail can't parse TZID - this is a fatal error
        return NextResponse.json(
          { error: 'Failed to generate timezone information for calendar invite. Please contact support.' },
          { status: 500 }
        )
      }
    }
    
    // 4. Fix ORGANIZER/ATTENDEE format (remove quotes to match Google)
    icsContent = icsContent.replace(/ORGANIZER;CN="([^"]+)":/g, 'ORGANIZER;CN=$1:')
    icsContent = icsContent.replace(/CN="([^"]+)":MAILTO:/g, 'CN=$1:MAILTO:')
    
    // 5. Ensure CRLF line endings
    icsContent = icsContent.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
    
    // 6. Add CALSCALE if missing
    if (!icsContent.includes('CALSCALE:GREGORIAN')) {
      icsContent = icsContent.replace(/(VERSION:2\.0\r\n)/, '$1CALSCALE:GREGORIAN\r\n')
    }
    
    // 7. Add TRANSP:OPAQUE before END:VEVENT (if not present)
    if (!icsContent.includes('TRANSP:') && icsContent.includes('STATUS:CONFIRMED')) {
      icsContent = icsContent.replace(/(STATUS:CONFIRMED\r\n)/, '$1TRANSP:OPAQUE\r\n')
    }
    
    // Clean up any extra blank lines
    icsContent = icsContent.replace(/\r\n\r\n\r\n+/g, '\r\n\r\n')
    
    // Validate .ics content is not empty
    if (!icsContent || icsContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate calendar invite' },
        { status: 500 }
      )
    }

    // Send emails with calendar invite using Nodemailer with SMTP
    // This gives us full control over email headers for Gmail compatibility
    const smtpConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD
      }
    }

    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      return NextResponse.json(
        { error: 'SMTP not configured. Please set SMTP_USER and SMTP_PASS (or GMAIL_USER and GMAIL_APP_PASSWORD) environment variables.' },
        { status: 500 }
      )
    }

    // Create Nodemailer transporter
    const transporter = nodemailer.createTransport(smtpConfig)

    const emailResults = []
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">📅 Calendar Invite</h2>
        
        <p>Hi there,</p>
        
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

    // Send emails with rate limiting
    console.log(`[Calendar Invites] Preparing to send ${uniqueVoters.length} email(s) to:`, uniqueVoters.map(v => v.participant_email))
    
    for (let i = 0; i < uniqueVoters.length; i++) {
      const voter = uniqueVoters[i]
      console.log(`[Calendar Invites] Sending email ${i + 1}/${uniqueVoters.length} to ${voter.participant_email}`)
      try {
        await transporter.sendMail({
          from: 'Meetup <noreply@numstro.com>',
          to: voter.participant_email,
          replyTo: poll.creator_email,
          subject: `📅 Calendar Invite: ${poll.title}`,
          html: htmlContent.replace('Hi there,', `Hi ${voter.participant_name || 'there'},`),
          // Add calendar invite as attachment with proper Content-Type header
          // Nodemailer will automatically set the correct multipart/mixed Content-Type
          attachments: [
            {
              filename: 'invite.ics',
              content: icsContent,
              contentType: 'text/calendar; charset=UTF-8; method=REQUEST',
              contentDisposition: 'attachment'
            }
          ]
        })
        
        console.log(`[Calendar Invites] Successfully sent email to ${voter.participant_email}`)
        emailResults.push({ email: voter.participant_email, success: true })
      } catch (emailErr: any) {
        console.error(`[Calendar Invites] Failed to send email to ${voter.participant_email}:`, emailErr)
        emailResults.push({ 
          email: voter.participant_email, 
          success: false, 
          error: emailErr.message
        })
      }
      
      // Rate limiting: wait 600ms between emails
      // Only wait if not the last email
      if (i < uniqueVoters.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600))
      }
    }
    
    console.log(`[Calendar Invites] Email sending complete. Results:`, emailResults)

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

