// Test script to generate ICS file and check line folding
const ical = require('ical-generator').default || require('ical-generator')
const { ICalCalendarMethod, ICalAttendeeStatus, ICalAttendeeType, ICalEventStatus, ICalEventBusyStatus } = require('ical-generator')
const { getVtimezoneComponent } = require('@touch4it/ical-timezones')

// Simulate the same setup as the API route
const poll = {
  title: 'Test Event',
  description: 'Test description',
  location: 'Test Location',
  creator_name: 'Test Creator',
  creator_email: 'creator@example.com'
}

// Create dates in timezone (matching the new approach)
// For test, use America/Los_Angeles timezone
const testTimezone = 'America/Los_Angeles'
const createLocalDate = (dateStr, hour, min) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dateStrISO = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
  let candidateUTC = new Date(dateStrISO + 'Z')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: testTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  for (let attempts = 0; attempts < 3; attempts++) {
    const parts = formatter.formatToParts(candidateUTC)
    const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
    const tzMin = parseInt(parts.find(p => p.type === 'minute')?.value || '0')
    if (tzHour === hour && tzMin === min) {
      return candidateUTC
    }
    const desiredMinutes = hour * 60 + min
    const actualMinutes = tzHour * 60 + tzMin
    const offsetMinutes = desiredMinutes - actualMinutes
    candidateUTC = new Date(candidateUTC.getTime() + (offsetMinutes * 60 * 1000))
  }
  return candidateUTC
}

const start = createLocalDate('2025-11-15', 13, 0) // 1 PM PST
const end = createLocalDate('2025-11-15', 17, 0) // 5 PM PST
const uniqueVoters = [
  { participant_name: 'Attendee 1', participant_email: 'attendee1@example.com' },
  { participant_name: 'Attendee 2', participant_email: 'attendee2@example.com' }
]

// Create calendar (same as API route) - NO 'name' property (invalid ICS property)
// Use timezone-aware times (matching Google Calendar's format)
const calendar = ical({ 
  timezone: {
    name: testTimezone,
    generator: getVtimezoneComponent // Generate VTIMEZONE blocks
  },
  method: ICalCalendarMethod.REQUEST,
  prodId: {
    company: 'Numstro',
    product: 'Meet',
    language: 'EN'
  }
})

// Generate shorter UID (same logic as API route)
const pollId = 'test-poll-id-12345'
const optionId = 'test-option-id-67890'
const shortPollId = pollId.substring(0, 8)
const shortOptionId = optionId.substring(0, 8)
const timestamp = Date.now().toString().slice(-10)
const shortHostname = 'meet.numstro.com'.substring(0, 20)
const eventUid = `${shortPollId}-${shortOptionId}-${timestamp}@${shortHostname}`

// Build event data (only include description if it has a value)
const eventData = {
  start,
  end,
  timezone: testTimezone, // Specify timezone for this event
  summary: poll.title,
  location: poll.location || undefined,
  url: 'https://meet.numstro.com/poll/test-id',
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
  id: eventUid,
  sequence: 0
}

// Only include description if it has a value
if (poll.description && poll.description.trim().length > 0) {
  eventData.description = poll.description
}

const event = calendar.createEvent(eventData)

// Generate .ics file content (same logic as API route)
let icsContent = calendar.toString()

// Remove invalid properties that ical-generator might add
// NAME: is NOT a valid ICS property and causes Gmail to reject the file
icsContent = icsContent.replace(/^NAME:.*$/gm, '')
// X-WR-CALNAME is non-standard and might confuse Gmail
icsContent = icsContent.replace(/^X-WR-CALNAME:.*$/gm, '')

// Remove empty DESCRIPTION lines (DESCRIPTION: with no value)
icsContent = icsContent.replace(/^DESCRIPTION:\s*$/gm, '')

// Fix ORGANIZER format: Remove quotes around CN value (Google Calendar doesn't use quotes)
icsContent = icsContent.replace(/ORGANIZER;CN="([^"]+)":/g, 'ORGANIZER;CN=$1:')

// Fix ATTENDEE format: Remove quotes around CN value (Google Calendar doesn't use quotes)
icsContent = icsContent.replace(/CN="([^"]+)":MAILTO:/g, 'CN=$1:MAILTO:')

// Ensure CALSCALE:GREGORIAN is present
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

// Completely unfold all lines first
const allLines = icsContent.split(/\r\n/)
const unfolded = []
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

// Now properly fold lines >75 characters
const properlyFolded = []

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

// Output the result
console.log('=== ORIGINAL FROM ICAL-GENERATOR ===')
console.log(calendar.toString().substring(0, 500))
console.log('\n=== UNFOLDED LINES ===')
unfolded.forEach((line, idx) => {
  if (line.includes('RSVP') || line.includes('ATTENDEE')) {
    console.log(`Line ${idx + 1}: ${line.length} chars - ${line.substring(0, 100)}`)
  }
})
console.log('\n=== FINAL GENERATED ICS FILE ===')
console.log(icsContent)
console.log('\n=== LINE LENGTH ANALYSIS ===')
const lines = icsContent.split(/\r\n/)
lines.forEach((line, idx) => {
  const length = line.length
  const isContinuation = line.startsWith(' ') || line.startsWith('\t')
  const status = length > 75 ? '❌ TOO LONG' : isContinuation ? '✓ continuation' : '✓ OK'
  console.log(`Line ${idx + 1}: ${length} chars ${status}${length > 75 ? ` (${length - 75} over)` : ''}`)
  if (length > 75) {
    console.log(`  Content: ${line.substring(0, 100)}...`)
  }
})

// Check for common issues
console.log('\n=== VALIDATION CHECKS ===')
const issues = []
if (!icsContent.includes('METHOD:REQUEST')) issues.push('Missing METHOD:REQUEST')
if (!icsContent.includes('CALSCALE:GREGORIAN')) issues.push('Missing CALSCALE:GREGORIAN')
if (icsContent.includes('RSVP=\r\n')) issues.push('RSVP= is split from value')
if (icsContent.includes('RSVP=\n')) issues.push('RSVP= is split from value (LF)')
if (icsContent.includes('NAME:')) issues.push('Invalid NAME: property found (should be removed)')
if (icsContent.includes('X-WR-CALNAME:')) issues.push('Non-standard X-WR-CALNAME found (should be removed)')
if (icsContent.includes('DESCRIPTION:\r\n') && !icsContent.match(/DESCRIPTION:[^\r\n]/)) {
  issues.push('Empty DESCRIPTION: found (should be removed)')
}

// Check UID length
const uidMatch = icsContent.match(/^UID:([^\r\n]+)/m)
if (uidMatch) {
  const uid = uidMatch[1]
  if (uid.length > 75) {
    issues.push(`UID is too long (${uid.length} chars, should be <= 75)`)
  }
}

if (issues.length === 0) {
  console.log('✓ All validation checks passed')
} else {
  console.log('❌ Issues found:')
  issues.forEach(issue => console.log(`  - ${issue}`))
}

