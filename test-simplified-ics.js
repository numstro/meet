// Test script to generate ICS using our simplified setup
// Compare output to Google Calendar's format

const ical = require('ical-generator').default || require('ical-generator')
const { 
  ICalCalendarMethod, 
  ICalAttendeeStatus, 
  ICalAttendeeType,
  ICalEventStatus,
  ICalEventBusyStatus
} = require('ical-generator')
const fs = require('fs')

// Simulate the same data we'd use in production
const testData = {
  pollId: 'test-poll-123',
  optionId: 'test-option-456',
  poll: {
    title: 'Team Meeting',
    description: 'Weekly team sync',
    location: 'Conference Room A',
    creator_name: 'John Doe',
    creator_email: 'john@example.com'
  },
  start: new Date('2025-01-15T13:00:00'), // 1 PM
  end: new Date('2025-01-15T17:00:00'), // 5 PM
  timezone: 'America/Los_Angeles',
  voters: [
    { participant_name: 'Alice Smith', participant_email: 'alice@example.com' },
    { participant_name: 'Bob Jones', participant_email: 'bob@example.com' }
  ]
}

// Create calendar - EXACTLY as we do in production now
const calendar = ical({
  timezone: testData.timezone,
  method: ICalCalendarMethod.REQUEST,
  prodId: {
    company: 'Numstro',
    product: 'Meet',
    language: 'EN'
  }
})

// Create event - EXACTLY as we do in production now
const eventData = {
  start: testData.start,
  end: testData.end,
  timezone: testData.timezone,
  summary: testData.poll.title,
  location: testData.poll.location,
  url: 'https://numstro.com/poll/test-poll-123',
  organizer: {
    name: testData.poll.creator_name,
    email: testData.poll.creator_email
  },
  attendees: testData.voters.map(v => ({
    name: v.participant_name,
    email: v.participant_email,
    rsvp: true,
    status: ICalAttendeeStatus.NEEDSACTION,
    type: ICalAttendeeType.INDIVIDUAL
  })),
  status: ICalEventStatus.CONFIRMED,
  busystatus: ICalEventBusyStatus.BUSY
}

if (testData.poll.description) {
  eventData.description = testData.poll.description
}

calendar.createEvent(eventData)

// Generate ICS content - EXACTLY as we do in production now
let icsContent = calendar.toString()

// Apply the same fixes we do in production:
// 1. Remove non-standard properties (Google doesn't use these)
icsContent = icsContent.replace(/^TIMEZONE-ID:.*$/gm, '')
icsContent = icsContent.replace(/^X-WR-TIMEZONE:.*$/gm, '')

// 2. Remove quotes from ORGANIZER/ATTENDEE CN values (Google doesn't use quotes)
icsContent = icsContent.replace(/ORGANIZER;CN="([^"]+)":/g, 'ORGANIZER;CN=$1:')
icsContent = icsContent.replace(/CN="([^"]+)":MAILTO:/g, 'CN=$1:MAILTO:')

