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
- Practice data is scoped per browser via an anonymous device id sent as the `X-Device-Id` header; API calls without it are treated as a distinct/guest scope.
- With Postgres configured, the schema is auto-applied on boot from `drizzle/schema.sql` (no manual migration step needed); `npm run db:push` is available for manual schema pushes.
- The service worker / PWA (`client/public/sw.js`) is production-only and not active in `npm run dev`.
- Optional Python scripts under `script/` (voice/asset generation) and the Playwright demo scripts are content pipelines, not needed to run or test the app.
- **Subscription compliance:** cancel is two taps from Home (`/` → `/cancel/confirm` → Confirm). Public instructions at `/cancel`. Consent audit + paywall HTML snapshots live under `.data/` (`billing-consent-audit.jsonl`, `billing-paywall-snapshots/`). Renewal reminders run via `startBillingScheduler()` (every 6h). Seed a demo entitlement locally with `POST /api/billing/demo-subscribe`. Email uses `RESEND_API_KEY` or `EMAIL_WEBHOOK_URL` (otherwise logs).
