/** Order history for the signed-in customer, plus single-order lookup. */

import { Router } from 'express';

import { attachUser, requireAuth, type AuthedRequest } from '../auth';
import { findOrderByReference, listOrdersForUser } from '../orders';

export const ordersRouter = Router();

ordersRouter.get('/', attachUser, requireAuth, (req: AuthedRequest, res) => {
  res.json({ orders: listOrdersForUser(req.user!.id) });
});

/**
 * Used by the confirmation page. A guest checkout has no account to check
 * against, so knowing the reference is what grants access — the reference is
 * random enough not to be guessable. A signed-in customer's order is never
 * shown to a different signed-in customer.
 */
ordersRouter.get('/:reference', attachUser, (req: AuthedRequest, res) => {
  const order = findOrderByReference(String(req.params['reference']));
  if (!order) {
    res.status(404).json({ error: 'No order with that reference.' });
    return;
  }

  if (order.userId !== null && order.userId !== req.user?.id) {
    res.status(404).json({ error: 'No order with that reference.' });
    return;
  }

  const { userId, ...dto } = order;
  res.json({ order: dto });
});
