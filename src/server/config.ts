/**
 * Central runtime configuration, read from the environment.
 *
 * Nothing here is secret by itself — the secrets live in the environment (see
 * `.env.example`). Anything the browser is allowed to know is exposed through
 * `/api/config`; everything else stays on this side of the wire.
 */

const env = process.env;

/** Absolute or relative path to the SQLite file. */
export const DATABASE_PATH = env['DATABASE_PATH'] || 'data/heartdog.db';

/** Public origin of the site, used to build Stripe return URLs. */
export const SITE_URL = (env['SITE_URL'] || 'http://localhost:4000').replace(/\/$/, '');

export const STRIPE_SECRET_KEY = env['STRIPE_SECRET_KEY'] || '';
export const STRIPE_WEBHOOK_SECRET = env['STRIPE_WEBHOOK_SECRET'] || '';

/**
 * With no Stripe secret key configured the checkout falls back to a simulated
 * flow so the site is fully clickable in development. Real money only moves
 * once a live key is present.
 */
export const PAYMENTS_ENABLED = STRIPE_SECRET_KEY.length > 0;

/** Currency for all prices. Amounts are stored as integer cents. */
export const CURRENCY = env['CURRENCY'] || 'usd';

/** Flat-rate shipping in cents, and the order subtotal above which it is free. */
export const SHIPPING_CENTS = Number(env['SHIPPING_CENTS'] ?? 495);
export const FREE_SHIPPING_THRESHOLD_CENTS = Number(env['FREE_SHIPPING_THRESHOLD_CENTS'] ?? 3500);

/** Sessions last this long before the user must sign in again. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export const IS_PRODUCTION = env['NODE_ENV'] === 'production';

/**
 * The charity the donation page points to. Edit these values to change or
 * rotate the beneficiary — no page code needs to be touched.
 */
export const CHARITY = {
  name: env['CHARITY_NAME'] || 'Your Local Dog Rescue',
  tagline: env['CHARITY_TAGLINE'] || 'Second chances for dogs waiting on their people.',
  donateUrl: env['CHARITY_DONATE_URL'] || 'https://example.org/donate',
  siteUrl: env['CHARITY_SITE_URL'] || 'https://example.org',
  ein: env['CHARITY_EIN'] || '',
};

/** Everything in this object is safe to hand to the browser. */
export function publicConfig() {
  return {
    paymentsEnabled: PAYMENTS_ENABLED,
    currency: CURRENCY,
    shippingCents: SHIPPING_CENTS,
    freeShippingThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
    charity: CHARITY,
  };
}
