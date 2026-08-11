/**
 * Thin typed wrapper over the storefront API.
 *
 * `API_BASE` is empty in the browser (same-origin requests) and an absolute
 * origin during server-side rendering, where a relative URL has nothing to
 * resolve against. See app.config.server.ts.
 */

import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import type { Order, PricedCart, Product, CartLine, SiteConfig, User } from './models';

export const API_BASE = new InjectionToken<string>('API_BASE', {
  providedIn: 'root',
  factory: () => '',
});

export interface CheckoutSessionResponse {
  simulated: boolean;
  reference: string;
  url: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE);

  private url(path: string): string {
    return `${this.base}/api${path}`;
  }

  config(): Observable<SiteConfig> {
    return this.http.get<SiteConfig>(this.url('/config'));
  }

  products(options: { category?: string; q?: string } = {}): Observable<{ products: Product[] }> {
    const params: Record<string, string> = {};
    if (options.category && options.category !== 'All') params['category'] = options.category;
    if (options.q) params['q'] = options.q;
    return this.http.get<{ products: Product[] }>(this.url('/products'), { params });
  }

  product(slug: string): Observable<{ product: Product }> {
    return this.http.get<{ product: Product }>(this.url(`/products/${encodeURIComponent(slug)}`));
  }

  categories(): Observable<{ categories: { category: string; count: number }[] }> {
    return this.http.get<{ categories: { category: string; count: number }[] }>(
      this.url('/products/categories'),
    );
  }

  register(body: { name: string; email: string; password: string }): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(this.url('/auth/register'), body, {
      withCredentials: true,
    });
  }

  login(body: { email: string; password: string }): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(this.url('/auth/login'), body, {
      withCredentials: true,
    });
  }

  logout(): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      this.url('/auth/logout'),
      {},
      {
        withCredentials: true,
      },
    );
  }

  me(): Observable<{ user: User | null }> {
    return this.http.get<{ user: User | null }>(this.url('/auth/me'), { withCredentials: true });
  }

  quote(items: CartLine[]): Observable<{ cart: PricedCart }> {
    return this.http.post<{ cart: PricedCart }>(this.url('/checkout/quote'), { items });
  }

  createCheckoutSession(items: CartLine[], email: string): Observable<CheckoutSessionResponse> {
    return this.http.post<CheckoutSessionResponse>(
      this.url('/checkout/session'),
      { items, email },
      { withCredentials: true },
    );
  }

  confirmCheckout(sessionId: string): Observable<{ confirmed: boolean }> {
    return this.http.post<{ confirmed: boolean }>(this.url('/checkout/confirm'), { sessionId });
  }

  orders(): Observable<{ orders: Order[] }> {
    return this.http.get<{ orders: Order[] }>(this.url('/orders'), { withCredentials: true });
  }

  order(reference: string): Observable<{ order: Order }> {
    return this.http.get<{ order: Order }>(this.url(`/orders/${encodeURIComponent(reference)}`), {
      withCredentials: true,
    });
  }
}

/** Pulls a readable message out of an HttpErrorResponse-shaped value. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const body = (error as { error?: { error?: string } })?.error;
  return typeof body?.error === 'string' ? body.error : fallback;
}
