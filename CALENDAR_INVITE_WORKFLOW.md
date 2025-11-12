# Calendar Invite Workflow Documentation

## Overview
This document describes the complete workflow for sending calendar invites to poll participants in the Meet app. The system allows poll creators to send calendar invites to all participants who voted "yes" or "maybe" for a selected time slot.

## User Flow

### 1. Poll Creation
- User creates a poll with their name and email
- Poll is saved to database with `creator_name` and `creator_email`
- User is redirected to poll page with URL params: `?creatorName=X&creatorEmail=Y`
- These params are used to auto-fill the creator's email in the calendar invite modal

### 2. Participants Vote
- Participants vote on time slots (yes/no/maybe)
- Votes are stored in `poll_responses` table
- Voting results are displayed in a grid format

### 3. Sending Calendar Invites

#### Step 1: User Clicks "Send Calendar Invites" Button
- Button is visible to everyone (no authentication required)
- Button only appears if there are voting results (`summary.length > 0`)

#### Step 2: Modal Opens
- User selects a date/time option from a dropdown
- User can optionally customize start/end times (defaults are provided based on time bucket: morning 8-12, afternoon 1-5, evening 5-9)
- User must enter an email address in the "Creator Email" field
- **Security Note**: The creator's email is NOT displayed anywhere in the UI to prevent unauthorized users from seeing it

#### Step 3: Email Verification
- Frontend validation: Checks if entered email matches `poll.creator_email`
- If email doesn't match: Shows error "Only the poll creator can send calendar invites. The email you entered does not match the poll creator's email."
- If email matches: Proceeds to API call

#### Step 4: API Request
**Endpoint**: `POST /api/send-calendar-invites`

**Request Body**:
```json
{
  "pollId": "uuid",
  "optionId": "uuid",
  "creatorEmail": "creator@example.com",
  "startTime": "08:00",
  "endTime": "12:00",
  "timezone": "America/Los_Angeles"
}
```

#### Step 5: Server-Side Verification
1. **Email Verification**: 
   - Queries database: `SELECT * FROM polls WHERE id = pollId AND creator_email = creatorEmail`
   - If no match: Returns 403 error "Unauthorized: Only the poll creator can send calendar invites..."
   - This is the **primary security check** - even if frontend validation is bypassed, server enforces it

2. **Poll Option Validation**:
   - Verifies the selected option exists and belongs to the poll

3. **Voter Retrieval**:
   - Queries `poll_responses` for all voters who voted "yes" or "maybe" for the selected option
   - Gets unique voters (in case someone voted multiple times)

4. **Date Validation**:
   - Checks if event date is in the past
   - Rejects if event date < today

#### Step 6: Calendar File Generation
- Uses `ical-generator` library to create `.ics` file
- Sets timezone from user's browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`)
- Creates calendar event with:
  - Start/end times
  - Poll title as summary
  - Poll description
  - Location (if provided)
  - Organizer: poll creator name/email
  - Attendees: all voters who voted yes/maybe
  - Unique event ID

#### Step 7: Email Sending (with Rate Limiting)
- Uses Resend API to send emails
- **Rate Limiting**: Resend allows 2 requests per second
- **Implementation**: 600ms delay between each email send
  - This allows ~1.67 requests/second, safely under the 2/sec limit
  - Delay only applied between emails (not after the last one)

**Email Content**:
- From: `Meetup <noreply@numstro.com>`
- To: Each voter's email
- Reply-To: Poll creator's email
- Subject: `📅 Calendar Invite: {poll.title}`
- Attachment: `invite.ics` (base64 encoded)
- HTML body: Formatted email with poll details, date, time, location, and link back to poll

**Rate Limiting Code**:
```typescript
for (let i = 0; i < uniqueVoters.length; i++) {
  const voter = uniqueVoters[i]
  try {
    await resend.emails.send({...})
    emailResults.push({ email: voter.participant_email, success: true })
  } catch (emailErr) {
    // Handle error
  }
  
  // Rate limiting: wait 600ms between emails
  if (i < uniqueVoters.length - 1) {
    await new Promise(resolve => setTimeout(resolve, 600))
  }
}
```

