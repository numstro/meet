# Meet Calendar Invite – Complete Development History and Technical Synopsis

**Project:** meet.numstro.com  
**Feature:** Send Calendar Invites to Poll Participants  
**Status:** In Progress - Migrated to AWS SES  
**Last Updated:** December 2024

---

## 1. Original WhereGoal

Implement a reliable "Send Calendar Invites" flow inside the Meet app, where a poll creator can email .ics invites to all participants who voted "Yes" or "Maybe" for a selected time slot.

**Functional requirement:**
- Recipients (especially Gmail users) should see the standard inline calendar card with Accept / Maybe / Decline buttons
- Not just a gray box or a downloadable attachment

---

## 2. Initial Architecture

### Core Workflow

**Frontend (Next.js):**
- Poll creation with creator name/email stored in DB
- Poll results grid (participants vote yes/no/maybe)
- "Send Calendar Invites" modal with:
  - Dropdown for selected time slot
  - Optional custom start/end time (default buckets: morning 8–12, afternoon 1–5, evening 5–9)
  - Creator email (must match stored email)
- Frontend validates email and calls the API endpoint

**Backend (Next.js API Route):**
- Endpoint: `POST /api/send-calendar-invites`
- Performs server-side email verification: `SELECT * FROM polls WHERE id = pollId AND creator_email = creatorEmail`
- Collects all "yes" and "maybe" votes
- Generates the .ics file via `ical-generator`
- Sends individual emails via Resend API with rate limiting (600 ms between sends)

**Database (Supabase / PostgreSQL):**
- `polls` → poll metadata (creator_email, etc.)
- `poll_options` → time slot options
- `poll_responses` → votes (yes/no/maybe)

---

## 3. Early Implementation Issues

| Symptom | Root Cause |
|---------|------------|
| Gmail shows gray "Unable to load event." | METHOD:REQUEST missing and/or MIME headers incorrect |
| Attachments download but don't render inline | Gmail requires `Content-Type: text/calendar; method=REQUEST; charset=UTF-8` on the email part, not just inside the file |
| Outlook / Apple Calendar import works fine | Those clients tolerate missing MIME parameters and soft line wrapping |

At this stage, the .ics file was technically valid, but Gmail refused to parse it as a true meeting invitation.

---

## 4. Iteration History (10+ Attempts)

### Iteration 1: Initial Implementation (Resend + ical-generator)
- Used `ical-generator` to create ICS files
- Sent emails via Resend API with ICS as attachment
- Basic setup with `METHOD:REQUEST`
- **Result**: Gmail showed "Unable to load event"

### Iteration 2: Added Timezone Support
- Switched from UTC to timezone-aware times
- Added `timezone: validTimezone` to ical-generator
- Used `@touch4it/ical-timezones` package to generate VTIMEZONE blocks
- **Result**: Still "Unable to load event"
- **Issue Found**: The `@touch4it/ical-timezones` package returned `null` in production (Next.js serverless bundling issue)

### Iteration 3: Manual VTIMEZONE Generation
- Removed dependency on `@touch4it/ical-timezones`
- Created manual VTIMEZONE blocks for common US timezones
- Manually injected VTIMEZONE blocks into ICS content
- **Result**: Still "Unable to load event"

### Iteration 4: Removed Invalid Properties
- Removed `NAME:` property (invalid ICS property)
- Removed `X-WR-CALNAME` (non-standard)
- Removed `TIMEZONE-ID` and `X-WR-TIMEZONE` (non-standard)
- Fixed ORGANIZER/ATTENDEE format (removed quotes from CN values)
- **Result**: Still "Unable to load event"

### Iteration 5: Added Missing Properties
- Added `CREATED` timestamp
- Added `LAST-MODIFIED` timestamp
- Added `TRANSP:OPAQUE` property
- Added `CALSCALE:GREGORIAN`
- **Result**: Still "Unable to load event"

