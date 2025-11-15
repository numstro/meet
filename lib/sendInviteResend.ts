// lib/sendInviteResend.ts

import { Resend } from 'resend'

export interface ResendInviteOptions {
  from: string;      // e.g., 'Meetup <noreply@numstro.com>'
  to: string;        // recipient email (participant)
  replyTo: string;   // poll creator email
  subject: string;   // e.g., '📅 Calendar Invite: Team Sync'
  text: string;      // plain text fallback body
  html: string;      // HTML body
  ics: string;       // full VCALENDAR string from ical-generator
}

/**
 * Send a calendar invite via Resend API.
 * 
 * Note: Resend may rewrite MIME encoding (base64 to quoted-printable),
 * which can cause Gmail to show "Unable to load event" instead of inline buttons.
 * However, the ICS file will still be valid and can be downloaded/imported.
 * 
 * We include a Google Calendar fallback link in the HTML as a workaround.
 */
export async function sendInviteResend(opts: ResendInviteOptions) {
  const { from, to, replyTo, subject, text, html, ics } = opts;

  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  // Normalize ICS: CRLF line endings, no folded soft wraps
  const normalizedIcs = ics
    .replace(/\r?\n/g, "\r\n") // enforce CRLF
    .replace(/\r\n /g, "");    // unfold any "CRLF + space" soft wraps

  // Convert ICS to Buffer for attachment
  const icsBuffer = Buffer.from(normalizedIcs, 'utf8');

  try {
    const { data, error } = await resend.emails.send({
      from: from,
      to: to,
      reply_to: replyTo,
      subject: subject,
      text: text,
      html: html,
      attachments: [
        {
          filename: 'invite.ics',
          content: icsBuffer,
          // Try to set content type explicitly - Resend may still rewrite it
          // but we'll try our best
        }
      ],
    });

    if (error) {
      console.error(`[Resend] Failed to send email to ${to}:`, error);
      throw error;
    }

    console.log(`[Resend] Successfully sent email to ${to}, id: ${data?.id}`);
    return data;
  } catch (error: any) {
    console.error(`[Resend] Error sending email:`, {
      error: error.message,
      to: to,
      from: from,
    });
    throw error;
  }
}

