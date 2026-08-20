/** Shapes returned by the storefront API, mirrored on the client. */

export interface Product {
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

export interface User {
  id: number;
  email: string;
  name: string;
}

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

export interface OrderItem {
  name: string;
  slug: string;
  unitPriceCents: number;
  quantity: number;
  category: string;
}

export interface Order {
  reference: string;
  status: string;
  email: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  items: OrderItem[];
}

export interface Charity {
  name: string;
  tagline: string;
  donateUrl: string;
  siteUrl: string;
  ein: string;
}

export interface SiteConfig {
  paymentsEnabled: boolean;
  currency: string;
  shippingCents: number;
  freeShippingThresholdCents: number;
  charity: Charity;
}

/** Formats integer cents as US currency. */
export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
