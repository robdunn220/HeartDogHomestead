/**
 * Outgoing email.
 *
 * The transport is built lazily from config the first time a message is sent,
 * mirroring the lazy Stripe client in `stripe.ts`. When no SMTP host is
 * configured (`EMAIL_ENABLED` is false) messages are logged to the console
 * instead of sent, so the whole account/checkout flow is exercisable in
 * development without any mail provider — reset links and all.
 *
 * `sendMail` never throws to its callers: email is a side effect of
 * registering, resetting a password, or paying, and a mail hiccup must not
 * turn any of those into a failed request. Failures are logged and swallowed.
 */

import type { Transporter } from 'nodemailer';

import {
  EMAIL_ENABLED,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from './config';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null = null;

async function getTransport(): Promise<Transporter> {
  if (!transporter) {
    const { createTransport } = await import('nodemailer');
    transporter = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/** Sends one message, or logs it in development. Always resolves. */
export async function sendMail(message: OutgoingEmail): Promise<void> {
  if (!EMAIL_ENABLED) {
    logToConsole(message);
    return;
  }

  try {
    const transport = await getTransport();
    await transport.sendMail({
      from: MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  } catch (error) {
    console.error(`Failed to send email "${message.subject}" to ${message.to}:`, error);
  }
}

/** Prints the message — including any links in the text body — to the server log. */
function logToConsole(message: OutgoingEmail): void {
  console.log(
    [
      '',
      '──────────────────────────────────────────────────────────',
      ' EMAIL (dev mode — not sent; set SMTP_HOST to send for real)',
      `   To:      ${message.to}`,
      `   From:    ${MAIL_FROM}`,
      `   Subject: ${message.subject}`,
      '──────────────────────────────────────────────────────────',
      message.text,
      '──────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}
