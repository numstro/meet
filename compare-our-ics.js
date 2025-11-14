// Compare our generated ICS to what Google Calendar generates
const fs = require('fs')

// Read our generated ICS
const ourICS = fs.readFileSync('our-generated-ics.ics', 'utf-8')

console.log('=== OUR ICS FILE ===\n')
console.log(ourICS)
console.log('\n=== KEY DIFFERENCES FROM GOOGLE CALENDAR ===\n')

// Check for critical differences
const issues = []

// 1. VTIMEZONE block
if (!ourICS.includes('BEGIN:VTIMEZONE')) {
  issues.push('❌ MISSING: VTIMEZONE block (Google includes this)')
} else {
  console.log('✅ Has VTIMEZONE block')
}

// 2. Non-standard properties
if (ourICS.includes('TIMEZONE-ID:')) {
  issues.push('❌ HAS: TIMEZONE-ID (non-standard, Google does NOT use this)')
}
if (ourICS.includes('X-WR-TIMEZONE:')) {
  issues.push('❌ HAS: X-WR-TIMEZONE (non-standard, Google does NOT use this)')
}

// 3. ORGANIZER format
if (ourICS.includes('ORGANIZER;CN="')) {
  issues.push('❌ ORGANIZER has quotes around CN value (Google uses: ORGANIZER;CN=Name:mailto:...)')
} else if (ourICS.includes('ORGANIZER;CN=')) {
  console.log('✅ ORGANIZER format looks correct (no quotes)')
}

// 4. ATTENDEE format
if (ourICS.includes('CN="')) {
  issues.push('❌ ATTENDEE has quotes around CN value (Google uses: CN=Name:MAILTO:...)')
} else if (ourICS.includes('CN=')) {
  console.log('✅ ATTENDEE format looks correct (no quotes)')
}

// 5. Missing properties that Google includes
if (!ourICS.includes('CREATED:')) {
  issues.push('⚠️  MISSING: CREATED timestamp (Google includes this)')
}
if (!ourICS.includes('LAST-MODIFIED:')) {
  issues.push('⚠️  MISSING: LAST-MODIFIED timestamp (Google includes this)')
}
if (!ourICS.includes('TRANSP:')) {
  issues.push('⚠️  MISSING: TRANSP property (Google uses TRANSP:OPAQUE)')
}

// 6. DTSTART/DTEND format
if (ourICS.includes('DTSTART;TZID=')) {
  console.log('✅ DTSTART uses TZID format (matches Google)')
} else if (ourICS.includes('DTSTART:')) {
  issues.push('⚠️  DTSTART uses UTC format (Google uses TZID format)')
}

// 7. RSVP splitting
if (ourICS.includes('RSVP\n =TRUE') || ourICS.includes('RSVP\r\n =TRUE')) {
  console.log('✅ RSVP=TRUE is properly folded (Google does this too)')
} else if (ourICS.includes('RSVP=TRUE')) {
  console.log('✅ RSVP=TRUE is on one line (also valid)')
}

console.log('\n=== SUMMARY OF ISSUES ===\n')
if (issues.length === 0) {
  console.log('✅ No critical issues found!')
} else {
  issues.forEach(issue => console.log(issue))
}

console.log('\n=== RECOMMENDATIONS ===\n')
console.log('1. Remove TIMEZONE-ID and X-WR-TIMEZONE (non-standard)')
console.log('2. Add VTIMEZONE block (critical for Gmail)')
console.log('3. Remove quotes from ORGANIZER/ATTENDEE CN values')
console.log('4. Add CREATED and LAST-MODIFIED timestamps (optional but helpful)')
console.log('5. Add TRANSP:OPAQUE (optional but helpful)')



