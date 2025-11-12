// Test script that simulates the exact production flow
const ical = require('ical-generator').default || require('ical-generator')
const { ICalCalendarMethod, ICalAttendeeStatus, ICalEventStatus, ICalEventBusyStatus } = require('ical-generator')
const { getVtimezoneComponent } = require('@touch4it/ical-timezones')

// Simulate production: create calendar with timezone generator
const validTimezone = 'America/Los_Angeles'

let calendar
try {
  calendar = ical({ 
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
} catch (error) {
  console.error('Error creating calendar:', error)
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

// Create event
const start = new Date('2025-11-15T13:00:00Z')
const end = new Date('2025-11-15T17:00:00Z')

calendar.createEvent({
  start,
  end,
  timezone: validTimezone,
  summary: 'Test Event',
  status: ICalEventStatus.CONFIRMED,
  busystatus: ICalEventBusyStatus.BUSY,
  id: 'test-id@example.com',
  sequence: 0
})

// Generate ICS content (same as production)
let icsContent = calendar.toString()

console.log('=== AFTER ICAL-GENERATOR ===')
console.log('Has VTIMEZONE:', icsContent.includes('BEGIN:VTIMEZONE'))
console.log('Has TIMEZONE-ID:', icsContent.includes('TIMEZONE-ID'))
console.log('Has X-WR-TIMEZONE:', icsContent.includes('X-WR-TIMEZONE'))

// Apply production cleanup (same as route.ts)
icsContent = icsContent.replace(/^NAME:.*$/gm, '')
icsContent = icsContent.replace(/^X-WR-CALNAME:.*$/gm, '')
icsContent = icsContent.replace(/^TIMEZONE-ID:.*$/gm, '')
icsContent = icsContent.replace(/^X-WR-TIMEZONE:.*$/gm, '')

console.log('\n=== AFTER CLEANUP ===')
console.log('Has VTIMEZONE:', icsContent.includes('BEGIN:VTIMEZONE'))
console.log('Has TIMEZONE-ID:', icsContent.includes('TIMEZONE-ID'))
console.log('Has X-WR-TIMEZONE:', icsContent.includes('X-WR-TIMEZONE'))

// Ensure CRLF
if (!icsContent.includes('\r\n')) {
  icsContent = icsContent.replace(/\n/g, '\r\n')
}

// Check and inject VTIMEZONE if missing (same as production)
if (!icsContent.includes('BEGIN:VTIMEZONE')) {
  console.log('\n=== VTIMEZONE MISSING - INJECTING ===')
  try {
    const vtimezoneBlock = getVtimezoneComponent(validTimezone)
    let vtimezoneString = typeof vtimezoneBlock === 'string' 
      ? vtimezoneBlock 
      : vtimezoneBlock.toString()
    vtimezoneString = vtimezoneString.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
    
    if (vtimezoneString && vtimezoneString.includes('BEGIN:VTIMEZONE')) {
      icsContent = icsContent.replace(
        /(METHOD:REQUEST\r\n)/,
        `$1${vtimezoneString}\r\n`
      )
      console.log('Successfully injected VTIMEZONE block')
    }
  } catch (error) {
    console.error('Failed to inject:', error)
  }
}

console.log('\n=== FINAL RESULT ===')
console.log('Has VTIMEZONE:', icsContent.includes('BEGIN:VTIMEZONE'))
console.log('\n=== FIRST 500 CHARS ===')
console.log(icsContent.substring(0, 500))

