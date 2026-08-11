import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Render mode per route.
 *
 * Storefront pages are rendered on the server so search engines and slow
 * connections get complete HTML with real catalog content.
 *
 * Anything tied to a specific person is client-rendered instead. Rendering
 * happens before the browser sends its session cookie, so the server would draw
 * these pages as though nobody were signed in — a customer would see "we could
 * not find that order" or a login form flash past before hydration corrected
 * it. Client rendering shows an honest loading state instead.
 */
export const serverRoutes: ServerRoute[] = [
  { path: 'cart', renderMode: RenderMode.Client },
  { path: 'checkout/success', renderMode: RenderMode.Client },
  { path: 'account', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
