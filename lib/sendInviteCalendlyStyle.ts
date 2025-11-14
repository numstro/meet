// lib/sendInviteCalendlyStyle.ts

import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";

/**
 * SES client – make sure SES_REGION is set in your environment.
 * IMPORTANT: The region must match where your domain is verified in SES.
 * Domain numstro.com is verified in us-east-2.
 */
function getSESClient() {
  // Prioritize SES_REGION over AWS_REGION (since we explicitly set SES_REGION)
  // Default to us-east-2 where the domain is verified
  const region = process.env.SES_REGION || process.env.AWS_REGION || 'us-east-2';
  
  // Debug logging to see what env vars are actually available
  console.log(`[SES] Environment check:`, {
    SES_REGION: process.env.SES_REGION || '(not set)',
    AWS_REGION: process.env.AWS_REGION || '(not set)',
    selectedRegion: region
  });
  
  return new SESClient({
    region: region,
  });
}

export interface CalendlyStyleInviteOptions {
  from: string;      // e.g., 'Meetup <noreply@numstro.com>'
  to: string;        // recipient email (participant)
  replyTo: string;   // poll creator email
  subject: string;   // e.g., '📅 Calendar Invite: Team Sync'
  text: string;      // plain text fallback body
  html: string;      // HTML body
  ics: string;       // full VCALENDAR string from ical-generator
}

/**
 * Send a calendar invite matching Google Calendar's exact MIME format.
 * 
 * Key requirements for Gmail parsing:
 * - Single text/calendar part as attachment (not inline + attachment)
 * - Content-Transfer-Encoding: 7bit (no quoted-printable, no base64)
 * - Content-Type: text/calendar; charset="UTF-8"; method=REQUEST
 * - Pure ASCII ICS content with CRLF line endings only
 * 
 * Structure (matching Google Calendar):
 * multipart/mixed
 * ├─ text/html (7bit)
 * └─ text/calendar (attachment, 7bit, invite.ics)
 */
export async function sendInviteCalendlyStyle(opts: CalendlyStyleInviteOptions) {
  const { from, to, replyTo, subject } = opts;
  
  // Create SES client (will log the region being used)
  const ses = getSESClient();
  
  // Extract email address from "Display Name <email@domain.com>" format if needed
  const fromEmailMatch = from.match(/<(.+)>/);
  const fromEmail = fromEmailMatch ? fromEmailMatch[1] : from;
  
  console.log(`[SES] Sending email from: ${fromEmail} to: ${to}`);

  // 1) Normalize ICS: CRLF line endings, no folded soft wraps, ensure pure ASCII
  let ics = opts.ics
    .replace(/\r?\n/g, "\r\n") // enforce CRLF
    .replace(/\r\n /g, "");    // unfold any "CRLF + space" soft wraps
  
  // Validate ICS is pure ASCII (7bit encoding requirement)
  // If there are non-ASCII characters, we'll need to handle them differently
  // For now, assume ical-generator produces ASCII-safe output
  const icsBytes = Buffer.from(ics, 'utf8');
  const hasNonASCII = Array.from(icsBytes).some(byte => byte > 127);
  if (hasNonASCII) {
    console.warn(`[SES] ICS contains non-ASCII characters. Gmail may require UTF-8 encoding.`);
  }

  // 2) Prepare HTML body (plain text optional for now)
  const htmlBody = opts.html || `<p>A calendar invite has been attached to this email as <strong>invite.ics</strong>.</p>`;

  // 3) Boundary – must be unique per message
  const mixedBoundary = "boundary_" + Math.random().toString(36).slice(2, 15);

  // 4) Build raw MIME string matching Google Calendar's exact format
  // All lines use CRLF (\r\n) as per MIME spec
  const raw =
    [
      `MIME-Version: 1.0`,
      `From: ${from}`,
      `To: ${to}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      ``,

      // HTML part
      `--${mixedBoundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlBody,
      ``,

      // Calendar attachment (single part, 7bit encoding - matches Google format)
      `--${mixedBoundary}`,
      `Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="invite.ics"`,
      `Content-Disposition: attachment; filename="invite.ics"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      ics,  // Raw ICS content, not base64 encoded
      ``,

      // End mixed
      `--${mixedBoundary}--`,
      ``,

    ].join("\r\n");

  // 5) Send via SES RawEmail
  // Note: SES extracts the From address from the MIME headers automatically
  // The domain (numstro.com) must be verified in the same region as the SES client
  try {
    await ses.send(
      new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(raw, "utf8"),
        },
      })
    );
    console.log(`[SES] Successfully sent email to ${to}`);
  } catch (error: any) {
    const region = process.env.AWS_REGION || process.env.SES_REGION || 'us-east-2';
    console.error(`[SES] Failed to send email:`, {
      error: error.message,
      code: error.Code || error.name,
      region: region,
      from: fromEmail,
      to: to,
      note: 'Make sure the domain is verified in the same region as SES_REGION/AWS_REGION'
    });
    throw error;
  }
}

