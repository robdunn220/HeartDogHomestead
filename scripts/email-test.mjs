/**
 * Checks the SMTP configuration end to end.
 *
 *   npm run email:test -- you@example.com
 *
 * Reads the same SMTP_* / MAIL_FROM values the app uses (loaded from .env by
 * the npm script), verifies the connection and login, then — if a recipient is
 * given — sends one real test message so you can confirm it lands.
 *
 * While a Postmark account is pending approval, the recipient must share the
 * MAIL_FROM domain; otherwise Postmark returns ErrorCode 412.
 */

import nodemailer from 'nodemailer';

const to = process.argv[2];

const host = process.env.SMTP_HOST || '';
const port = Number(process.env.SMTP_PORT ?? 587);
const secure = process.env.SMTP_SECURE === 'true';
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';
const from = process.env.MAIL_FROM || '';

const mask = (s) => (s.length <= 8 ? '*'.repeat(s.length) : `${s.slice(0, 4)}…${s.slice(-4)}`);

if (!host) {
  console.log('SMTP_HOST is not set. Fill in the SMTP block in .env first.');
  process.exit(1);
}

console.log('SMTP config the app will use:');
console.log(`  host   ${host}:${port} (secure=${secure})`);
console.log(`  user   ${mask(user)}`);
console.log(`  from   ${from}`);
console.log('');

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user ? { user, pass } : undefined,
});

try {
  await transporter.verify();
  console.log('✅ Connection + authentication succeeded.');
} catch (err) {
  console.log(`❌ Connection/auth failed: ${err.message}${err.code ? ` (${err.code})` : ''}`);
  process.exit(1);
}

if (!to) {
  console.log('\nNo recipient given, so nothing was sent.');
  console.log('To send a real test message: npm run email:test -- you@example.com');
  process.exit(0);
}

try {
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Heart Dog Homestead — SMTP test',
    text: 'This is a test message confirming Heart Dog Homestead email delivery works.',
    html: '<p>This is a test message confirming <strong>Heart Dog Homestead</strong> email delivery works.</p>',
  });
  console.log(`\n✅ Sent to ${to}`);
  console.log(`   response: ${info.response}`);
} catch (err) {
  console.log(`\n❌ Send failed: ${err.message}`);
  if (err.response) console.log(`   response: ${err.response}`);
  process.exit(1);
}
