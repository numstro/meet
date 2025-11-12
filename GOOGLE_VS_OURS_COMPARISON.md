# Google Calendar ICS vs Ours - Key Differences

## Google's ICS (invite-8.ics) - What Works

### ✅ Structure
- **VTIMEZONE block**: Full timezone definition with DST rules
- **DTSTART/DTEND**: Uses `DTSTART;TZID=America/Los_Angeles:20251113T203000` (local time with timezone)
- **UID**: Short and simple: `0he67mdajmoa4bfb1ngd7fmic0@google.com` (~40 chars)
- **CREATED**: Timestamp when event was created
- **LAST-MODIFIED**: Timestamp when event was last modified
- **TRANSP:OPAQUE**: Indicates event blocks time (vs TRANSPARENT for free time)
- **VALARM**: Reminder/alarm blocks included

### ⚠️ Interesting Observations
- **RSVP=TRUE is split**: Google itself splits `RSVP=` from `TRUE` across lines (line 30-31)!
  - This proves that splitting RSVP= is technically valid per RFC 5545
  - But Gmail might be more lenient with Google's own ICS files
- **ATTENDEE lines are folded**: Google folds long ATTENDEE lines
- **X- properties**: Google includes non-standard properties like `X-GOOGLE-CONFERENCE`, `X-NUM-GUESTS`, `X-MICROSOFT-CDO-OWNERAPPTID`

### ✅ What Google Does NOT Include
- **No NAME: property** - Confirms this is invalid
- **No X-WR-CALNAME** - Not included in Google's ICS
- **No empty DESCRIPTION** - Always has content

## Our Current ICS - What We're Doing

### ✅ What We're Doing Right
- **METHOD:REQUEST** - ✅ Same as Google
- **CALSCALE:GREGORIAN** - ✅ Same as Google
- **VERSION:2.0** - ✅ Same as Google
- **CRLF line endings** - ✅ Same as Google
- **No NAME: property** - ✅ Now fixed (removed)
- **No X-WR-CALNAME** - ✅ Now fixed (removed)
- **Short UID** - ✅ Now fixed (under 75 chars)

### ⚠️ Key Differences (Potential Issues)

1. **Time Format: UTC vs TZID**
   - **Google**: `DTSTART;TZID=America/Los_Angeles:20251113T203000` (local time with timezone)
   - **Ours**: `DTSTART:20251114T010000Z` (UTC time, no timezone)
   - **Impact**: Both are valid per RFC 5545, but Gmail might prefer timezone-aware times

2. **VTIMEZONE Block**
   - **Google**: Includes full VTIMEZONE definition with DST rules
   - **Ours**: No VTIMEZONE block (using UTC)
   - **Impact**: Gmail might expect VTIMEZONE when using TZID

3. **Missing Properties**
   - **CREATED**: Google includes it, we don't
   - **LAST-MODIFIED**: Google includes it, we don't
   - **TRANSP**: Google includes `TRANSP:OPAQUE`, we don't
   - **Impact**: These are optional, but might help Gmail recognize the event

4. **VALARM Blocks**
   - **Google**: Includes reminder alarms
   - **Ours**: No alarms
   - **Impact**: Optional, shouldn't affect recognition

## Recommendations

### Option 1: Match Google's Format (Recommended)
Switch to timezone-aware times with VTIMEZONE block:
- Use `DTSTART;TZID=America/Los_Angeles:...` format
- Include VTIMEZONE block with DST rules
- Add CREATED and LAST-MODIFIED timestamps
- Add TRANSP:OPAQUE

### Option 2: Keep UTC but Add Missing Properties
- Keep UTC times (simpler)
- Add CREATED timestamp
- Add LAST-MODIFIED timestamp
- Add TRANSP:OPAQUE

### Option 3: Minimal Changes (Current Fixes)
- We've already fixed the critical issues (NAME, UID length, empty DESCRIPTION)
- Test if this is enough for Gmail

## Critical Finding

**Google itself splits `RSVP=TRUE`** across lines in their own ICS files! This means:
- Our line folding logic is correct per RFC 5545
- The issue is likely NOT the RSVP splitting
- The issue is more likely:
  1. The invalid `NAME:` property (now fixed)
  2. The overly long UID (now fixed)
  3. Missing optional properties that Gmail expects
  4. Or something else entirely (email headers, Content-Type, etc.)

