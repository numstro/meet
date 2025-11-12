# ICS File Comparison: Perfect vs Ours

## Perfect ICS Example (Gmail-Compatible)

```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Numstro//Meet//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:unique-id-12345@meet.numstro.com
DTSTAMP:20251112T175218Z
DTSTART:20251114T010000Z
DTEND:20251114T050000Z
SUMMARY:Test 8
DESCRIPTION:Meeting description here
ORGANIZER;CN="kenny":mailto:kennyjchang@gmail.com
ATTENDEE;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="kenny":mailto:kennyjchang@gmail.com
ATTENDEE;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="Coco":mailto:changkennyj@hotmail.com
URL:https://meet.numstro.com/poll/b733ce69-4218-4992-b517-a2f3667e62f1
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

## Our Current ICS (invite-7.ics)

```ics
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN          ← OK (optional but fine)
PRODID:-//Numstro//Meet//EN
METHOD:REQUEST
NAME:Test 8                  ← ❌ PROBLEM: Not a valid ICS property
X-WR-CALNAME:Test 8          ← ⚠️ Non-standard (might confuse Gmail)
BEGIN:VEVENT
UID:b733ce69-4218-4992-b517-a2f3667e62f1-a82e4088-66fb-40bb-8624-b102f1641e
 32-1762969938911@meet.numstro.com  ← ❌ PROBLEM: UID split across lines
SEQUENCE:0
DTSTAMP:20251112T175218Z
DTSTART:20251114T010000Z
DTEND:20251114T050000Z
SUMMARY:Test 8
DESCRIPTION:                ← ⚠️ Empty (should have value or be omitted)
ORGANIZER;CN="kenny":mailto:kennyjchang@gmail.com
ATTENDEE;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;
 RSVP=TRUE;CN="kenny":MAILTO:kennyjchang@gmail.com  ← ✅ Fixed (RSVP not split)
ATTENDEE;ROLE=REQ-PARTICIPANT;CUTYPE=INDIVIDUAL;PARTSTAT=NEEDS-ACTION;
 RSVP=TRUE;CN="Coco":MAILTO:changkennyj@hotmail.com  ← ✅ Fixed
URL;VALUE=URI:https://meet.numstro.com/poll/b733ce69-4218-4992-b517-a2f3667
 e62f1                      ← ❌ PROBLEM: URL split (might be OK per spec, but Gmail might not like it)
STATUS:CONFIRMED
X-MICROSOFT-CDO-BUSYSTATUS:BUSY  ← ⚠️ Non-standard (probably OK)
END:VEVENT
END:VCALENDAR
```

## Key Differences & Issues

### ❌ Critical Issues:

1. **`NAME:Test 8` (line 6)**
   - **Problem**: `NAME` is NOT a valid ICS property at the calendar level
   - **Fix**: Remove this line entirely
   - **Impact**: Gmail might reject the entire file due to invalid property

2. **UID split across lines (lines 9-10)**
   - **Problem**: UID is too long and gets folded, but Gmail might not handle it well
   - **Fix**: Make UID shorter or ensure it doesn't need folding
   - **Impact**: Gmail might not recognize the event as unique

3. **URL split (lines 22-23)**
   - **Problem**: URL is folded, which is technically valid per RFC 5545, but Gmail might be strict
   - **Fix**: Make URL shorter or use a shorter domain
   - **Impact**: Gmail might not be able to parse the URL

### ⚠️ Minor Issues:

4. **Empty DESCRIPTION (line 16)**
   - **Problem**: `DESCRIPTION:` with no value
   - **Fix**: Either omit DESCRIPTION entirely, or provide a value
   - **Impact**: Minor, but cleaner to omit if empty

5. **X-WR-CALNAME (line 7)**
   - **Problem**: Non-standard property (used by some clients but not required)
   - **Fix**: Can remove it, or keep it (probably fine)
   - **Impact**: Low, but removing might help Gmail compatibility

## Recommended Fixes

1. **Remove `NAME` property** - This is invalid and likely causing Gmail to reject the file
2. **Shorten UID** - Make it under 75 characters so it doesn't need folding
3. **Shorten URL or use shorter domain** - Or ensure URL folding is perfect
4. **Omit empty DESCRIPTION** - Don't include `DESCRIPTION:` if there's no value
5. **Consider removing X-WR-CALNAME** - Keep it simple for Gmail

## What We're Doing Right

✅ CRLF line endings
✅ Proper line folding for ATTENDEE (RSVP=TRUE not split)
✅ METHOD:REQUEST at calendar level
✅ All required properties present (UID, DTSTAMP, DTSTART, DTEND, SUMMARY)
✅ UTC times (no timezone issues)
✅ CALSCALE:GREGORIAN (optional but good)

