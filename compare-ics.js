// Compare our ICS output to Google's format
const ical = require('ical-generator').default || require('ical-generator')
const { ICalCalendarMethod, ICalAttendeeStatus, ICalEventStatus, ICalEventBusyStatus } = require('ical-generator')
const { getVtimezoneComponent } = require('@touch4it/ical-timezones')

const validTimezone = 'America/Los_Angeles'

// Generate our ICS (simplified version)
let calendar = ical({ 
  timezone: {
    name: validTimezone,
    generator: getVtimezoneComponent
  },
  method: ICalCalendarMethod.REQUEST,
  prodId: {
    company: 'Numstro',
    product: 'Meet',
    language: 'EN'
  }
})

const start = new Date('2025-11-13T20:30:00Z') // 8:30 PM PST
const end = new Date('2025-11-13T21:30:00Z')   // 9:30 PM PST

calendar.createEvent({
  start,
  end,
  timezone: validTimezone,
  summary: 'test',
  organizer: {
    name: 'Kenny C',
    email: 'kennyjchang@gmail.com'
  },
  attendees: [
    {
      name: 'changkennyj@hotmail.com',
      email: 'changkennyj@hotmail.com',
      rsvp: true,
      status: ICalAttendeeStatus.NEEDSACTION,
      type: 'INDIVIDUAL'
    },
    {
      name: 'Kenny C',
      email: 'kennyjchang@gmail.com',
      rsvp: true,
      status: ICalAttendeeStatus.ACCEPTED,
      type: 'INDIVIDUAL'
    }
  ],
  status: ICalEventStatus.CONFIRMED,
  busystatus: ICalEventBusyStatus.BUSY,
  id: '0he67mdajmoa4bfb1ngd7fmic0@google.com',
  sequence: 0,
  created: new Date('2025-11-12T17:59:17Z'),
  lastModified: new Date('2025-11-12T17:59:18Z')
})

let icsContent = calendar.toString()

// Apply our simplified cleanup
icsContent = icsContent.replace(/^NAME:.*$/gm, '')
icsContent = icsContent.replace(/^TIMEZONE-ID:.*$/gm, '')
icsContent = icsContent.replace(/^X-WR-TIMEZONE:.*$/gm, '')

if (!icsContent.includes('BEGIN:VTIMEZONE')) {
  const vtimezone = getVtimezoneComponent(validTimezone)
  const vtimezoneString = String(vtimezone).replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
  icsContent = icsContent.replace(/(METHOD:REQUEST[\r\n]+)/, `$1${vtimezoneString}\r\n`)
}

icsContent = icsContent.replace(/ORGANIZER;CN="([^"]+)":/g, 'ORGANIZER;CN=$1:')
icsContent = icsContent.replace(/CN="([^"]+)":MAILTO:/g, 'CN=$1:MAILTO:')
icsContent = icsContent.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')

if (!icsContent.includes('CALSCALE:GREGORIAN')) {
  icsContent = icsContent.replace(/(VERSION:2\.0\r\n)/, '$1CALSCALE:GREGORIAN\r\n')
}

if (!icsContent.includes('TRANSP:') && icsContent.includes('STATUS:CONFIRMED')) {
  icsContent = icsContent.replace(/(STATUS:CONFIRMED\r\n)/, '$1TRANSP:OPAQUE\r\n')
}

icsContent = icsContent.replace(/\r\n\r\n\r\n+/g, '\r\n\r\n')

console.log('=== OUR OUTPUT ===')
console.log(icsContent)
console.log('\n=== KEY DIFFERENCES CHECK ===')

// Check for key properties
const checks = {
  'BEGIN:VCALENDAR': icsContent.includes('BEGIN:VCALENDAR'),
  'VERSION:2.0': icsContent.includes('VERSION:2.0'),
  'CALSCALE:GREGORIAN': icsContent.includes('CALSCALE:GREGORIAN'),
  'METHOD:REQUEST': icsContent.includes('METHOD:REQUEST'),
  'BEGIN:VTIMEZONE': icsContent.includes('BEGIN:VTIMEZONE'),
  'DTSTART;TZID=': icsContent.includes('DTSTART;TZID='),
  'DTEND;TZID=': icsContent.includes('DTEND;TZID='),
  'ORGANIZER;CN=': icsContent.includes('ORGANIZER;CN=') && !icsContent.includes('ORGANIZER;CN="'),
  'ATTENDEE': icsContent.includes('ATTENDEE'),
  'STATUS:CONFIRMED': icsContent.includes('STATUS:CONFIRMED'),
  'TRANSP:OPAQUE': icsContent.includes('TRANSP:OPAQUE'),
  'CREATED:': icsContent.includes('CREATED:'),
  'LAST-MODIFIED:': icsContent.includes('LAST-MODIFIED:'),
}

console.log('\nProperty Checks:')
Object.entries(checks).forEach(([prop, present]) => {
  console.log(`  ${present ? '✓' : '✗'} ${prop}`)
})

const missing = Object.entries(checks).filter(([_, present]) => !present).map(([prop]) => prop)
if (missing.length > 0) {
  console.log(`\nMissing: ${missing.join(', ')}`)
} else {
  console.log('\n✓ All key properties present!')
}

