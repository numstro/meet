# SMTP Setup for Calendar Invites

The calendar invite feature now uses Nodemailer with SMTP for better Gmail compatibility.

## Environment Variables

You need to set SMTP credentials in your environment variables. Choose one of the following options:

### Option 1: Gmail SMTP (Free, but limited)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Meet App" and generate
   - Copy the 16-character password

3. **Set environment variables:**
   ```bash
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   ```

   Or use generic SMTP variables:
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

**Gmail Limits:**
- 500 emails per day (free account)
- 2,000 emails per day (Google Workspace)

### Option 2: Custom SMTP Service

Use any SMTP service (SendGrid, Mailgun, etc.):

```bash
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587  # or 465 for SSL
SMTP_SECURE=false  # true for port 465, false for 587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

## Testing

After setting environment variables, test by sending a calendar invite from the poll page.

## What Changed

- Replaced Resend API with Nodemailer + SMTP
- Full control over email headers (including Content-Type for calendar attachments)
- Better Gmail compatibility for calendar invite recognition

