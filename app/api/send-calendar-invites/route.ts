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

    // Generate .ics file content with proper line folding
    // Use ical-generator to create the structure, but manually format to ensure proper folding
    let icsContent = calendar.toString()
    
    // Remove invalid properties that ical-generator might add
    // NAME: is NOT a valid ICS property and causes Gmail to reject the file
    icsContent = icsContent.replace(/^NAME:.*$/gm, '')
    // X-WR-CALNAME is non-standard and might confuse Gmail
    icsContent = icsContent.replace(/^X-WR-CALNAME:.*$/gm, '')
    
    // Remove non-standard timezone properties (VTIMEZONE block is the correct way)
    // TIMEZONE-ID and X-WR-TIMEZONE are non-standard and might confuse Gmail
    icsContent = icsContent.replace(/^TIMEZONE-ID:.*$/gm, '')
    icsContent = icsContent.replace(/^X-WR-TIMEZONE:.*$/gm, '')
    
    // Remove empty DESCRIPTION lines (DESCRIPTION: with no value)
    icsContent = icsContent.replace(/^DESCRIPTION:\s*$/gm, '')
    
    // Ensure VTIMEZONE block is present (critical for Gmail)
    // If it's missing, the timezone-aware times won't work
    if (!icsContent.includes('BEGIN:VTIMEZONE')) {
      console.error('WARNING: VTIMEZONE block is missing from ICS file!')
      // This shouldn't happen if getVtimezoneComponent is working
    }
    
    // Fix ORGANIZER format: Remove quotes around CN value (Google Calendar doesn't use quotes)
    // Change: ORGANIZER;CN="name":mailto:... to ORGANIZER;CN=name:mailto:...
    icsContent = icsContent.replace(/ORGANIZER;CN="([^"]+)":/g, 'ORGANIZER;CN=$1:')
    
    // Fix ATTENDEE format: Remove quotes around CN value (Google Calendar doesn't use quotes)
    // Change: CN="name":MAILTO:... to CN=name:MAILTO:...
    icsContent = icsContent.replace(/CN="([^"]+)":MAILTO:/g, 'CN=$1:MAILTO:')
    
    // Ensure CALSCALE:GREGORIAN is present (Gmail-friendly)
    if (!icsContent.includes('CALSCALE:GREGORIAN')) {
      icsContent = icsContent.replace(
        /(VERSION:2\.0)/,
        '$1\r\nCALSCALE:GREGORIAN'
      )
    }
    
    // Ensure CRLF line endings
    if (!icsContent.includes('\r\n')) {
      icsContent = icsContent.replace(/\n/g, '\r\n')
    }
    
    // Remove any double line breaks caused by removing properties
    icsContent = icsContent.replace(/\r\n\r\n\r\n/g, '\r\n\r\n')
    
    // Add TRANSP:OPAQUE property (like Google Calendar) if not present
    // This indicates the event blocks time (vs TRANSPARENT for free time)
    // Insert it before END:VEVENT
    if (!icsContent.includes('TRANSP:')) {
      icsContent = icsContent.replace(
        /(STATUS:CONFIRMED\r\n)/,
        '$1TRANSP:OPAQUE\r\n'
      )
    }
    
    // Completely unfold all lines first (handle any existing folding)
    // ICS spec: continuation lines start with space or tab
    const allLines = icsContent.split(/\r\n/)
    const unfolded: string[] = []
    let currentUnfolded = ''
    
    for (let i = 0; i < allLines.length; i++) {
      const line = allLines[i]
      
      // Check if this is a continuation line (starts with space or tab)
      if ((line.startsWith(' ') || line.startsWith('\t')) && currentUnfolded) {
        // Continuation line - append without leading whitespace
        currentUnfolded += line.substring(1) // Remove first space/tab
      } else {
        // New logical line - save previous and start new
        if (currentUnfolded) {
          unfolded.push(currentUnfolded)
        }
        currentUnfolded = line
      }
    }
    // Don't forget the last line
    if (currentUnfolded) {
      unfolded.push(currentUnfolded)
    }
    
    // Now properly fold lines >75 characters according to RFC 5545
    // Break at safe points (after semicolons, colons, or commas when possible)
    // NEVER break right after = sign (would split property values)
    const properlyFolded: string[] = []
    
    for (const line of unfolded) {
      if (line.length <= 75) {
        properlyFolded.push(line)
      } else {
        // Fold long lines - try to break at safe points first
        let remaining = line
        while (remaining.length > 0) {
          if (remaining.length <= 75) {
            properlyFolded.push(remaining)
            break
          }
          
          // Try to find a safe break point (semicolon, colon, or comma) before position 75
          // Avoid breaking right after = sign (would split property values like RSVP=TRUE)
          let breakPoint = 75
          
          // Search backwards from position 74 to find the last safe break point
          // Look for semicolons, colons, or commas (but not right after =)
          for (let i = 74; i >= 55; i--) {
            // Don't break right after = (would split property values like RSVP=TRUE)
            if (remaining[i] === '=') {
              continue // Skip this position, keep searching backwards
            }
            // Found a safe break point
            if (remaining[i] === ';' || remaining[i] === ':' || remaining[i] === ',') {
              breakPoint = i + 1
              break
            }
          }
          
          // Double-check: make sure we're not breaking right after =
          // If we are, move back to the previous semicolon or break earlier
          if (remaining[breakPoint - 1] === '=') {
            // Search backwards for the previous semicolon
            for (let i = breakPoint - 2; i >= 55; i--) {
              if (remaining[i] === ';') {
                breakPoint = i + 1
                break
              }
            }
            // If no semicolon found, break earlier to avoid splitting after =
            if (remaining[breakPoint - 1] === '=') {
              breakPoint = Math.max(55, breakPoint - 5) // Move back a bit
            }
          }
          
          // Break at the chosen point
          properlyFolded.push(remaining.substring(0, breakPoint))
          remaining = ' ' + remaining.substring(breakPoint) // Space for continuation
        }
      }
    }
    
    icsContent = properlyFolded.join('\r\n')
    
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
    for (let i = 0; i < uniqueVoters.length; i++) {
      const voter = uniqueVoters[i]
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
        
        emailResults.push({ email: voter.participant_email, success: true })
      } catch (emailErr: any) {
        console.error(`Failed to send email to ${voter.participant_email}:`, emailErr)
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

