# Stripe go-live checklist

Switch Plus from Stripe **test** to **live** by environment variables only —
no code change and no redeploy of new logic. The server already reads
`STRIPE_MODE` and the matching key/price set (`server/stripeConfig.ts`); live
mode refuses to start until every live value is present and shaped correctly.

**Do not put secrets in `VITE_*` variables or commit them.**

Webhook path (both modes):

```text
https://sadhana-ou9m.onrender.com/api/billing/webhook
```

Events the app handles (idempotent via `stripe_events`):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Cancel and portal stay available in both modes: in-app two-tap cancel
(`/cancel` → `/cancel/confirm`) and `POST /api/billing/portal` (Stripe Customer
Portal). Copy on `/plus`, Help, Landing and gates follows the mode — test
banners appear only when `STRIPE_MODE` is not `live`.

---

## Owner steps in the Stripe Dashboard

1. **Activate the Stripe account** for live payments (business details, bank
   payouts, identity verification). Live keys stay unavailable until this is
   done.
2. **Toggle to Live mode** in the Dashboard (not Test).
3. **Create the Plus product** with two active, fixed **USD** recurring prices:
   - Monthly: `$9.99` every 1 month
   - Yearly: `$59.99` every 1 year  
   Copy the two `price_…` IDs.
4. **Customer Portal** (Settings → Billing → Customer portal): enable
   subscription management and cancel-at-period-end. Limit the catalog to the
   Plus prices if plan changes are allowed.
5. **Webhooks → Add endpoint**
   - URL: `https://sadhana-ou9m.onrender.com/api/billing/webhook`
   - Events: the five listed above
   - Copy the endpoint’s signing secret (`whsec_…`)

## Env vars to set on Render

Set these on the web service (Environment), then redeploy (or restart) so the
process loads them. Keep the existing test values in place under the
unprefixed / `STRIPE_TEST_*` names so you can flip back with `STRIPE_MODE=test`.

| Variable | Example shape | Notes |
| --- | --- | --- |
| `BILLING_ENABLED` | `true` | Required in both modes |
| `STRIPE_MODE` | `live` | Exact string `live` |
| `STRIPE_LIVE_SECRET_KEY` | `sk_live_…` or `rk_live_…` | Live secret only |
| `STRIPE_LIVE_PUBLISHABLE_KEY` | `pk_live_…` | Checked at boot; Checkout is server-redirect |
| `STRIPE_LIVE_WEBHOOK_SECRET` | `whsec_…` | From the **live** webhook endpoint |
| `STRIPE_LIVE_PRICE_MONTHLY` | `price_…` | Live monthly price id |
| `STRIPE_LIVE_PRICE_YEARLY` | `price_…` | Live yearly price id (must differ from monthly) |
| `BILLING_CANCEL_TOKEN_SECRET` | long random string | Set **before** flipping modes so email cancel links survive the switch |
| `PUBLIC_APP_URL` | `https://sadhana-ou9m.onrender.com` | Checkout success/cancel + portal return URLs |
| `DATABASE_URL` | Postgres URL | Required for durable entitlements / `stripe_events` |

Live mode never reads `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` /
`STRIPE_PRICE_*` (those hold test values). Missing or non-live shapes print
every problem at boot and exit — see README → Stripe.

## Smoke check after the flip

1. Confirm the boot log has no `[billing] Stripe configuration is invalid`.
2. `GET /api/billing/config` → `enabled: true`, `mode: "live"`, prices match
   `$9.99` / `$59.99`, and the status note is **not** the test-card wording.
3. Sign in with a verified email → `/plus` → Subscribe (real card) → return →
   wait for webhook → `/api/auth/me` shows `plan: "plus"`.
4. Cancel via Home → `/cancel/confirm`, and once via Manage subscription
   (portal). Access stays Plus until period end.
5. In Stripe live webhook logs, the five event types show `2xx` and no
   repeated failures (duplicates return `received` with no double entitlement).

## Flip back to test

Set `STRIPE_MODE=test` (or unset it). The unprefixed / `STRIPE_TEST_*` vars
take over again; live keys stay unused.