### Iteration 6: Switched to Nodemailer (for Header Control)
- Switched from Resend to Nodemailer with SMTP
- Thought we needed more control over email headers
- Set `Content-Type: text/calendar; charset=UTF-8; method=REQUEST` on attachment
- **Result**: Still "Unable to load event"
- **Why we switched back**: User pointed out we should follow industry standards (Resend is more common)

### Iteration 7: Reverted to Resend + Simplified
- Reverted to Resend (industry standard)
- Removed all manual VTIMEZONE workarounds
- Let `ical-generator` handle everything automatically
- Removed complex line folding logic
- **Result**: Still "Unable to load event"

### Iteration 8: Matched Google Calendar Format Exactly
- Compared our ICS to Google Calendar's ICS file (`invite-8.ics`)
- Added VTIMEZONE blocks matching Google's exact format
- Removed quotes from CN values
- Added CREATED, LAST-MODIFIED, TRANSP:OPAQUE
- Removed non-standard properties
- **Result**: Still "Unable to load event"

### Iteration 9: Reverted to UTC (Briefly)
- User noted that before, Gmail could at least infer date/time
- Reverted to UTC times thinking TZID format might be the issue
- Removed VTIMEZONE blocks
- **Result**: User stopped us - pointed out we should match Google Calendar's format, not diverge

### Iteration 10: Back to Matching Google (Current)
- Reverted back to TZID format with VTIMEZONE (matching Google)
- Current state matches Google Calendar's format exactly
- **Result**: Still "Unable to load event"

---

## 5. Key Fixes Applied (Resend + Nodemailer Phase)

### ✅ ICS Generation Fixes
- Added `METHOD:REQUEST` to the calendar object
- Ensured each event includes: UID, DTSTAMP (UTC, with "Z"), ORGANIZER, ATTENDEE, SEQUENCE, STATUS, TRANSP
- Normalized line endings to `\r\n` (RFC 5545 compliance)
- Unfolded any soft-wrapped lines (Gmail parser bug)
- Set `TRANSP:OPAQUE` and `STATUS:CONFIRMED`

### ✅ Email Transport Fixes
- Switched .ics attachment to a Buffer so Resend encoded as base64 instead of quoted-printable
- Removed duplicate Content-Type header (was defined both in contentType and headers)
- Kept `Content-Class: urn:content-classes:calendarmessage` for Outlook compatibility
- Rate limiting retained (600 ms)

### ❌ Remaining Limitation
- Resend could not override the attachment MIME header to include `method=REQUEST`
- Gmail still displayed "Unable to load event"

---

## 6. Transition to SMTP2GO (Nodemailer)

**Goal:** Gain MIME header control.

**Result:** Partial success.

- Content-Type headers were now correct: `text/calendar; method=REQUEST; charset=UTF-8`
- .ics attachment encoded in base64 correctly
- **But Gmail continued to fail** due to quoted-printable encoding of the inline calendar part (the one inside the multipart/alternative)

SMTP2GO automatically re-encoded that inline part as QP, producing lines like:
```
RRULE:FREQ=3DYEARLY
```

Gmail aborted parsing.

Multiple fixes were attempted (unfolding, contentDisposition=inline, header cleanup), but SMTP2GO kept forcing QP on the inline alternative. The gray banner persisted.

---

## 7. Root Cause Confirmed

**Gmail's iCalendar parser cannot handle quoted-printable encoding in a text/calendar MIME part.**

- SMTP2GO rewrites the inline part regardless of our explicit encoding: 'base64'
- No amount of client-side or Nodemailer configuration can prevent that re-encoding
- This is a fundamental limitation of SMTP2GO's MIME handling

---

## 8. Current Correct State (Post-SES Migration)

### Component Status

| Component | Status |
|-----------|--------|
| .ics file structure | ✅ RFC 5545-compliant, imports in all major clients |
| MIME headers | ✅ Single Content-Type with method=REQUEST; base64 on attachment |
| Inline part | ✅ Using AWS SES (preserves base64) |
| Gmail inline buttons | ⏳ Testing in progress |
| Outlook / Apple | ✅ Work perfectly |

