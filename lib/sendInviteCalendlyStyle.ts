// lib/sendInviteCalendlyStyle.ts

import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";

/**
 * SES client – make sure AWS_REGION is set in your environment.
 */
const ses = new SESClient({
  region: process.env.AWS_REGION || process.env.SES_REGION || 'us-east-2',
});

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
 * Send a calendar invite that mimics Calendly's MIME structure as closely as possible.
 *
 * Structure:
 * multipart/mixed
 * ├─ multipart/alternative
 * │   ├─ text/plain
 * │   ├─ text/html
 * │   └─ text/calendar (inline, METHOD=REQUEST, base64)
 * └─ text/calendar (attachment, invite.ics, base64)
 */
export async function sendInviteCalendlyStyle(opts: CalendlyStyleInviteOptions) {
  const { from, to, replyTo, subject } = opts;

  // 1) Normalize ICS: CRLF line endings, no folded soft wraps
  let ics = opts.ics
    .replace(/\r?\n/g, "\r\n") // enforce CRLF
    .replace(/\r\n /g, "");    // unfold any "CRLF + space" soft wraps

  const icsBase64 = Buffer.from(ics, "utf8").toString("base64");

  // 2) Prepare plain text + HTML bodies
  const textBody = opts.text || "A calendar invite is attached to this email.";
  const htmlBody = opts.html || `<p>A calendar invite has been attached to this email as <strong>invite.ics</strong>.</p>`;

  // 3) Boundaries – must be unique enough per message
  const mixedBoundary = "mixed_" + Math.random().toString(36).slice(2);
  const altBoundary = "alt_" + Math.random().toString(36).slice(2);

  // 4) Build raw MIME string in Calendly-style structure
  // Note: All header lines and boundaries use CRLF (\r\n).
  const raw =
    [
      `MIME-Version: 1.0`,
      `From: ${from}`,
      `To: ${to}`,
      `Reply-To: ${replyTo}`,
      `Subject: ${subject}`,
      `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
      ``,

      // Start mixed
      `--${mixedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      ``,

      // Plain text part
      `--${altBoundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      textBody,
      ``,

      // HTML part
      `--${altBoundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      htmlBody,
      ``,

      // INLINE calendar part (Gmail-critical)
      `--${altBoundary}`,
      `Content-Type: text/calendar; method=REQUEST; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: inline`,
      `Content-Class: urn:content-classes:calendarmessage`,
      ``,
      icsBase64,
      ``,

      // End alt
      `--${altBoundary}--`,
      ``,

      // ATTACHMENT calendar part (downloadable invite.ics)
      `--${mixedBoundary}`,
      `Content-Type: text/calendar; name="invite.ics"; method=REQUEST; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="invite.ics"`,
      `Content-Class: urn:content-classes:calendarmessage`,
      ``,
      icsBase64,
      ``,

      // End mixed
      `--${mixedBoundary}--`,
      ``,

    ].join("\r\n");

  // 5) Send via SES RawEmail
  await ses.send(
    new SendRawEmailCommand({
      RawMessage: {
        Data: Buffer.from(raw, "utf8"),
      },
    })
  );
}

