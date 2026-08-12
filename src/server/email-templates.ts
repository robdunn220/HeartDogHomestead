/**
 * Transactional email bodies.
 *
 * Each builder is a pure function returning the subject and both a styled HTML
 * body and a plain-text fallback. Kept deliberately simple — inline styles, no
 * templating engine — so they render the same in every mail client and the
 * plain-text version carries every link on its own.
 */

import { SITE_URL } from './config';
import type { OutgoingEmail } from './mail';
import type { OrderDto } from './orders';

const BRAND = 'Heart Dog Homestead';

/** Formats integer cents as US dollars, matching the storefront. */
function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/** Wraps body HTML in a minimal, mail-client-safe shell. */
function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f6f4ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2c2a26;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ee;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:480px;">
            <tr>
              <td style="background:#4a7c59;padding:20px 28px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">${BRAND}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#2c2a26;">${heading}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 28px;">
                <p style="margin:0;font-size:12px;color:#8a857c;">
                  ${BRAND} · heirloom seeds, grown with care.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4a7c59;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;">${label}</a>`;
}

export interface EmailUser {
  name: string;
  email: string;
}

/** Sent right after an account is created. */
export function welcomeEmail(user: EmailUser): OutgoingEmail {
  const firstName = user.name.split(' ')[0] || user.name;
  const shopUrl = `${SITE_URL}/shop`;

  const html = shell(
    `Welcome, ${firstName}!`,
    `<p style="margin:0 0 16px;line-height:1.55;">
       Your ${BRAND} account is ready. From here on, every order you place is
       saved to your account so you can look back on what you planted.
     </p>
     <p style="margin:0 0 24px;line-height:1.55;">
       Come see what's in season:
     </p>
     <p style="margin:0 0 8px;">${button(shopUrl, 'Browse the catalog')}</p>`,
  );

  const text = `Welcome, ${firstName}!

Your ${BRAND} account is ready. Every order you place is now saved to your
account so you can look back on what you planted.

Browse the catalog: ${shopUrl}

— ${BRAND}`;

  return { to: user.email, subject: `Welcome to ${BRAND}`, html, text };
}

/** Sent when a customer asks to reset a forgotten password. */
export function passwordResetEmail(user: EmailUser, resetLink: string): OutgoingEmail {
  const html = shell(
    'Reset your password',
    `<p style="margin:0 0 16px;line-height:1.55;">
       We got a request to reset the password for your ${BRAND} account. Click
       below to choose a new one. This link expires in one hour.
     </p>
     <p style="margin:0 0 24px;">${button(resetLink, 'Choose a new password')}</p>
     <p style="margin:0;font-size:13px;color:#8a857c;line-height:1.55;">
       If you didn't ask for this, you can safely ignore this email — your
       password won't change until you use the link above.
     </p>`,
  );

  const text = `Reset your password

We got a request to reset the password for your ${BRAND} account. Open the link
below to choose a new one. It expires in one hour.

${resetLink}

If you didn't ask for this, you can ignore this email — your password won't
change until you use the link.

— ${BRAND}`;

  return { to: user.email, subject: `Reset your ${BRAND} password`, html, text };
}

/** Sent once an order is marked paid. */
export function orderConfirmationEmail(order: OrderDto): OutgoingEmail {
  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
           <td style="padding:6px 0;line-height:1.4;">${item.name} <span style="color:#8a857c;">× ${item.quantity}</span></td>
           <td style="padding:6px 0;text-align:right;white-space:nowrap;">${money(item.unitPriceCents * item.quantity)}</td>
         </tr>`,
    )
    .join('');

  const shippingRow =
    order.shippingCents > 0
      ? `<tr><td style="padding:2px 0;color:#6b665d;">Shipping</td><td style="padding:2px 0;text-align:right;">${money(order.shippingCents)}</td></tr>`
      : `<tr><td style="padding:2px 0;color:#6b665d;">Shipping</td><td style="padding:2px 0;text-align:right;">Free</td></tr>`;

  const html = shell(
    'Thank you for your order',
    `<p style="margin:0 0 16px;line-height:1.55;">
       We've got your order and it's on our list. Here's what you picked.
     </p>
     <p style="margin:0 0 16px;font-size:14px;color:#6b665d;">
       Order reference <strong style="color:#2c2a26;">${order.reference}</strong>
     </p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #eae7df;border-bottom:1px solid #eae7df;margin:0 0 12px;">
       ${itemsHtml}
     </table>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
       <tr><td style="padding:2px 0;color:#6b665d;">Subtotal</td><td style="padding:2px 0;text-align:right;">${money(order.subtotalCents)}</td></tr>
       ${shippingRow}
       <tr><td style="padding:8px 0 0;font-weight:700;">Total</td><td style="padding:8px 0 0;text-align:right;font-weight:700;">${money(order.totalCents)}</td></tr>
     </table>`,
  );

  const itemsText = order.items
    .map((item) => `  • ${item.name} × ${item.quantity} — ${money(item.unitPriceCents * item.quantity)}`)
    .join('\n');

  const text = `Thank you for your order

Order reference: ${order.reference}

${itemsText}

Subtotal: ${money(order.subtotalCents)}
Shipping: ${order.shippingCents > 0 ? money(order.shippingCents) : 'Free'}
Total:    ${money(order.totalCents)}

We'll be in touch as your seeds make their way to you.

— ${BRAND}`;

  return { to: order.email, subject: `Your ${BRAND} order ${order.reference}`, html, text };
}