// 3. Add VTIMEZONE block if missing (critical for Gmail when using TZID)
if (!icsContent.includes('BEGIN:VTIMEZONE')) {
  const generateVTIMEZONE = (tzid) => {
    const timezones = {
      'America/Los_Angeles': `BEGIN:VTIMEZONE\r
TZID:America/Los_Angeles\r
X-LIC-LOCATION:America/Los_Angeles\r
BEGIN:DAYLIGHT\r
TZOFFSETFROM:-0800\r
TZOFFSETTO:-0700\r
TZNAME:PDT\r
DTSTART:19700308T020000\r
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r
END:DAYLIGHT\r
BEGIN:STANDARD\r
TZOFFSETFROM:-0700\r
TZOFFSETTO:-0800\r
TZNAME:PST\r
DTSTART:19701101T020000\r
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r
END:STANDARD\r
END:VTIMEZONE`,
      'America/New_York': `BEGIN:VTIMEZONE\r
TZID:America/New_York\r
X-LIC-LOCATION:America/New_York\r
BEGIN:DAYLIGHT\r
TZOFFSETFROM:-0500\r
TZOFFSETTO:-0400\r
TZNAME:EDT\r
DTSTART:19700308T020000\r
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r
END:DAYLIGHT\r
BEGIN:STANDARD\r
TZOFFSETFROM:-0400\r
TZOFFSETTO:-0500\r
TZNAME:EST\r
DTSTART:19701101T020000\r
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r
END:STANDARD\r
END:VTIMEZONE`,
      'America/Chicago': `BEGIN:VTIMEZONE\r
TZID:America/Chicago\r
X-LIC-LOCATION:America/Chicago\r
BEGIN:DAYLIGHT\r
TZOFFSETFROM:-0600\r
TZOFFSETTO:-0500\r
TZNAME:CDT\r
DTSTART:19700308T020000\r
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r
END:DAYLIGHT\r
BEGIN:STANDARD\r
TZOFFSETFROM:-0500\r
TZOFFSETTO:-0600\r
TZNAME:CST\r
DTSTART:19701101T020000\r
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r
END:STANDARD\r
END:VTIMEZONE`,
      'America/Denver': `BEGIN:VTIMEZONE\r
TZID:America/Denver\r
X-LIC-LOCATION:America/Denver\r
BEGIN:DAYLIGHT\r
TZOFFSETFROM:-0700\r
TZOFFSETTO:-0600\r
TZNAME:MDT\r
DTSTART:19700308T020000\r
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r
END:DAYLIGHT\r
BEGIN:STANDARD\r
TZOFFSETFROM:-0600\r
TZOFFSETTO:-0700\r
TZNAME:MST\r
DTSTART:19701101T020000\r
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r
END:STANDARD\r
END:VTIMEZONE`,
    }
    
    if (timezones[tzid]) {
      return timezones[tzid]
    }
    
    throw new Error(`VTIMEZONE not available for timezone: ${tzid}`)
  }
  
  try {
    const vtimezoneString = generateVTIMEZONE(testData.timezone)
    icsContent = icsContent.replace(/(METHOD:REQUEST[\r\n]+)/, `$1${vtimezoneString}\r\n`)
  } catch (error) {
    console.error('Failed to add VTIMEZONE:', error.message)
  }
}

// 4. Add optional properties that Google includes
const now = new Date()
const nowStr = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

// Add CREATED if missing
if (!icsContent.includes('CREATED:')) {
  icsContent = icsContent.replace(/(DTSTAMP:[^\r\n]+\r\n)/, `$1CREATED:${nowStr}\r\n`)
}

// Add LAST-MODIFIED if missing
if (!icsContent.includes('LAST-MODIFIED:')) {
  icsContent = icsContent.replace(/(CREATED:[^\r\n]+\r\n)/, `$1LAST-MODIFIED:${nowStr}\r\n`)
}

// Add TRANSP:OPAQUE if missing
if (!icsContent.includes('TRANSP:')) {
  icsContent = icsContent.replace(/(STATUS:CONFIRMED\r\n)/, `$1TRANSP:OPAQUE\r\n`)
}

// Clean up any extra blank lines
icsContent = icsContent.replace(/\r\n\r\n\r\n+/g, '\r\n\r\n')

// Write to file
fs.writeFileSync('our-generated-ics.ics', icsContent)

console.log('✅ Generated ICS file: our-generated-ics.ics')
console.log('\n=== ICS Content ===\n')
console.log(icsContent)
console.log('\n=== End of ICS Content ===\n')

// Basic validation
console.log('=== Validation ===')
console.log('Has BEGIN:VCALENDAR:', icsContent.includes('BEGIN:VCALENDAR'))
console.log('Has BEGIN:VEVENT:', icsContent.includes('BEGIN:VEVENT'))
console.log('Has METHOD:REQUEST:', icsContent.includes('METHOD:REQUEST'))
console.log('Has BEGIN:VTIMEZONE:', icsContent.includes('BEGIN:VTIMEZONE'))
console.log('Has ORGANIZER:', icsContent.includes('ORGANIZER'))
console.log('Has ATTENDEE:', icsContent.includes('ATTENDEE'))
console.log('Has DTSTART:', icsContent.includes('DTSTART'))
console.log('Has DTEND:', icsContent.includes('DTEND'))
console.log('Has SUMMARY:', icsContent.includes('SUMMARY'))
console.log('Has UID:', icsContent.includes('UID:'))

// Check for potential issues
console.log('\n=== Potential Issues ===')
if (icsContent.includes('NAME:')) {
  console.log('⚠️  WARNING: Contains NAME: property (invalid)')
}
if (!icsContent.includes('BEGIN:VTIMEZONE')) {
  console.log('⚠️  WARNING: Missing VTIMEZONE block')
}
if (icsContent.includes('TIMEZONE-ID:')) {
  console.log('⚠️  WARNING: Contains TIMEZONE-ID (non-standard)')
}
if (icsContent.includes('X-WR-TIMEZONE:')) {
  console.log('⚠️  WARNING: Contains X-WR-TIMEZONE (non-standard)')
}

console.log('\n✅ Done! Compare our-generated-ics.ics with Google Calendar ICS file')

