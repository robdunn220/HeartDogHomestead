/**
 * The shopping cart.
 *
 * Only slugs and quantities live here. Prices shown in the cart come from the
 * server's quote endpoint, so what the customer sees is always what the server
 * would charge — editing localStorage changes nothing but your own display.
 */

import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import type { CartLine, PricedCart } from './models';
import { ApiService } from './api.service';

const STORAGE_KEY = 'hdh.cart.v1';
const MAX_PER_LINE = 99;

@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly api = inject(ApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly linesSignal = signal<CartLine[]>(this.restore());

  /** Slug/quantity pairs, the canonical cart contents. */
  readonly lines = this.linesSignal.asReadonly();

  /** Total number of packets, for the header badge. */
  readonly count = computed(() => this.linesSignal().reduce((sum, l) => sum + l.quantity, 0));

  readonly isEmpty = computed(() => this.linesSignal().length === 0);

  /** Server-priced view of the cart; null until the first quote lands. */
  private readonly quoteSignal = signal<PricedCart | null>(null);
  readonly quote = this.quoteSignal.asReadonly();

  private readonly quotingSignal = signal(false);
  readonly quoting = this.quotingSignal.asReadonly();

  private readonly quoteErrorSignal = signal<string | null>(null);
  readonly quoteError = this.quoteErrorSignal.asReadonly();

  constructor() {
    // Persist on every change, and keep the priced quote in step with it.
    effect(() => {
      const lines = this.linesSignal();
      if (!this.isBrowser) return;

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
      } catch {
        // Private browsing or a full quota — the cart still works in memory.
      }
      this.refreshQuote(lines);
    });
  }

  quantityOf(slug: string): number {
    return this.linesSignal().find((l) => l.slug === slug)?.quantity ?? 0;
  }

  add(slug: string, quantity = 1): void {
    this.linesSignal.update((lines) => {
      const existing = lines.find((l) => l.slug === slug);
      if (existing) {
        return lines.map((l) =>
          l.slug === slug ? { ...l, quantity: clamp(l.quantity + quantity) } : l,
        );
      }
      return [...lines, { slug, quantity: clamp(quantity) }];
    });
  }

  setQuantity(slug: string, quantity: number): void {
    if (quantity < 1) {
      this.remove(slug);
      return;
    }
    this.linesSignal.update((lines) =>
      lines.map((l) => (l.slug === slug ? { ...l, quantity: clamp(quantity) } : l)),
    );
  }

  remove(slug: string): void {
    this.linesSignal.update((lines) => lines.filter((l) => l.slug !== slug));
  }

  clear(): void {
    this.linesSignal.set([]);
    this.quoteSignal.set(null);
  }

  private refreshQuote(lines: CartLine[]): void {
    if (lines.length === 0) {
      this.quoteSignal.set(null);
      this.quoteErrorSignal.set(null);
      this.quotingSignal.set(false);
      return;
    }

    this.quotingSignal.set(true);
    this.api.quote(lines).subscribe({
      next: ({ cart }) => {
        this.quoteSignal.set(cart);
        this.quoteErrorSignal.set(null);
        this.quotingSignal.set(false);
      },
      error: (error: unknown) => {
        const message = (error as { error?: { error?: string } })?.error?.error;
        this.quoteErrorSignal.set(message ?? 'We could not price your cart just now.');
        this.quotingSignal.set(false);
      },
    });
  }

  private restore(): CartLine[] {
    if (!this.isBrowser) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter(
          (l): l is CartLine =>
            typeof (l as CartLine)?.slug === 'string' && Number.isFinite((l as CartLine)?.quantity),
        )
        .map((l) => ({ slug: l.slug, quantity: clamp(Math.floor(l.quantity)) }))
        .filter((l) => l.quantity > 0);
    } catch {
      return [];
    }
  }
}

function clamp(quantity: number): number {
  return Math.min(MAX_PER_LINE, Math.max(1, quantity));
}
