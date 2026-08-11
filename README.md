# Heart Dog Homestead — Heirloom Seeds

A seed storefront: catalog, cart, customer accounts, Stripe checkout, and a donation page that
sends visitors to a dog rescue.

Built on Angular 22 with server-side rendering. The same Express process that renders the pages
also serves the API, so there is one thing to deploy and one thing to keep running.

---

## Running it

```bash
npm install
npm run build
npm run serve:ssr
```

Then open <http://localhost:4000>.

For development with live reload:

```bash
npm start          # http://localhost:4000, rebuilds on save
```

The database is created and seeded with 22 varieties the first time the server starts. Nothing else
to set up.

Other commands:

```bash
npm test           # unit tests
npm run typecheck  # type check without emitting
npm run format     # prettier
```

---

## Payments

**Out of the box, checkout is simulated.** With no Stripe key configured, an order is recorded and
no card is charged. Every page that touches payment says so plainly, so this is safe to demo but
must not be left this way in production.

To take real payments:

1. Copy `.env.example` to `.env`.
2. Put your key in `STRIPE_SECRET_KEY` (from <https://dashboard.stripe.com/apikeys>). Start with a
   `sk_test_` key.
3. Forward webhooks while developing, and copy the signing secret it prints into
   `STRIPE_WEBHOOK_SECRET`:

   ```bash
   stripe listen --forward-to localhost:4000/api/stripe/webhook
   ```

4. Rebuild and restart. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.

In production, create a webhook endpoint in the Stripe dashboard pointing at
`https://your-domain/api/stripe/webhook`, subscribed to `checkout.session.completed`.

**The webhook is not optional.** An order is marked paid by the webhook, or by an explicit
server-to-server confirmation of the session — never by the browser arriving at the success URL,
since anyone can navigate to that. Without a webhook configured, orders paid on Stripe's page will
sit in `pending`.

---

## How it is put together

```
src/
  server.ts                    Express entry: mounts /api, then Angular SSR
  server/
    config.ts                  Environment-driven settings; publicConfig() is what the browser sees
    db.ts                      SQLite schema and first-run seeding
    seed-catalog.ts            The 22 starting varieties — edit freely
    auth.ts                    scrypt hashing, session cookies, route guards
    orders.ts                  Cart pricing, order creation, marking paid
    stripe.ts                  Lazily constructed Stripe client
    api.ts                     Assembles every route onto one router
    routes/                    auth, products, orders, checkout (+ webhook)
  app/
    core/                      API client, cart store, auth store, config store, route guard
    shared/                    Packet artwork, product card
    pages/                     home, shop, product-detail, cart, checkout-success,
                               donate, login, register, account, not-found
```

Persistence is `node:sqlite`, built into Node — no native module to compile, no database server to
run. The file lives at `data/heartdog.db` and is gitignored.

**Render modes** are set per route in `src/app/app.routes.server.ts`. Storefront pages are rendered
on the server, so the catalog arrives as real HTML for search engines and slow connections. Pages
tied to one person — cart, account, checkout confirmation, sign in — are client-rendered, because
rendering happens before the browser sends its session cookie and the server would otherwise draw
them as though nobody were signed in.

Product artwork is generated as inline SVG from a `motif` and `accent` color on each row. There are
no image files to host or lose.

### Security decisions worth knowing

- **Prices are never taken from the browser.** The cart stores only slugs and quantities; the
  server looks up every price in the catalog. A tampered cart in localStorage changes nothing but
  the attacker's own display.
- **Passwords** are hashed with scrypt and a per-user random salt, and compared in constant time.
- **Sessions** are random opaque tokens in the database, handed out in an `httpOnly`, `sameSite=lax`
  cookie — unreadable to scripts and revocable server-side. They are marked `secure` when
  `NODE_ENV=production`.
- **Order lookup** by reference is scoped: an order attached to an account is never shown to a
  different account.
- **Webhook signatures** are verified against the raw request body; unsigned requests are rejected.

---

## Configuration

Everything is environment variables — see `.env.example` for the annotated list. Nothing needs
setting to run locally.

The ones you will actually want to change:

| Variable | What it does |
| --- | --- |
| `SITE_URL` | Public origin. Must match what customers use — Stripe return URLs are built from it. |
| `STRIPE_SECRET_KEY` | Blank means simulated checkout. Set it to take real payments. |
| `STRIPE_WEBHOOK_SECRET` | Required for orders to be marked paid. |
| `SHIPPING_CENTS` | Flat shipping, in cents. Default 495. |
| `FREE_SHIPPING_THRESHOLD_CENTS` | Subtotal above which shipping is free. Default 3500. |
| `CHARITY_*` | Name, tagline, and donate link for the rescue on the donation page. |
| `DATABASE_PATH` | Where the SQLite file lives. Put it on a persistent volume in production. |

### The donation page

It links out to whichever charity `CHARITY_DONATE_URL` points at. Money goes to them directly —
this site never collects donations, adds a checkout round-up, or claims a portion of sales goes
anywhere. That keeps you clear of handling funds on another organization's behalf, which would
bring bookkeeping and, in many states, charitable-solicitation registration.

Change the featured rescue by editing the `CHARITY_*` variables. No page code to touch.

---

## Before going live

- [ ] Set `STRIPE_SECRET_KEY` to a live key and configure the production webhook endpoint.
- [ ] Set `NODE_ENV=production` so session cookies are marked `secure`.
- [ ] Set `SITE_URL` to your real `https://` origin.
- [ ] Add your domain to `security.allowedHosts` in `angular.json` — Angular rejects unrecognized
      `Host` headers, and the list currently holds only `localhost` and `127.0.0.1`.
- [ ] Serve over HTTPS. Session cookies marked `secure` will not be sent over plain HTTP.
- [ ] Put `data/` on a persistent volume, and back it up — it holds every customer and order.
- [ ] Replace the `CHARITY_*` placeholders with the real rescue.
- [ ] Fill in real shipping, refund, and privacy copy before taking money from anyone.

### Not built yet

Worth knowing what is missing, in rough order of how soon you will want it:

- **Password reset.** There is no "forgot password" flow, which means a locked-out customer needs
  you to intervene. This needs an email sender.
- **Order confirmation emails.** The confirmation page shows the receipt, but nothing is emailed.
- **Admin screens.** Editing the catalog and stock currently means editing `seed-catalog.ts` and
  re-seeding, or writing SQL against `data/heartdog.db`.
- **Shipping rates by weight or destination.** Shipping is one flat rate with a free threshold.
- **Sales tax.** Not calculated. Stripe Tax can do this if you need it.
- **Rate limiting** on login and registration.
