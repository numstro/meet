// Test script to generate ICS file and check line folding
const ical = require('ical-generator').default || require('ical-generator')
const { ICalCalendarMethod, ICalAttendeeStatus, ICalAttendeeType, ICalEventStatus, ICalEventBusyStatus } = require('ical-generator')

// Simulate the same setup as the API route
const poll = {
  title: 'Test Event',
  description: 'Test description',
  location: 'Test Location',
  creator_name: 'Test Creator',
  creator_email: 'creator@example.com'
}

const start = new Date('2025-11-15T13:00:00Z')
const end = new Date('2025-11-15T17:00:00Z')
const uniqueVoters = [
  { participant_name: 'Attendee 1', participant_email: 'attendee1@example.com' },
  { participant_name: 'Attendee 2', participant_email: 'attendee2@example.com' }
]

// Create calendar (same as API route)
const calendar = ical({ 
  name: poll.title,
  method: ICalCalendarMethod.REQUEST,
  prodId: {
    company: 'Numstro',
    product: 'Meet',
    language: 'EN'
  }
})

const event = calendar.createEvent({
  start,
  end,
  summary: poll.title,
  description: poll.description || '',
  location: poll.location || '',
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
  id: `test-poll-test-option-${Date.now()}@meet.numstro.com`,
  sequence: 0
})

// Generate .ics file content (same logic as API route)
let icsContent = calendar.toString()

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

if (issues.length === 0) {
  console.log('✓ All validation checks passed')
} else {
  console.log('❌ Issues found:')
  issues.forEach(issue => console.log(`  - ${issue}`))
}

