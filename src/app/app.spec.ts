import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { App } from './app';

describe('App shell', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // The shell asks who is signed in and for site config on startup.
    http.match('/api/auth/me').forEach((request) => request.flush({ user: null }));
    http.match('/api/config').forEach((request) =>
      request.flush({
        paymentsEnabled: false,
        currency: 'usd',
        shippingCents: 495,
        freeShippingThresholdCents: 3500,
        charity: {
          name: 'Test Rescue',
          tagline: '',
          donateUrl: 'https://example.org/donate',
          siteUrl: 'https://example.org',
          ein: '',
        },
      }),
    );
    http.verify();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the storefront brand and primary navigation', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;

    // The name is split across two spans for the script/caps treatment, so the
    // full phrase lives on the label that assistive tech actually reads.
    expect(compiled.querySelector('.brand-text')?.getAttribute('aria-label')).toBe(
      'Heart Dog Homestead Heirloom Seeds',
    );
    expect(compiled.querySelector('.brand-name')?.textContent).toContain('Heart Dog');
    expect(compiled.querySelector('.brand-sub')?.textContent).toContain('Homestead');

    const navLabels = [...compiled.querySelectorAll('#primary-nav a')].map((link) =>
      link.textContent?.trim(),
    );
    expect(navLabels.some((label) => label?.includes('Shop'))).toBe(true);
    expect(navLabels.some((label) => label?.includes('Give Back'))).toBe(true);
    expect(navLabels.some((label) => label?.includes('Cart'))).toBe(true);
  });

  it('offers sign in while signed out', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const navText = compiled.querySelector('#primary-nav')?.textContent ?? '';
    expect(navText).toContain('Sign in');
    expect(navText).not.toContain('Sign out');
  });
});
