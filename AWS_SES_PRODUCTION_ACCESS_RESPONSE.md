# AWS SES Production Access Request - Response Template

## How to Respond

1. Go to the AWS Support Center link provided in the email:
   https://console.aws.amazon.com/support/home#/case/?displayId=176313233800106&language=en

2. Click "Add comment" or "Reply" to respond to the case

3. Copy and paste the response below (customize as needed)

---

## Response Text

**Subject:** RE: [CASE 176313233800106] SES: Production Access

Thank you for your response. Below is the information you requested about our use case:

**Use Case:**
We are building a meeting scheduling application (similar to Calendly/Doodle) called "Meet" that allows users to create polls for meeting times. When a meeting time is selected, we send calendar invites via email to participants who voted for that time slot.

**Email-Sending Processes and Procedures:**
- Emails are sent programmatically via AWS SES using the SendRawEmail API
- All emails are transactional (calendar invites based on user actions)
- Emails are only sent when:
  1. A poll creator selects a winning time slot
  2. Participants have explicitly voted "yes" or "maybe" for that time slot
  3. The event is in the future (not past dates)
- We use verified domain identity: `numstro.com` (already verified in us-east-2)
- From address: `noreply@numstro.com` (verified as part of domain verification)

**How Often Emails Are Sent:**
- Low volume: Estimated 10-50 emails per day initially
- Emails are event-driven (only when users schedule meetings)
- No bulk marketing emails or newsletters
- All emails are transactional calendar invites

**How Recipient Lists Are Maintained:**
- Recipients are not stored in a mailing list
- Email addresses are collected directly from users when they:
  1. Create a poll (poll creator email)
  2. Vote on poll options (participant email)
- All email addresses are provided by users themselves (opt-in)
- No purchased or scraped email lists
- Recipients explicitly participate in the scheduling process before receiving invites

**Bounce, Complaint, and Unsubscribe Management:**
- We have implemented AWS SES bounce and complaint handling:
  - Bounced emails are logged and the recipient is marked as invalid
  - Complaints are logged and the recipient is immediately removed from future sends
  - We respect unsubscribe requests (though our emails are transactional, we honor opt-outs)
- We monitor bounce rates and complaint rates via AWS SES metrics
- We will implement automatic suppression lists to prevent sending to bounced/complained addresses
- Our application includes rate limiting to prevent abuse

**Examples of Emails:**
Our emails contain:
- Calendar invite attachments (ICS format) for adding events to recipients' calendars
- HTML email body with meeting details (title, date, time, location, description)
- Plain text fallback
- Reply-To header set to the poll creator's email

**Email Content Example:**
- Subject: "📅 Calendar Invite: [Meeting Title]"
- Body: Meeting details, date/time, location, and a link to view the poll
- Attachment: `invite.ics` calendar file (RFC 5545 compliant)

**Verified Identity:**
We have already verified the domain `numstro.com` in the us-east-2 region with:
- Domain verification (TXT record)
- Easy DKIM (3 CNAME records) - successfully configured
- SPF record configured
- DMARC record configured

**Additional Information:**
- We are using AWS SDK for JavaScript (SendRawEmailCommand) to send emails
- All emails are sent from verified domain: `numstro.com`
- We follow AWS SES best practices for email formatting and MIME structure
- We are committed to maintaining high sender reputation and low bounce/complaint rates

Please let me know if you need any additional information to process our production access request.

Thank you,
[Your Name]

---

## Notes

- Customize the response with your actual name/contact info
- If you have specific numbers (e.g., expected daily volume), update those
- Make sure to mention that your domain is already verified (this is important!)
- Emphasize that all emails are transactional (not marketing)

