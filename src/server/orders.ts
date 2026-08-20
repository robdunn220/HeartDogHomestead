/**
 * Order construction and pricing.
 *
 * Every price here is read out of the database. The browser only ever says
 * *which* variety and *how many* — never what it costs — so a tampered cart in
 * the client cannot change what the customer is charged.
 */

import { randomBytes } from 'node:crypto';

import { db } from './db';
import { CURRENCY, FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_CENTS } from './config';
import { sendMail } from './mail';
import { orderConfirmationEmail } from './email-templates';

export interface CartLine {
  slug: string;
  quantity: number;
}

export interface PricedLine {
  productId: number;
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
}

export class CartError extends Error {}

const MAX_QUANTITY_PER_LINE = 99;

/** Validates a client cart against the catalog and prices it server-side. */
export function priceCart(rawLines: unknown): PricedCart {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw new CartError('Your cart is empty.');
  }

  // Collapse duplicate slugs so a repeated line cannot slip past the cap.
  const wanted = new Map<string, number>();
  for (const raw of rawLines) {
    const slug = String((raw as CartLine)?.slug ?? '').trim();
    const quantity = Math.floor(Number((raw as CartLine)?.quantity ?? 0));

    if (!slug) throw new CartError('A cart item is missing its variety.');
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new CartError('Quantities must be at least 1.');
    }
    wanted.set(slug, (wanted.get(slug) ?? 0) + quantity);
  }

  const lines: PricedLine[] = [];
  let subtotalCents = 0;

  for (const [slug, quantity] of wanted) {
    if (quantity > MAX_QUANTITY_PER_LINE) {
      throw new CartError(`You can order at most ${MAX_QUANTITY_PER_LINE} of any one packet.`);
    }

    const product = db
      .prepare('SELECT id, slug, name, price_cents, stock FROM products WHERE slug = ?')
      .get(slug) as
      { id: number; slug: string; name: string; price_cents: number; stock: number } | undefined;

    if (!product) throw new CartError(`We no longer carry "${slug}".`);
    if (product.stock < quantity) {
      throw new CartError(
        `Only ${product.stock} packet${product.stock === 1 ? '' : 's'} of ${product.name} left.`,
      );
    }

    const lineTotalCents = product.price_cents * quantity;
    subtotalCents += lineTotalCents;
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      unitPriceCents: product.price_cents,
      quantity,
      lineTotalCents,
    });
  }

  const shippingCents = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;

  return {
    lines,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: CURRENCY,
  };
}

/** Human-friendly order reference, e.g. HDH-7Q2F4K. */
function newReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let suffix = '';
  for (const byte of bytes) suffix += alphabet[byte % alphabet.length];
  return `HDH-${suffix}`;
}

/** Writes a pending order and its line items in one transaction. */
export function createPendingOrder(
  cart: PricedCart,
  userId: number | null,
  email: string,
): { id: number; reference: string } {
  const reference = newReference();

  db.exec('BEGIN');
  try {
    const result = db
      .prepare(
        `INSERT INTO orders (reference, user_id, email, status, subtotal_cents, shipping_cents, total_cents, currency)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .run(
        reference,
        userId,
        email,
        cart.subtotalCents,
        cart.shippingCents,
        cart.totalCents,
        cart.currency,
      );

    const orderId = Number(result.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, name, slug, unit_price_cents, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const line of cart.lines) {
      insertItem.run(
        orderId,
        line.productId,
        line.name,
        line.slug,
        line.unitPriceCents,
        line.quantity,
      );
    }

    db.exec('COMMIT');
    return { id: orderId, reference };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function attachStripeSession(orderId: number, sessionId: string): void {
  db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(sessionId, orderId);
}

/**
 * Marks an order paid and draws down stock. Safe to call more than once —
 * Stripe can and does deliver the same webhook event twice, and a customer can
 * refresh the success page, so this must be idempotent.
 */
export function markOrderPaid(orderId: number): boolean {
  db.exec('BEGIN');
  try {
    const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as
      { id: number; status: string } | undefined;

    if (!order || order.status === 'paid') {
      db.exec('ROLLBACK');
      return false;
    }

    db.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(
      orderId,
    );

    const items = db
      .prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?')
      .all(orderId) as { product_id: number; quantity: number }[];

    const decrement = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
    for (const item of items) decrement.run(item.quantity, item.product_id);

    db.exec('COMMIT');

    // First time this order became paid: send the receipt. Fire-and-forget and
    // after the commit, so a mail failure can never roll back a paid order.
    sendOrderConfirmation(orderId);
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Loads a paid order and emails its confirmation. Never throws. */
function sendOrderConfirmation(orderId: number): void {
  try {
    const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as OrderRow | undefined;
    if (row) void sendMail(orderConfirmationEmail(toOrderDto(row)));
  } catch (error) {
    console.error(`Could not send order confirmation for order ${orderId}:`, error);
  }
}

export interface OrderDto {
  reference: string;
  status: string;
  email: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  items: {
    name: string;
    slug: string;
    unitPriceCents: number;
    quantity: number;
    category: string;
  }[];
}

function loadItems(orderId: number) {
  // Join the catalog for each line's category so the order history can filter
  // by seed type. LEFT JOIN + COALESCE keeps the line even if the product row
  // is ever removed.
  return db
    .prepare(
      `SELECT oi.name, oi.slug, oi.unit_price_cents, oi.quantity,
              COALESCE(p.category, '') AS category
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? ORDER BY oi.id`,
    )
    .all(orderId) as {
    name: string;
    slug: string;
    unit_price_cents: number;
    quantity: number;
    category: string;
  }[];
}

interface OrderRow {
  id: number;
  reference: string;
  email: string;
  status: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
}

/**
 * SQLite writes `datetime('now')` as "YYYY-MM-DD HH:MM:SS" in UTC, which is not
 * valid ISO 8601 and will not parse in a browser. Normalize on the way out.
 */
function toIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function toOrderDto(row: OrderRow): OrderDto {
  return {
    reference: row.reference,
    status: row.status,
    email: row.email,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    currency: row.currency,
    createdAt: toIso(row.created_at) ?? row.created_at,
    paidAt: toIso(row.paid_at),
    items: loadItems(row.id).map((item) => ({
      name: item.name,
      slug: item.slug,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
      category: item.category,
    })),
  };
}

export function listOrdersForUser(userId: number): OrderDto[] {
  // Only orders that actually went through. A pending row is created before the
  // Stripe redirect, so abandoned/canceled checkouts leave 'pending' rows that
  // should never appear in a customer's history. The success page looks orders
  // up by reference (findOrderByReference), so it still sees one mid-transition.
  const rows = db
    .prepare("SELECT * FROM orders WHERE user_id = ? AND status != 'pending' ORDER BY id DESC")
    .all(userId) as unknown as OrderRow[];
  return rows.map(toOrderDto);
}

export function findOrderByReference(
  reference: string,
): (OrderDto & { userId: number | null }) | null {
  const row = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference) as
    (OrderRow & { user_id: number | null }) | undefined;
  if (!row) return null;
  return { ...toOrderDto(row), userId: row.user_id };
}

export function findOrderIdByStripeSession(sessionId: string): number | null {
  const row = db.prepare('SELECT id FROM orders WHERE stripe_session_id = ?').get(sessionId) as
    { id: number } | undefined;
  return row ? row.id : null;
}