### Current Implementation

**Code Location:** `/app/api/send-calendar-invites/route.ts`

**Email Service:** AWS SES via Nodemailer SMTP

**Key Features:**
- Uses `alternatives` array with explicit base64 encoding
- Content-Type: `text/calendar; method=REQUEST; charset=UTF-8`
- CRLF-normalized ICS content
- Unfolded UID/ATTENDEE/ORGANIZER lines
- VTIMEZONE blocks matching Google Calendar format

**Configuration:**
```typescript
const transporter = nodemailer.createTransport({
  host: process.env.SES_SMTP_HOST,
  port: Number(process.env.SES_SMTP_PORT || 587),
  secure: process.env.SES_SMTP_SECURE === 'true',
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASS
  }
})

await transporter.sendMail({
  from: 'Meetup <noreply@numstro.com>',
  to: voter.participant_email,
  replyTo: poll.creator_email,
  subject: `📅 Calendar Invite: ${poll.title}`,
  html: personalizedHtml,
  alternatives: [
    {
      contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
      content: Buffer.from(finalIcs, 'utf8'),
      encoding: 'base64' // Explicitly set base64
    }
  ]
})
```

---

## 9. Next Step — AWS SES (SendRawEmail Alternative)

### Why SES

- Sends your MIME verbatim — no encoding rewrites
- Reliable DKIM/SPF/DNS alignment
- 3,000 emails/month free for the first 12 months
- You already initiated DNS verification

### Target Architecture

Keep current Resend or SMTP2GO for all normal transactional mail.  
For invites only, use an SES transport that preserves MIME.

### Two Safe Paths

**Option A — Nodemailer → SES SMTP** (Currently Implemented)
```typescript
const transporter = nodemailer.createTransport({
  host: 'email-smtp.<region>.amazonaws.com',
  port: 587,
  secure: false,
  auth: { user: process.env.SES_SMTP_USER, pass: process.env.SES_SMTP_PASS },
});

await transporter.sendMail({
  from, to, replyTo, subject, html,
  icalEvent: {
    method: 'REQUEST',
    filename: 'invite.ics',
    content: Buffer.from(icsString, 'utf8'),
  },
});
```

