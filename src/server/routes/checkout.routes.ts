/**
 * Checkout.
 *
 * The flow: the browser posts a list of slugs and quantities; the server prices
 * it from the catalog, writes a pending order, and hands back a URL to send the
 * customer to. Card details are entered on Stripe's own hosted page and never
 * touch this server.
 *
 * An order is only marked paid by the webhook (or by an explicit confirmed
 * lookup against Stripe), never by the browser coming back to the success URL —
 * anyone can navigate to that URL.
 */

import { Router, raw, type Request, type Response } from 'express';

import { attachUser, type AuthedRequest } from '../auth';
import { CURRENCY, PAYMENTS_ENABLED, SITE_URL, STRIPE_WEBHOOK_SECRET } from '../config';
import {
  attachStripeSession,
  CartError,
  createPendingOrder,
  findOrderIdByStripeSession,
  markOrderPaid,
  priceCart,
} from '../orders';
import { getStripe } from '../stripe';

export const checkoutRouter = Router();

/** Prices a cart without creating an order — drives the cart summary. */
checkoutRouter.post('/quote', (req, res) => {
  try {
    res.json({ cart: priceCart(req.body?.items) });
  } catch (error) {
    if (error instanceof CartError) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }
});

checkoutRouter.post('/session', attachUser, async (req: AuthedRequest, res) => {
  let cart;
  try {
    cart = priceCart(req.body?.items);
  } catch (error) {
    if (error instanceof CartError) {
      res.status(400).json({ error: error.message });
      return;
    }
    throw error;
  }

  const email = String(req.body?.email ?? req.user?.email ?? '')
    .trim()
    .toLowerCase();
  if (!email) {
    res.status(400).json({ error: 'We need an email address to send your order confirmation.' });
    return;
  }

  const order = createPendingOrder(cart, req.user?.id ?? null, email);

  // No payment keys configured: complete the order without charging anyone and
  // tell the browser it was simulated, so the UI can say so plainly.
  if (!PAYMENTS_ENABLED) {
    markOrderPaid(order.id);
    res.json({
      simulated: true,
      reference: order.reference,
      url: `${SITE_URL}/checkout/success?ref=${order.reference}&simulated=1`,
    });
    return;
  }

  try {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      client_reference_id: order.reference,
      metadata: { orderId: String(order.id), reference: order.reference },
      line_items: [
        ...cart.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: cart.currency,
            unit_amount: line.unitPriceCents,
            product_data: { name: line.name },
          },
        })),
        ...(cart.shippingCents > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: cart.currency,
                  unit_amount: cart.shippingCents,
                  product_data: { name: 'Shipping' },
                },
              },
            ]
          : []),
      ],
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      success_url: `${SITE_URL}/checkout/success?ref=${order.reference}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/cart?canceled=1`,
    });

    attachStripeSession(order.id, session.id);
    res.json({ simulated: false, reference: order.reference, url: session.url });
  } catch (error) {
    console.error('Stripe checkout session failed:', error);
    res.status(502).json({ error: 'We could not reach the payment processor. Please try again.' });
  }
});

/**
 * Belt and braces for the success page: asks Stripe directly whether the
 * session was paid, so the confirmation is correct even if the webhook is
 * delayed or not configured yet in development.
 */
checkoutRouter.post('/confirm', async (req, res) => {
  const sessionId = String(req.body?.sessionId ?? '');
  if (!sessionId || !PAYMENTS_ENABLED) {
    res.json({ confirmed: false });
    return;
  }

  try {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const orderId =
        Number(session.metadata?.['orderId']) || findOrderIdByStripeSession(sessionId);
      if (orderId) markOrderPaid(orderId);
      res.json({ confirmed: true });
      return;
    }
    res.json({ confirmed: false });
  } catch (error) {
    console.error('Stripe confirm failed:', error);
    res.json({ confirmed: false });
  }
});

/**
 * Stripe webhook. Mounted separately in server.ts with a raw body parser,
 * because signature verification needs the exact bytes Stripe signed.
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!PAYMENTS_ENABLED || !STRIPE_WEBHOOK_SECRET) {
    res.status(503).json({ error: 'Webhooks are not configured.' });
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    res.status(400).json({ error: 'Missing signature.' });
    return;
  }

  try {
    const stripe = await getStripe();
    const event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const orderId =
          Number(session.metadata?.['orderId']) || findOrderIdByStripeSession(session.id);
        if (orderId) markOrderPaid(orderId);
      }
    }

    res.json({ received: true });
  } catch (error) {
    // A bad signature means this did not come from Stripe. Say no and log it.
    console.error('Stripe webhook rejected:', error);
    res.status(400).json({ error: 'Signature verification failed.' });
  }
}

export const stripeWebhookRoute = raw({ type: 'application/json' });
export const webhookCurrency = CURRENCY;
