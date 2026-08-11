import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CartStore } from './cart.store';

describe('CartStore', () => {
  let cart: CartStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    cart = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * Persistence and re-quoting happen in an effect, which runs on change
   * detection rather than synchronously with the signal write.
   */
  function flushEffects(): void {
    TestBed.tick();
  }

  /** Answers any pending quote requests so verify() stays clean. */
  function settleQuotes(): void {
    http.match('/api/checkout/quote').forEach((request) =>
      request.flush({
        cart: {
          lines: [],
          subtotalCents: 0,
          shippingCents: 0,
          totalCents: 0,
          currency: 'usd',
        },
      }),
    );
  }

  afterEach(() => {
    flushEffects();
    settleQuotes();
    http.verify();
  });

  it('starts empty', () => {
    expect(cart.isEmpty()).toBe(true);
    expect(cart.count()).toBe(0);
  });

  it('adds an item and counts it', () => {
    cart.add('cherokee-purple-tomato', 2);

    expect(cart.isEmpty()).toBe(false);
    expect(cart.count()).toBe(2);
    expect(cart.quantityOf('cherokee-purple-tomato')).toBe(2);
  });

  it('merges repeat additions of the same variety into one line', () => {
    cart.add('genovese-basil', 1);
    cart.add('genovese-basil', 3);

    expect(cart.lines().length).toBe(1);
    expect(cart.quantityOf('genovese-basil')).toBe(4);
  });

  it('caps a line at 99 packets', () => {
    cart.add('lemon-cucumber', 90);
    cart.add('lemon-cucumber', 40);

    expect(cart.quantityOf('lemon-cucumber')).toBe(99);
  });

  it('removes a line when its quantity drops below one', () => {
    cart.add('dragon-tongue-bean', 2);
    cart.setQuantity('dragon-tongue-bean', 0);

    expect(cart.isEmpty()).toBe(true);
  });

  it('clears everything', () => {
    cart.add('brandywine-tomato', 1);
    cart.add('chioggia-beet', 1);
    cart.clear();

    expect(cart.isEmpty()).toBe(true);
    expect(cart.quote()).toBeNull();
  });

  it('restores a persisted cart on the next visit', () => {
    cart.add('waltham-butternut-squash', 3);
    flushEffects();
    settleQuotes();

    // A fresh injector stands in for a page reload.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const restored = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);

    expect(restored.quantityOf('waltham-butternut-squash')).toBe(3);
  });

  it('ignores corrupt stored data rather than throwing', () => {
    localStorage.setItem('hdh.cart.v1', 'not json at all');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const restored = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);

    expect(restored.isEmpty()).toBe(true);
  });
});