#### Step 8: Response
- Returns success/failure count
- Frontend displays result message
- Modal auto-closes after 2 seconds on success

## Security Model

### Current Implementation
1. **No Authentication System**: App doesn't require user accounts
2. **Email-Based Verification**: 
   - Creator must know their own email address
   - Server verifies email matches poll creator
3. **Creator Email Privacy**: 
   - Creator's email is NOT displayed in UI
   - Users must know the email to send invites
   - This prevents casual unauthorized access

### Security Limitations
- **Not CIA-Level Security**: As stated by product owner, this is acceptable
- Anyone who knows the creator's email can send invites
- No token-based or session-based authentication
- Works across devices (no device-specific storage)

### Why This Works
- Most users won't know the creator's email
- Server-side validation prevents API abuse
- Email verification is sufficient for this use case
- Simple UX - no complex authentication flows

## Error Handling

### Frontend Errors
- Missing fields: "Please select a time option and enter your email"
- Email mismatch: "Only the poll creator can send calendar invites. The email you entered does not match the poll creator's email."

### Backend Errors
- 400: Missing required fields
- 403: Email doesn't match creator (unauthorized)
- 404: Poll or option not found
- 400: Event date in the past
- 400: No voters found for option
- 500: Email service not configured
- 500: Failed to generate calendar file
- 429: Rate limit exceeded (shouldn't happen with current implementation)

### Email Sending Errors
- Individual email failures are caught and logged
- Success/failure count is returned
- Partial success is acceptable (some emails sent, some failed)

## Rate Limiting Details

### Resend API Limits
- **Limit**: 2 requests per second
- **Our Implementation**: 600ms delay = ~1.67 requests/second
- **Safety Margin**: 33% below limit to account for network variability

### Why 600ms?
- 2 requests/second = 500ms between requests minimum
- 600ms provides buffer for:
  - Network latency
  - Processing time
  - Clock drift
  - Prevents hitting limit even with slight timing variations

### Performance Impact
- For 3 participants: ~1.8 seconds total (2 delays × 600ms)
- For 10 participants: ~5.4 seconds total (9 delays × 600ms)
- Acceptable trade-off for reliability

## Database Schema

### Relevant Tables
- `polls`: Stores poll info including `creator_email`
- `poll_options`: Stores time slot options
- `poll_responses`: Stores votes with `participant_email`, `response` (yes/no/maybe), `option_id`

## Technical Stack
- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL)
- **Email**: Resend API
- **Calendar**: ical-generator library
- **Timezone**: Browser-detected timezone passed to API

## Future Considerations

### Potential Improvements
1. **Batch Email Sending**: Resend supports batch API (could send all emails in one request)
2. **Retry Logic**: Add retry for failed emails
3. **Progress Indicator**: Show progress when sending to many recipients
4. **Email Templates**: More sophisticated email designs
5. **Calendar Sync**: Direct integration with Google Calendar API (requires OAuth)

### Current Limitations
- Sequential email sending (one at a time)
- No retry mechanism for failed emails
- No progress feedback during sending
- Timezone detection relies on browser (could be spoofed, but acceptable for this use case)

## Testing Scenarios

### Happy Path
1. Creator creates poll
2. Participants vote
3. Creator selects option and enters their email
4. All emails sent successfully
5. Participants receive calendar invites

### Error Cases
1. Non-creator tries to send (email mismatch) → 403 error
2. Event in the past → 400 error
3. No voters for option → 400 error
4. Email service down → 500 error, individual failures logged
5. Rate limit hit (shouldn't happen) → 429 error

### Edge Cases
1. Multiple votes from same person → Deduplicated to unique voters
2. Custom times vs defaults → Uses custom if provided, otherwise defaults
3. Timezone differences → Uses browser timezone, converts properly in iCal
4. Large number of recipients → Rate limiting handles it, but takes longer

