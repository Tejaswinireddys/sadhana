# Product analytics

Sadhana uses **PostHog** when configured (optional). With no key, nothing is
sent off-device; a local buffer still powers the in-app funnel dashboard in
development (`/analytics/funnel`).

## Env vars (Render)

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_PUBLIC_POSTHOG_KEY` | Build / client | Project API key (`phc_…`). **Unset = analytics off remotely.** |
| `VITE_PUBLIC_POSTHOG_HOST` | Build / client | Optional. Default `https://us.i.posthog.com`. Prefer EU (`https://eu.i.posthog.com`) or self-hosted. |
| `POSTHOG_API_KEY` | Server | Optional server capture for purchase / cancel (falls back to the Vite key). |
| `POSTHOG_HOST` | Server | Optional; same host default as above. |

Set the Vite vars on Render, then **redeploy** so the client bundle picks them
up. Never put secret write keys in `VITE_*` — the public project key is enough
for browser capture.

## Privacy

- **No key** → no remote SDK load, no network calls.
- **Do Not Track** (`navigator.doNotTrack === "1"`) or **Global Privacy Control**
  → PostHog never initialises; no remote events.
- **Settings → “Share anonymous product events”** (off by default) opts into
  practice / class events remotely. Toggling syncs PostHog’s own opt-out flag.
- Acquisition funnel events (welcome, finder, paywall, checkout, signup,
  first open / return) may go remote when a key is set and DNT is off, even
  without Settings opt-in — anonymous drop-off measurement only.
- Payloads never include email, journal text, passwords, or injury notes
  (`sanitizeProps` strips those keys and long strings).

## Event taxonomy

Exact names live in `funnel/events.ts` (`PRODUCT_EVENTS`). Client capture:
`captureProduct` in `client/src/lib/productAnalytics.ts`. Server purchase /
cancel: `server/productAnalytics.ts`.

| Event | When | Key properties |
| --- | --- | --- |
| `welcome_viewed` | `/welcome` mounts | `path` |
| `quiz_started` | Finder (`/start`) begins | `flow_id`, optional `ref`, UTMs |
| `quiz_question_shown` | Each finder question | `flow_id`, `question_id`, `index` |
| `quiz_answered` | Answer chosen | `flow_id`, `question_id`, `answer`, `ms_on_screen` |
| `quiz_abandoned` | Leave mid-quiz | `flow_id`, `last_question_id` |
| `quiz_completed` | Finder finished | `flow_id`, `duration_ms` |
| `plan_revealed` | Plan screen after quiz | `flow_id` |
| `session_started` | Guided practice begins | `pathway`, `planned_minutes` |
| `session_completed` | Guided practice logged | `actual_minutes`, `poses_completed`, `poses_skipped` |
| `class_started` | Video class first plays | `slug`, `tier`, `minutes` |
| `class_completed` | Video reaches ~90% / complete | `slug`, `tier`, `minutes` |
| `signup_completed` | Account created | `needs_verification` |
| `paywall_viewed` | `/plus` with prices | `flow_id`, `price_shown`, `currency` |
| `checkout_started` | Subscribe clicked | `flow_id`, `plan` |
| `purchase_completed` | Webhook after paid Checkout | `flow_id`, `plan`, `amount`, `currency` |
| `subscription_cancelled` | Subscription deleted | `days_active`, `sessions_completed` |
| `app_first_open` | First visit on this browser | `source` (`landing` / `quiz` / `app`) |
| `app_return` | Later calendar day visit | `days_since_first_open` (D1 / D7 / …) |

## Retention (D1 / D7)

`app_first_open` stamps `sadhana.analytics.firstOpenAt`. On later loads,
`trackAppReturn` emits `app_return` at most once per local day with
`days_since_first_open`. Cohort math also lives in
`funnel/dashboardMetrics.ts` (`retentionByAcquisitionWeek`) for the operator
dashboard.

## Local dashboard

In development, `/analytics/funnel` reads the local buffer (and optional
PostHog HogQL). Production shows this-device metrics without operator controls.
