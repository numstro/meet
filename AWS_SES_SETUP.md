# AWS SES Setup for Calendar Invites

AWS SES (Simple Email Service) is used for calendar invites because it preserves MIME encoding exactly, preventing SMTP2GO from rewriting the calendar part to quoted-printable.

## Setup Steps

### 1. Sign Up for AWS

If you don't have an AWS account:
- Go to https://aws.amazon.com/
- Click "Create an AWS Account"
- Follow the signup process

### 2. Navigate to SES Console

- Go to https://console.aws.amazon.com/ses/
- Select your preferred region (e.g., `us-east-1`, `us-west-2`)

### 3. Verify Your Email Address or Domain

**Option A: Verify Email Address (Quick for Testing)**
1. In SES Console, go to **Verified identities**
2. Click **Create identity**
3. Select **Email address**
4. Enter `noreply@numstro.com` (or your sending address)
5. Check your email and click the verification link

**Option B: Verify Domain (Recommended for Production)**
1. In SES Console, go to **Verified identities**
2. Click **Create identity**
3. Select **Domain**
4. Enter `numstro.com`
5. SES will provide DNS records (TXT, CNAME, MX)
6. Add these records to your domain's DNS settings
7. Return to SES Console to confirm verification

### 4. Request Production Access

By default, SES is in "sandbox" mode (can only send to verified addresses).

1. In SES Console, go to **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Mail Type**: Transactional
   - **Website URL**: https://meet.numstro.com
   - **Use case description**: "Sending calendar invites for meeting scheduling application"
   - **Compliance**: Check all boxes
4. Submit and wait for approval (usually 24-48 hours)

### 5. Create SMTP Credentials

1. In SES Console, go to **Account dashboard**
2. Scroll to **SMTP settings**
3. Click **Create SMTP credentials**
4. Enter an IAM user name (e.g., `ses-smtp-user`)
5. Click **Create user**
6. **IMPORTANT**: Download and save the credentials file - you'll need:
   - **SMTP Username** (starts with `AKIA...`)
   - **SMTP Password** (long random string)
   - **SMTP Server** (e.g., `email-smtp.us-east-1.amazonaws.com`)
   - **Port**: 587 (TLS) or 465 (SSL)

### 6. Set Environment Variables in Vercel

Add these to your Vercel project:

```bash
# AWS SES Configuration (for calendar invites)
SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Replace with your region
SES_SMTP_PORT=587
SES_SMTP_SECURE=false  # true for port 465, false for port 587
SES_SMTP_USER=AKIA...  # Your SMTP username
SES_SMTP_PASS=your-smtp-password  # Your SMTP password
SES_REGION=us-east-1  # Your AWS region
```

**To find your SMTP endpoint:**
- In SES Console, go to **Account dashboard**
- Scroll to **SMTP settings**
- Your endpoint is listed (e.g., `email-smtp.us-east-1.amazonaws.com`)

### 7. Test the Setup

After setting environment variables and redeploying:
1. Send a calendar invite from your app
2. Check Gmail "Show original"
3. Verify the calendar part shows `Content-Transfer-Encoding: base64` (not quoted-printable)

## AWS SES Pricing

- **Free Tier**: 62,000 emails/month (if sending from EC2)
- **Pay-as-you-go**: $0.10 per 1,000 emails
- **Very affordable** for calendar invites

## Why SES Instead of SMTP2GO?

- **SMTP2GO**: Rewrites MIME encoding, converts base64 to quoted-printable
- **AWS SES**: Preserves MIME encoding exactly as sent
- **Result**: Gmail can parse the calendar invite correctly

## Troubleshooting

**"Email address not verified" error:**
- Make sure you've verified the sender email in SES Console
- Or request production access to send to any email

**"Access Denied" error:**
- Check your SMTP credentials are correct
- Verify the IAM user has SES sending permissions

**Still seeing quoted-printable:**
- Double-check you're using the SES transporter, not SMTP2GO
- Verify environment variables are set correctly



