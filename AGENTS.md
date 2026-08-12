# AGENTS.md

## Cursor Cloud specific instructions

Sadhana is a single full-stack app (no monorepo): a React + Vite client, an
Express API, and shared Drizzle types. The Express server and the Vite client
run in one process — there is no separate frontend dev server.

### Services

| Service | Command | Notes |
| --- | --- | --- |
| Web app (Express API + Vite dev/HMR) | `npm run dev` | Serves API (`/api/*`), health (`/healthz`), and the React SPA on one port. Open http://localhost:5000 |

- Standard scripts live in `package.json` (`dev`, `build`, `start`, `check`, `test`). CI runs `npm run check` then `npm test` (see `.github/workflows/ci.yml`).
- There is no linter configured; `npm run check` (tsc, no emit) is the closest lint-equivalent.

### Non-obvious caveats

- The dev server listens on port **5000** by default (not the `PORT=10000` shown in `.env.example`, which is for production/Render). Override with the `PORT` env var if needed.
- **Postgres is optional locally.** If `DATABASE_URL` is unset, the server logs `DATABASE_URL unset — using in-memory store` and runs fully with an in-memory store that resets on restart. Guest practice, pose browsing, and guided sessions all work without a database. Set `DATABASE_URL` only when you need cross-restart persistence or to test account signup/login sync.
- Practice data is scoped per browser via a **server-issued** device id. The HttpOnly `sadhana_device` cookie is authoritative; `X-Device-Id` alone cannot adopt another guest’s UUID (HMAC `X-Device-Proof` required when recovering without a cookie). Signed-in sessions use `user:<id>` and ignore device spoofing.
- **Rate limits:** strict on auth login/signup/reset/verify; `/api/auth/me` 120/min; mutating `/api/*` 90/min; account export/wipe 20/hour.
- Unknown `/api/*` and `/audio/*` (and legacy `/voice/*`) routes return **JSON 404** (never the SPA HTML shell) in both Vite and production static modes. Narration files live on disk under `client/public/voice/` but are served at **`/audio/`** (canonical) and `/voice/` (alias) via `server/mountStaticMedia.ts`.
- Pose media discovery: `GET /api/poses/:slug/media` → `{ video, audio: {url, source: human|neural, cues:[{t,text}]} | null }` (`server/poseMediaManifest.ts`). Client helpers in `client/src/lib/poseMediaApi.ts` — prefer these over guessing paths.
- **Narration priority (GuidedSession):** human MP3 → neural MP3 (disk or `POST /api/poses/:slug/tts` cache) → `speechSynthesis` only if `allowRobotVoice` → silent captions. Cue list shape `{t,text}[]`. Mute keeps the timer; pace is Slow/Normal. TTS provider via `TTS_PROVIDER` + API keys (see `.env.example`).
- CSP `script-src` is `'self'` + the hashed theme boot script (no `'unsafe-inline'` for scripts). `style-src` still allows `'unsafe-inline'` for React `style={}`.
- **Hosting:** Render free tier cold-starts ~30–50s after idle — use a paid/always-on instance before public launch. Set `PUBLIC_APP_URL` to a real custom domain (not `*.onrender.com`); HTML OG/canonical + `/robots.txt` are rewritten from that value at serve time.
- **Error monitoring:** `@sentry/node` + `@sentry/react` when `SENTRY_DSN` / `VITE_SENTRY_DSN` are set. Also `POST /api/client-errors` + ErrorBoundary beacons. PostHog is product analytics only.
- **Images / CLS:** `PoseImage` uses `<picture>` WebP + PNG fallback (`npm run gen:pose-webp`), reserves `aspect-ratio` (default 1:2 for 600×1200 sources), and sets intrinsic width/height. Raw pose `<img>` tags should also set width/height (or aspect-ratio) and `loading`.
- With Postgres configured, the schema is auto-applied on boot from `drizzle/schema.sql` (no manual migration step needed); `npm run db:push` is available for manual schema pushes.
- **`/healthz` is DB-aware.** It returns 200 only when `storage.ping()` succeeds (always true in memory mode; `SELECT 1` against Postgres otherwise). A DB outage returns 503 so Render stops routing to a broken instance.
- Stripe entitlements live in the `entitlements` table (not `.data/billing-entitlements.json`). Boot runs an idempotent JSON→Postgres import via `migrateBillingEntitlements()`.
- The service worker / PWA (`client/public/sw.js`) is production-only and not active in `npm run dev`.
- Optional Python scripts under `script/` (voice/asset generation) and the Playwright demo scripts are content pipelines, not needed to run or test the app.
- **Marketing UX:** `/welcome` is quiz-first (primary CTA → `/start`). `/start` and `/verify` are chrome-free (no sidebar). Completing the quiz calls `loadSession` via `client/src/data/quizPlan.ts` so “Start my first session” opens a real guided queue. Landing program tiles pass `?ref=program-*` seeds into the quiz.
- **Pose presentation videos:** every catalog pose has `client/public/videos/poses/{slug}.{webm,mp4}` (regen with `npm run gen:pose-videos`). Idle detail / library / search / trainer show looping clips; active teaching uses illustrated/3D (`PoseTrainerStage`). Kids clips: `npm run gen:kids-pose-videos`. See `docs/pose-videos.md`.
- **Accounts:** `POST /api/auth/signup` creates an unverified user and does **not** set a session cookie. Users must hit `/verify` (email link or pasted code) via `POST /api/auth/verify-email` before login. Non-production also returns `verifyToken` / `resetToken` in JSON for local flows. Existing Postgres users get `email_verified = true` via the schema default/ALTER.
- **Transactional email** (`server/email.ts`): Resend → `EMAIL_WEBHOOK_URL` → console log. Kinds: `verify`, `welcome`, `password_reset`, `password_changed`, `account_deleted`, `subscription_started`, `cancel_confirm`, `renewal_reminder`, `payment_failed`, `refund_confirm`. Billing renewal reminders also run via `startBillingScheduler` / `POST /api/billing/dispatch-renewal-reminders`.
- **Product analytics:** shared taxonomy + metric math live in `funnel/`. Client capture is `client/src/lib/productAnalytics.ts` (PostHog via `posthog-js` when `VITE_PUBLIC_POSTHOG_KEY` is set; always buffers locally). Server purchase/cancel capture is `server/productAnalytics.ts`. Acquisition quiz: `/start`. Operator dashboard: `/analytics/funnel` (works offline with demo data; set PostHog host to `https://eu.i.posthog.com` for EU).
- **Subscription compliance:** cancel is two taps from Home (`/` → `/cancel/confirm` → Confirm). Public instructions at `/cancel`. Live entitlement/consent state for cancel + refunds lives in `server/billingStore.ts` (`.data/`). Consent audit + paywall HTML snapshots: `billing-consent-audit.jsonl`, `billing-paywall-snapshots/`. Seed a demo entitlement with `POST /api/billing/demo-subscribe`.
