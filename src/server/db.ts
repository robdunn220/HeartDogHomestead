/**
 * SQLite persistence, built on Node's own `node:sqlite` module — no native
 * add-on to compile, no external database to run.
 *
 * The schema is created on first import and the seed catalog is inserted only
 * when the products table is empty, so restarts never clobber edited data.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { DATABASE_PATH } from './config';
import { SEED_CATALOG } from './seed-catalog';

const dbPath = resolve(DATABASE_PATH);
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);

// WAL keeps reads from blocking behind the write that follows a checkout.
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS password_resets (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

  CREATE TABLE IF NOT EXISTS products (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    slug              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    botanical_name    TEXT NOT NULL DEFAULT '',
    category          TEXT NOT NULL,
    blurb             TEXT NOT NULL DEFAULT '',
    description       TEXT NOT NULL DEFAULT '',
    price_cents       INTEGER NOT NULL,
    seed_count        TEXT NOT NULL DEFAULT '',
    days_to_maturity  TEXT NOT NULL DEFAULT '',
    sun               TEXT NOT NULL DEFAULT '',
    spacing           TEXT NOT NULL DEFAULT '',
    planting_depth    TEXT NOT NULL DEFAULT '',
    height            TEXT NOT NULL DEFAULT '',
    origin_note       TEXT NOT NULL DEFAULT '',
    stock             INTEGER NOT NULL DEFAULT 0,
    featured          INTEGER NOT NULL DEFAULT 0,
    accent            TEXT NOT NULL DEFAULT '#4a7c59',
    motif             TEXT NOT NULL DEFAULT 'leaf'
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    reference           TEXT NOT NULL UNIQUE,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email               TEXT NOT NULL DEFAULT '',
    status              TEXT NOT NULL DEFAULT 'pending',
    subtotal_cents      INTEGER NOT NULL DEFAULT 0,
    shipping_cents      INTEGER NOT NULL DEFAULT 0,
    total_cents         INTEGER NOT NULL DEFAULT 0,
    currency            TEXT NOT NULL DEFAULT 'usd',
    stripe_session_id   TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at             TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id);

  CREATE TABLE IF NOT EXISTS order_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id        INTEGER NOT NULL REFERENCES products(id),
    name              TEXT NOT NULL,
    slug              TEXT NOT NULL,
    unit_price_cents  INTEGER NOT NULL,
    quantity          INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

seedProductsIfEmpty();

function seedProductsIfEmpty(): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number };
  if (row.count > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (
      slug, name, botanical_name, category, blurb, description, price_cents,
      seed_count, days_to_maturity, sun, spacing, planting_depth, height,
      origin_note, stock, featured, accent, motif
    ) VALUES (
      :slug, :name, :botanical_name, :category, :blurb, :description, :price_cents,
      :seed_count, :days_to_maturity, :sun, :spacing, :planting_depth, :height,
      :origin_note, :stock, :featured, :accent, :motif
    )
  `);

  db.exec('BEGIN');
  try {
    for (const p of SEED_CATALOG) {
      insert.run({
        ...p,
        featured: p.featured ? 1 : 0,
      });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  console.log(`Seeded ${SEED_CATALOG.length} products into ${dbPath}`);
}

/** Drop expired sessions. Called opportunistically on each auth lookup. */
export function pruneExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

/** Drop expired or already-used reset tokens. Called when one is requested. */
export function pruneExpiredResets(): void {
  db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL').run(
    Date.now(),
  );
}
