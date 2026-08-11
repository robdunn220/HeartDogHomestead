/** Catalog routes. Read-only and public. */

import { Router } from 'express';

import { db } from '../db';

export const productsRouter = Router();

/** Shape sent to the browser — snake_case columns mapped to camelCase. */
export interface ProductDto {
  id: number;
  slug: string;
  name: string;
  botanicalName: string;
  category: string;
  blurb: string;
  description: string;
  priceCents: number;
  seedCount: string;
  daysToMaturity: string;
  sun: string;
  spacing: string;
  plantingDepth: string;
  height: string;
  originNote: string;
  stock: number;
  featured: boolean;
  accent: string;
  motif: string;
}

interface ProductRow {
  id: number;
  slug: string;
  name: string;
  botanical_name: string;
  category: string;
  blurb: string;
  description: string;
  price_cents: number;
  seed_count: string;
  days_to_maturity: string;
  sun: string;
  spacing: string;
  planting_depth: string;
  height: string;
  origin_note: string;
  stock: number;
  featured: number;
  accent: string;
  motif: string;
}

export function toProductDto(row: ProductRow): ProductDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    botanicalName: row.botanical_name,
    category: row.category,
    blurb: row.blurb,
    description: row.description,
    priceCents: row.price_cents,
    seedCount: row.seed_count,
    daysToMaturity: row.days_to_maturity,
    sun: row.sun,
    spacing: row.spacing,
    plantingDepth: row.planting_depth,
    height: row.height,
    originNote: row.origin_note,
    stock: row.stock,
    featured: row.featured === 1,
    accent: row.accent,
    motif: row.motif,
  };
}

productsRouter.get('/', (req, res) => {
  const category = typeof req.query['category'] === 'string' ? req.query['category'] : '';
  const search = typeof req.query['q'] === 'string' ? req.query['q'].trim() : '';

  const clauses: string[] = [];
  const params: string[] = [];

  if (category && category !== 'All') {
    clauses.push('category = ?');
    params.push(category);
  }
  if (search) {
    clauses.push('(name LIKE ? OR blurb LIKE ? OR botanical_name LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT * FROM products ${where} ORDER BY featured DESC, name ASC`)
    .all(...params) as unknown as ProductRow[];

  res.json({ products: rows.map(toProductDto) });
});

productsRouter.get('/categories', (_req, res) => {
  const rows = db
    .prepare('SELECT category, COUNT(*) AS count FROM products GROUP BY category ORDER BY category')
    .all() as { category: string; count: number }[];
  res.json({ categories: rows });
});

productsRouter.get('/:slug', (req, res) => {
  const row = db
    .prepare('SELECT * FROM products WHERE slug = ?')
    .get(String(req.params['slug'])) as ProductRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'We do not carry that variety.' });
    return;
  }
  res.json({ product: toProductDto(row) });
});