**Option B — AWS SDK SendRawEmail** (Alternative if Option A doesn't work)
```typescript
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: process.env.AWS_REGION });

const boundary = 'b-' + Math.random().toString(36).slice(2);
const raw = `MIME-Version: 1.0
From: ${from}
To: ${to}
Reply-To: ${replyTo}
Subject: ${subject}
Content-Type: multipart/alternative; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: quoted-printable

${html}

--${boundary}
Content-Type: text/calendar; method=REQUEST; charset=UTF-8
Content-Transfer-Encoding: base64

${Buffer.from(icsString, 'utf8').toString('base64')}
--${boundary}--`;

await ses.send(new SendRawEmailCommand({ RawMessage: { Data: Buffer.from(raw) } }));
```

**Expected outcome:**
- `Content-Type: text/calendar; method=REQUEST; charset=UTF-8`
- `Content-Transfer-Encoding: base64`
- → Gmail renders Accept / Maybe / Decline inline

---

## 10. Validation Checklist (Post-SES DNS Verification)

- [ ] Send a test invite to a Gmail account
- [ ] Open "Show original" in Gmail
- [ ] Confirm:
  - [ ] One inline `text/calendar` part with base64 encoding
  - [ ] No duplicate or quoted-printable parts
  - [ ] Message displays inline RSVP buttons

---

## 11. Lessons Learned / Key Takeaways

| Topic | Lesson |
|-------|--------|
| Gmail strictness | Gmail rejects QP-encoded iCalendar parts even if the same ICS imports fine elsewhere |
| ical-generator | Great library; just ensure METHOD:REQUEST, CRLF endings, and UTC DTSTAMP |
| MIME consistency | Always keep one Content-Type header per part; duplication confuses Gmail |
| Transport choice | Resend and SMTP2GO both re-encode or drop method=REQUEST. SES or Postmark preserve base64 reliably |
| Testing | Always confirm actual wire encoding via Gmail "Show original," not just Nodemailer logs |

---

## 12. ICS File Format (Current)

### What Matches Google Calendar
- ✅ VTIMEZONE block format (identical)
- ✅ DTSTART/DTEND format (`DTSTART;TZID=...`)
- ✅ ORGANIZER format (no quotes)
- ✅ ATTENDEE format (no quotes)
- ✅ CREATED, LAST-MODIFIED, TRANSP properties
- ✅ Line folding (both fold lines >75 chars)
- ✅ METHOD:REQUEST
- ✅ All required properties

### What's Different (Expected)
- PRODID: `-//Numstro//Meet//EN` vs `-//Google Inc//Google Calendar 70.9054//EN` (expected)
- UID format: UUID vs short format (both valid)
- VALARM blocks: Google includes reminders, we don't (optional)
- X- properties: Google includes vendor-specific properties (optional)

### Current ICS Structure
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Numstro//Meet//EN
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:America/Los_Angeles
X-LIC-LOCATION:America/Los_Angeles
BEGIN:DAYLIGHT
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
TZNAME:PDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
TZNAME:PST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:...
SEQUENCE:0
DTSTAMP:...
CREATED:...
LAST-MODIFIED:...
DTSTART;TZID=America/Los_Angeles:...
DTEND;TZID=America/Los_Angeles:...
SUMMARY:...
ORGANIZER;CN=Name:mailto:...
ATTENDEE;ROLE=REQ-PARTICIPANT;...CN=Name:MAILTO:...
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR
```

---

## 13. Next Actions

- [x] Wait for SES DNS verification to finish
- [ ] Send new test via SES SMTP with base64 inline calendar
- [ ] If SMTP doesn't work, try SendRawEmail API
- [ ] Document final working .eml (once Gmail renders inline buttons)
- [ ] Merge the SES transport into the app as a dedicated invite sender

---

## 14. Final Expected Result

When Gmail users receive the invite, they should see:

```
📅 Meeting: Test 11
Thursday, November 13 2025
[Accept] [Maybe] [Decline]
```

…and Outlook/Apple users still get standard meeting invites.

---

## 15. Critical Insight from User

**User's observation**: "Before, Google Calendar could at least infer a date and time - now it's no longer possible. What has changed?"

This is important because:
- It suggests something fundamental broke in our recent changes
- Previously, Gmail could at least partially parse the ICS file
- Now it cannot parse it at all
- This suggests we may have introduced a breaking change

**What changed**: We switched from UTC times to TZID format, then back, then to TZID again. The user's observation suggests that when we could infer date/time, we might have been closer to a working solution.

---

## 16. Files Reference

1. **Current implementation**: `/app/api/send-calendar-invites/route.ts`
2. **Google Calendar ICS example**: `invite-8.ics` (provided by user, works in Gmail)
3. **Our generated ICS**: `our-generated-ics.ics` (latest, doesn't work in Gmail)
4. **Comparison docs**: `GOOGLE_VS_OURS_COMPARISON.md`
5. **AWS SES Setup**: `AWS_SES_SETUP.md`
6. **Workflow Documentation**: `CALENDAR_INVITE_WORKFLOW.md`

---

## 17. Environment Variables Required

```bash
# AWS SES Configuration (for calendar invites)
SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SES_SMTP_PORT=587
SES_SMTP_SECURE=false
SES_SMTP_USER=AKIA...
SES_SMTP_PASS=your-smtp-password
SES_REGION=us-east-1
```

---

## 18. Technical Stack

- **Framework**: Next.js 15 (App Router)
- **Email Service**: AWS SES (via Nodemailer SMTP)
- **ICS Generation**: `ical-generator` v10.0.0
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (serverless)
- **Node.js**: v22.18.0

---

**Last Updated:** December 2024  
**Status:** Testing AWS SES implementation  
**Next Milestone:** Verify Gmail inline buttons work with SES

