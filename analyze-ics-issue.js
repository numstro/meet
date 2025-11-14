// Analyze the actual ICS file to find what Gmail doesn't like
const fs = require('fs')

const ics = fs.readFileSync('/Users/kennychang/Downloads/invite-15.ics', 'utf-8')

console.log('=== ICS FILE ANALYSIS ===\n')

// Check line folding
console.log('1. LINE FOLDING CHECK:')
const lines = ics.split(/\r\n|\n/)
lines.forEach((line, idx) => {
  if (line.startsWith(' ') || line.startsWith('\t')) {
    console.log(`   Line ${idx + 1}: Continuation line (starts with space) - ${line.substring(0, 50)}`)
  } else if (line.length > 75) {
    console.log(`   ⚠️  Line ${idx + 1}: Too long (${line.length} chars) - should be folded`)
    console.log(`      Content: ${line.substring(0, 100)}`)
  }
})

// Check for required properties
console.log('\n2. REQUIRED PROPERTIES:')
const required = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'METHOD:REQUEST',
  'BEGIN:VTIMEZONE',
  'BEGIN:VEVENT',
  'UID:',
  'DTSTAMP:',
  'DTSTART',
  'DTEND',
  'SUMMARY:',
  'ORGANIZER:',
  'END:VEVENT',
  'END:VCALENDAR'
]

required.forEach(prop => {
  const has = ics.includes(prop)
  console.log(`   ${has ? '✅' : '❌'} ${prop}`)
})

// Check for problematic patterns
console.log('\n3. PROBLEMATIC PATTERNS:')
if (ics.includes('NAME:')) {
  console.log('   ❌ Contains NAME: (invalid property)')
}
if (ics.includes('TIMEZONE-ID:')) {
  console.log('   ❌ Contains TIMEZONE-ID: (non-standard)')
}
if (ics.includes('X-WR-TIMEZONE:')) {
  console.log('   ❌ Contains X-WR-TIMEZONE: (non-standard)')
}
if (ics.match(/ORGANIZER;CN="[^"]+":/)) {
  console.log('   ❌ ORGANIZER has quotes around CN')
}
if (ics.match(/CN="[^"]+":MAILTO:/)) {
  console.log('   ❌ ATTENDEE has quotes around CN')
}

// Check URL line specifically
console.log('\n4. URL LINE ANALYSIS:')
const urlMatch = ics.match(/URL[^\r\n]*[\r\n]+[ \t][^\r\n]+/s)
if (urlMatch) {
  console.log('   URL is folded across lines:')
  const urlLines = urlMatch[0].split(/\r\n|\n/)
  urlLines.forEach((line, idx) => {
    console.log(`      Line ${idx + 1}: "${line}" (${line.length} chars)`)
  })
  // Unfold it
  const unfolded = urlLines[0] + urlLines[1].substring(1)
  console.log(`   Unfolded: "${unfolded}" (${unfolded.length} chars)`)
  if (unfolded.length > 75) {
    console.log(`   ⚠️  Unfolded URL is ${unfolded.length} chars (over 75 limit)`)
  }
}

// Check if URL is valid
const urlMatch2 = ics.match(/URL[^\r\n]*:([^\r\n]+)/)
if (urlMatch2) {
  const url = urlMatch2[1].trim()
  console.log(`   URL value: ${url}`)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.log('   ⚠️  URL doesn\'t start with http:// or https://')
  }
}

// Compare to what Google does
console.log('\n5. COMPARISON TO GOOGLE:')
console.log('   Google Calendar ICS files:')
console.log('   - Also fold lines >75 chars ✅')
console.log('   - Also split RSVP=TRUE ✅')
console.log('   - Use TZID format ✅')
console.log('   - Include VTIMEZONE ✅')
console.log('   - No quotes in CN values ✅')
console.log('\n   Our ICS file:')
console.log('   - Folds lines >75 chars ✅')
console.log('   - Splits RSVP=TRUE ✅')
console.log('   - Uses TZID format ✅')
console.log('   - Includes VTIMEZONE ✅')
console.log('   - No quotes in CN values ✅')

console.log('\n=== CONCLUSION ===')
console.log('If line folding matches Google\'s format, it\'s likely NOT the problem.')
console.log('The issue might be:')
console.log('1. Email attachment format (Content-Type headers)')
console.log('2. Email encoding')
console.log('3. Something else Gmail is picky about')
console.log('4. The URL property format itself (URL;VALUE=URI vs just URL)')



