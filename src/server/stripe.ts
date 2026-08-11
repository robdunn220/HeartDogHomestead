/**
 * Lazily constructed Stripe client.
 *
 * The SDK is imported dynamically so that a site running without payment keys
 * (the simulated checkout used in development) never loads it at all.
 */

import type Stripe from 'stripe';

import { PAYMENTS_ENABLED, STRIPE_SECRET_KEY } from './config';

let client: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!PAYMENTS_ENABLED) {
    throw new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing.');
  }
  if (!client) {
    const { default: StripeCtor } = await import('stripe');
    client = new StripeCtor(STRIPE_SECRET_KEY);
  }
  return client;
}
