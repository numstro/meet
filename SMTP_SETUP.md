# SMTP Setup for Calendar Invites

The calendar invite feature uses Nodemailer with SMTP2GO to enable Gmail inline Accept/Decline cards.

**Why SMTP instead of Resend?**
- Resend cannot set the required `Content-Type: text/calendar; method=REQUEST; charset=UTF-8` header
- Gmail requires this exact header to show inline Accept/Decline buttons
- Nodemailer with SMTP gives us full control over email headers

## Environment Variables

You need to set SMTP credentials in your environment variables. We use SMTP2GO.

### SMTP2GO Configuration (Recommended)

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

1. **Sign up for SMTP2GO**: https://www.smtp2go.com/
2. **Get your SMTP credentials**:
   - Go to "Sending > SMTP Users" in your SMTP2GO dashboard
   - Create or use an existing SMTP user
   - Copy the username and password
3. **Verify your sender email**:
   - Go to "Sending > Verified Senders"
   - Verify `noreply@numstro.com` (or your sending address)
4. **Set environment variables**:
   ```bash
   SMTP_HOST=mail.smtp2go.com
   SMTP_PORT=2525  # TLS port (recommended)
   SMTP_SECURE=false  # false for TLS (port 2525), true for SSL (port 465)
   SMTP_USER=your-smtp2go-username
   SMTP_PASS=your-smtp2go-password
   ```

**SMTP2GO Port Options:**
- Port 2525 (TLS, recommended) - `SMTP_SECURE=false`
- Port 587 (TLS) - `SMTP_SECURE=false`
- Port 465 (SSL) - `SMTP_SECURE=true`
- Port 8025 (TLS) - `SMTP_SECURE=false`

### Option 2: Gmail SMTP (Free, but limited)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Meet App" and generate
   - Copy the 16-character password
3. **Set environment variables:**
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

### Option 3: Other SMTP Services

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

- **Replaced Resend with Nodemailer + SMTP2GO**
- **Full control over email headers** - can set `Content-Type: text/calendar; method=REQUEST; charset=UTF-8`
- **Gmail inline Accept/Decline cards** - Gmail now recognizes calendar invites and shows inline buttons
- **ICS file is still valid** - the ICS content was always correct, but Gmail needs the proper MIME header

## Critical Header for Gmail

The attachment must have:
```
Content-Type: text/calendar; method=REQUEST; charset=UTF-8
```

This is why we use Nodemailer - Resend cannot set this header, which is why Gmail showed "Unable to load event" even though the ICS file was valid.

