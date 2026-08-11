/** Assembles every /api route onto one router. */

import { Router, json } from 'express';

import { publicConfig } from './config';
import { authRouter } from './routes/auth.routes';
import { productsRouter } from './routes/products.routes';
import { ordersRouter } from './routes/orders.routes';
import { checkoutRouter, stripeWebhookHandler, stripeWebhookRoute } from './routes/checkout.routes';

export const apiRouter = Router();

// The webhook must see the unparsed body for signature verification, so it is
// registered before the JSON parser below.
apiRouter.post('/stripe/webhook', stripeWebhookRoute, stripeWebhookHandler);

apiRouter.use(json({ limit: '64kb' }));

apiRouter.get('/config', (_req, res) => res.json(publicConfig()));
apiRouter.use('/auth', authRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/checkout', checkoutRouter);

apiRouter.use((_req, res) => {
  res.status(404).json({ error: 'No such endpoint.' });
});
