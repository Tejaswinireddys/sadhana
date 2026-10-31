# AGENTS.md

Guidance for AI agents and contributors working in this repo. The first half
describes the project; the second half ("Cursor Cloud specific instructions")
holds the domain invariants that tests pin — read both before changing code.

## Ground rules

- **One small, focused change per PR.** One concern per PR — no drive-by
  refactors, renames, reformatting or dependency bumps mixed into a feature or
  fix. If you notice something else, open a separate PR.
- **Never break existing routes.** Every client path in `client/src/App.tsx`
  and every `/api/*` endpoint is public surface (bookmarks, emails, shared
  links, the PWA, tests). Do not remove, rename or change the meaning of one.
  If a path must move, keep the old one working (redirect or alias) — the
  legacy `/#/…` → `/…` rewrite in `client/src/main.tsx` and the `/voice/` →
  `/audio/` alias are the pattern. Adding a client route means also updating
  `KNOWN_TOP_LEVEL_SEGMENTS` in `server/static.ts` (otherwise it is served
  with HTTP 404) and, if public, `server/pageMetadata.ts` (sitemap/meta).
- Run `npm run check` and `npm test` before opening a PR; run
  `npm run test:e2e` when you touch routing, auth, or the guided player.
- Surfaces in `docs/architecture-invariants.md` (practice queue, guided timing,
  device ownership, account sessions, catalogs, ParentGate, theme/motion) are
  logic-stable: restyle freely, but don't rewrite their behaviour without an
  explicit product decision.

## Tech stack

- **Language:** TypeScript everywhere (`strict`), ESM (`"type": "module"`), Node 20.
- **Client:** React 18 + Vite 7, wouter (routing), TanStack Query v5 (server
  state), shadcn/ui (Radix primitives, "new-york" style) + Tailwind CSS 3,
  lucide-react icons, framer-motion, react-hook-form + zod, recharts, three.js
  (pose stages), hls.js (adaptive video).
- **Server:** Express 5 on `node:http`, Drizzle ORM over `pg` (Postgres) with an
  in-memory fallback store, zod validation, `node:crypto` for auth (no auth
  library), Stripe (billing, behind `BILLING_ENABLED`), web-push, Resend email.
- **Shared:** Drizzle table definitions + drizzle-zod insert schemas
  (`shared/schema.ts`), zod request schemas (`shared/validation.ts`), pure
  practice-stats math (`shared/practiceStats.ts`).
- **Observability:** Sentry (`@sentry/node`, `@sentry/react`), PostHog product
  analytics (`funnel/` taxonomy).
- **Testing:** `node:test` + `node:assert/strict` run through `tsx`; Playwright
  for E2E.
- **Hosting:** Render (`render.yaml`, `/healthz` health check) + managed Postgres.

## Folder structure

```
client/
  index.html, welcome.html   Vite entry HTML (app shell + lightweight landing)
  public/                    Static assets: poses/ (PNG+WebP), videos/, voice/
                             (narration MP3 + timings), captions/, kids/, sw.js
  src/
    main.tsx                 App bootstrap (hash-route redirect, SW, telemetry)
    LaunchApp.tsx            Picks Landing vs. the lazy-loaded workspace
    App.tsx                  Providers + the wouter <Switch> (all routes)
    welcome.tsx              Entry for welcome.html
    pages/                   One component per route (PascalCase.tsx)
    components/              Feature components; ui/ = shadcn primitives
    context/                 React contexts (Practice, KidsGate, RecentSearches)
    hooks/                   Reusable hooks (use-*.ts / useX.ts)
    lib/                     Domain logic + helpers, colocated *.test.ts
    data/                    Pose catalog, programs, media manifests;
                             *.generated.* files are script output — don't hand-edit
    index.css                Tailwind layers + design tokens (CSS variables)
server/
  index.ts                   Express app, middleware order, boot sequence
  routes.ts                  Core /api routes (auth, sessions, journal, …)
  platformApi.ts, push.ts, billing.ts, buddy.ts, teachersWaitlist.ts
                             Feature route modules (register*Routes(app))
  auth.ts, owner.ts          Password/session crypto; device/user ownership
  security.ts                Helmet-style headers, CSP, rate limits
  storage.ts                 IStorage + DatabaseStorage + MemoryStorage
  static.ts, vite.ts         Production static serving / dev Vite middleware
  *.test.ts                  Server unit tests (colocated)
shared/                      Code imported by both client and server
funnel/                      Analytics event taxonomy + funnel metrics
drizzle/schema.sql           Idempotent schema auto-applied on boot
script/                      Build script + content pipelines (TS/Python)
e2e/                         Playwright specs
docs/                        Design/production docs referenced below
```

Path aliases (tsconfig + Vite): `@/` → `client/src/`, `@shared/` → `shared/`,
`@funnel/` → `funnel/`.

## Run, build and test locally

```bash
npm install
npm run dev          # Express API + Vite HMR on http://localhost:5000
npm run check        # tsc --noEmit (the closest thing to a linter)
npm test             # node:test unit suite via tsx (explicit file list)
npm run test:e2e     # Playwright; boots `npm run dev` itself
npm run build        # Vite client → dist/public, esbuild server → dist/index.cjs
npm start            # serve the production build (NODE_ENV=production)
```

- No `.env` is needed for local dev: without `DATABASE_URL` the server uses an
  in-memory store. Copy `.env.example` to `.env` only for Postgres, email,
  billing, TTS, Sentry or PostHog.
- On macOS, AirPlay Receiver may hold port 5000 (returns 403). Use
  `PORT=5055 npm run dev` / `E2E_PORT=5055 npx playwright test`.
- **`npm test` does not glob.** A new `*.test.ts` file must be added to the
  `test` script in `package.json` or it never runs (in CI either).
- CI (`.github/workflows/ci.yml`): `npm ci` → `npm run check` → `npm test`, plus
  a separate Playwright job.

## Routing

**Client** — wouter, real paths (no hash routing). All routes live in
`AppRouter` in `client/src/App.tsx`; every page except Home/Landing/Register is
`lazy()`-loaded and wrapped in `Suspense` + a per-route `ErrorBoundary`.
Dynamic segments use `:slug` (`/asanas/:slug`, `/pathways/:slug`, `/kids/:slug`,
`/kids/breath/:slug`). Some routes are conditional: `/analytics/funnel` and
`/design-system` are dev-only (`import.meta.env.DEV`); `/cancel` and
`/cancel/confirm` exist only when `BILLING_ENABLED`. Marketing paths
(`MARKETING_PATHS`) render without the app chrome. First-time visitors to `/`
are sent to `/welcome`. Navigate with wouter's `useLocation` / `<Link>`.

**Server** — Express. Middleware order in `server/index.ts` matters:
security → body parsers → `/healthz`, `/sitemap.xml` → request logging →
`registerRoutes` (mounts `ownerMiddleware` on `/api`) and the feature
`register*Routes(app)` modules → JSON 404 for unknown `/api/*` → error handler
→ Vite (dev) or `serveStatic` (prod) SPA fallback. New API routes must be
registered before the `/api` JSON-404 catch-all.

## Auth and data ownership

- Accounts are **optional**. Every request gets an owner: a guest device id
  (signed HttpOnly `sadhana_device` cookie, echoed via `X-Device-Id` /
  `X-Device-Proof`) or, with a valid `sadhana_session` cookie, `user:<id>`.
  `ownerMiddleware` (`server/owner.ts`) sets `req.ownerId`, `req.deviceOwnerId`
  and `req.userId`; route handlers scope all reads/writes by `req.ownerId`.
- Passwords are scrypt-hashed and sessions are opaque random tokens stored
  server-side (`server/auth.ts`) so logout/wipe revokes immediately. Reset,
  verify and recovery tokens are stored hashed.
- Client: `useAuth()` in `client/src/lib/auth.ts` (query key `/api/auth/me`).
  Sign in/out calls `queryClient.resetQueries()` because every cached query
  belongs to the previous owner.
- All client API calls go through `apiRequest` / the default `queryFn` in
  `client/src/lib/queryClient.ts` (adds device headers, `credentials: "include"`,
  timeout). Query keys are the URL path, e.g. `["/api/sessions"]`.
- Signup/verification/recovery behaviour is detailed in the section below.

## Styling

- Tailwind CSS 3 (`tailwind.config.ts`, PostCSS) with `darkMode: ["class"]`.
- Design tokens are HSL CSS variables in `client/src/index.css` (`:root` and
  `.dark`) exposed as Tailwind colors (`bg-background`, `text-foreground`,
  `bg-primary`, `border-card-border`, …). Use tokens, not hard-coded colours.
  Fonts: Raleway (sans) and Lora (serif) via `--font-*`.
- shadcn/ui primitives live in `client/src/components/ui/`; compose and restyle
  them rather than swapping libraries. Merge classes with `cn()` from
  `@/lib/utils`; variants use `class-variance-authority`.
- Theme is managed by `client/src/components/ThemeProvider.tsx`
  (light/dark/system, persisted). Motion must honour `prefers-reduced-motion`
  and `html.motion-off` (`MotionToggle`).
- Accessibility is tested: contrast (`lib/contrast.test.ts`) and tap-target
  sizes (`lib/tapTargets.test.ts`).

## Coding conventions

- 2-space indent, double quotes, semicolons, trailing commas; named exports for
  lib/server modules, `export default` for page components.
- Files: pages/components `PascalCase.tsx`; lib/data modules `camelCase.ts`;
  shadcn primitives and some hooks `kebab-case`. Tests are colocated as
  `name.test.ts` next to the module.
- Keep domain logic in pure functions under `client/src/lib` or `shared/` with
  unit tests; pages/components wire it to UI. Derive values (session length,
  equipment, preflight) from the catalog — don't author them per screen.
- Validate every request body with zod (`shared/validation.ts`,
  drizzle-zod insert schemas) via `safeParse`; respond `{ error: string }` with
  a proper status. Unknown `/api/*` and media paths return JSON 404, never HTML.
- Storage changes go through the `IStorage` interface and must be implemented
  in **both** `DatabaseStorage` and `MemoryStorage`; schema changes go in
  `shared/schema.ts` **and** the idempotent `drizzle/schema.sql`.
- Interactive and asserted elements carry `data-testid` (used by Playwright).
- Browser storage goes through `client/src/lib/localPrefs.ts` (`KEYS`,
  `readString`/`writeJson`, all try/catch-guarded).
- Counted nouns use `client/src/lib/plural.ts`; page titles use
  `useDocumentTitle`.
- Comments explain *why* (often the bug that motivated the code), in JSDoc
  `/** … */` on exported functions. Match that density.
- Telemetry and optional integrations must never break the app: lazy-import
  them and swallow failures.
- Never invent media, reviewers, citations or provenance in code — see the
  media/benefit rules below.


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
- Pose media discovery: `GET /api/poses/:slug/media` → `{ video: {hls, mp4, webm, poster, captions, playbackId, provider} | null, audio: {url, source: human|neural, cues:[{t,text}]} | null }` (`server/poseMediaManifest.ts`). Client helpers in `client/src/lib/poseMediaApi.ts` — prefer these over guessing `/videos/...` or `/voice/...` paths. Adaptive video via **Bunny Stream** by default (`STREAM_PROVIDER`, `BUNNY_STREAM_CDN_HOSTNAME`); playback IDs in `pose_media` / `.data/pose-stream-ids.json`. Client uses **hls.js** when `hls` is set; local HD progressive files remain the default without stream IDs. Stream failure → illustration, never a blocking spinner.
- **Narration priority (GuidedSession):** human MP3 → neural MP3 (disk or `POST /api/poses/:slug/tts` cache) → `speechSynthesis` only if `allowRobotVoice` → silent captions. Cue list shape `{t,text}[]`. Mute keeps the timer; pace is Slow/Normal. TTS provider via `TTS_PROVIDER` + API keys (see `.env.example`).
- CSP `script-src` in **production** is `'self'` + the hashed theme boot script (no `'unsafe-inline'`). In **development**, `script-src` is `'self' 'unsafe-inline'` only — a hash would disable inline and break Vite’s React-refresh preamble (blank SPA). `style-src` still allows `'unsafe-inline'` for React `style={}`. Stream CDNs are allowlisted in `media-src` / `connect-src` via `streamCspHosts()`.
- **Hosting:** Render free tier cold-starts ~30–50s after idle — use a paid/always-on instance before public launch. Set `PUBLIC_APP_URL` to a real custom domain (not `*.onrender.com`); HTML OG/canonical + `/robots.txt` are rewritten from that value at serve time.
- **Error monitoring:** `@sentry/node` + `@sentry/react` when `SENTRY_DSN` / `VITE_SENTRY_DSN` are set. Also `POST /api/client-errors` + ErrorBoundary beacons. PostHog is product analytics only.
- **Images / CLS:** `PoseImage` uses `<picture>` WebP + PNG fallback (`npm run gen:pose-webp`), reserves `aspect-ratio` (default 1:2 for 600×1200 sources), and sets intrinsic width/height. Raw pose `<img>` tags should also set width/height (or aspect-ratio) and `loading`.
- With Postgres configured, the schema is auto-applied on boot from `drizzle/schema.sql` (no manual migration step needed); `npm run db:push` is available for manual schema pushes.
- **`/healthz` is DB-aware.** It returns 200 only when `storage.ping()` succeeds (always true in memory mode; `SELECT 1` against Postgres otherwise). A DB outage returns 503 so Render stops routing to a broken instance.
- Stripe entitlements live in the `entitlements` table (not `.data/billing-entitlements.json`). Boot runs an idempotent JSON→Postgres import via `migrateBillingEntitlements()`.
- The service worker / PWA (`client/public/sw.js`) is production-only and not active in `npm run dev`.
- Optional Python scripts under `script/` (voice/asset generation) and the Playwright demo scripts are content pipelines, not needed to run or test the app.
- **Marketing UX:** `/welcome` is quiz-first (primary CTA → `/start`). `/start` and `/verify` are chrome-free (no sidebar). Completing the quiz calls `loadSession` via `client/src/data/quizPlan.ts` so “Start my first session” opens a real guided queue. Landing program tiles pass `?ref=program-*` seeds into the quiz.
- **Pose presentation videos:** every catalog pose has `client/public/videos/poses/{slug}.{webm,mp4}` (regen with `npm run gen:pose-videos`). Idle detail / library / search show looping clips as **decoration**. They are not used while teaching — see the teaching rule below; `videoNarrationSync.ts` only applies once a reviewed movement demo exists. Illustration/3D is the fallback when video cannot play. Kids clips: `npm run gen:kids-pose-videos`. See `docs/pose-videos.md`.
- **Session length is derived, never authored — and it depends on the teaching mode.** `client/src/lib/guidedDuration.ts` is the timing authority and `client/src/lib/sessionFit.ts` decides whether a composed practice fits the requested length. `InstructionMode` is `guided` (recorded narration, 55–70s/pose from `narrationDurations.ts`), `brief` (`BRIEF_INSTRUCTION_SECONDS` = 12s of on-screen steps, what the player does with voice off) or `timer` (no instruction phase). Every duration helper takes the mode and every screen passes the one the practitioner will get; `GuidedSession`'s `SILENT_INSTRUCTION_SECONDS` **is** `BRIEF_INSTRUCTION_SECONDS`. Plus a 5s transition per pose, a 2s switch on bilateral poses, and holds paid twice on both sides — so a "sum of holds" estimate is always wrong. A short budget buys **fewer poses**, not shorter ones: trim the queue first, then holds, and never past twice a pose's reviewed `holdSeconds`. `composeTrainerSession`, `buildQuizPlan` and `generateAdaptiveSession` all work this way and return a `fit`. When a request cannot be met, surface `fit.explanation` once before starting and offer `nearestOfferedMinutes(...)` — do not silently overrun. `remainingFromPhases` must also count the far side of a bilateral pose, banked `+30s`, and pace. See `docs/session-timing.md`; `sessionFit.test.ts` and `sessionDurationModes.test.ts` pin it.
- **A short request buys fewer poses, not rushed ones.** Below `SHORT_ARC_MINUTES` (8) the practice arc may shorten — `arcShapeOk(slugs, allowShortArc)` drops the *peak* requirement while still requiring preparation and a close, which is the safe direction to give way in. `targetPoseCount` is budgeted from measured per-pose overhead plus `MEANINGFUL_HOLD_SECONDS`, not a flat 90s: the flat figure asked for seven poses in ten minutes, left 20s of hold each, and overran anyway. `fitQueueToMinutes` re-fits after any post-composition reshaping (the Adaptive Plan eases, swaps and tops up), shortening holds to their own floors before dropping a pose, and only keeping a cut that leaves the arc intact. When narration is what does not fit, `briefModeFit` offers captions-only as an **explicit** choice via `SessionMeta.instructionMode` — never a silent substitution.
- **A generated session states its own length, once.** The Trainer's `reasoning` names `actualMinutes`, not the requested minutes. "Shortened to fit" only renders when `fit.fits`. `composeTrainerSession` pushes its fit sentence into `adjustments`, so anything that reshapes the queue afterwards must strip it (`isDurationFitSentence` in `adaptiveGenerator`) — two stale sentences in one list is how the Adaptive Plan explained 14 minutes and 15 minutes at the same time. `DurationFitNotice` is the shared component for "this is not the length you asked for" plus the ways out.
- **"This week" means this week.** `weeklyProgress(sessions, today, weekStartsOn)` in `shared/practiceStats.ts` counts distinct local dates, sessions and minutes inside one week; `homeProgressTiles` is lifetime and must stay behind its own "All time" label, along with the 84-day heatmap. Dates are local calendar dates — a 23:30 Sunday practice belongs to the week that is ending.
- **An illustration that does not show its own instructions is labelled.** `client/src/data/poseImageAccuracy.ts` lists the ones reviewed and found wrong (Supported Child's Pose shows a small cushion, not a lengthwise bolster; Legs on a Chair shows legs straight up, not calves on the seat). While listed, `accurateImageAlt` makes the alt describe what is *drawn*, the demonstration badge carries `shortCaveat` with the full text in `title`, and the preflight lists the difference. Entries are added by looking at the image, never inferred; `docs/pose-illustration-briefs.md` says what would replace them.
- **Counted nouns go through `client/src/lib/plural.ts`.** "1 poses queued" survived three rounds of fixes because every call site built the string by hand.
- **Before Begin, the practitioner sees what the practice is.** `client/src/lib/sessionPreflight.ts` derives length (for the live mode), difficulty, intensity, required props, the pose list and the catalog's own modifications from the queue itself — nothing about a session is authored per session. Equipment is **read from the pose instructions** (`sessionEquipment.ts`): a prop named in a step is required, one offered as an alternative ("or a strap", "if needed") or only in `modifications` is optional, and capitalised pose names ("into Chair Pose") are not props. Prop-free substitutions live in `EQUIPMENT_FREE_SWAPS` and are added pair by pair after reading both poses' instructions — never generated.
- **Generated pose clips are never shown while teaching.** `PoseTrainerStage` refuses them whenever `variant="practice"` or `teaching` is set, because `script/gen-pose-videos.ts` crossfades stills and, for 205 poses, opens on a *different* pose chosen by category (Restorative → sukhasana, which is why Supported Child's Pose showed someone sitting cross-legged). Teaching falls back to this pose's own illustration labelled `STATIC_REFERENCE_LABEL`, and a step whose pose key maps to another catalog slug is ignored. Only `poseDemoAvailability(slug).kind === "movement"` unlocks a clip, and `REVIEWED_MOVEMENT_DEMOS` is empty.
- **Goal, ability, time and focus live in one store.** `client/src/lib/practicePreferences.ts` — the quiz, Home, the Trainer and the Adaptive Plan all read it for defaults and write back what the practitioner chose, so a length answered once is not asked for again. Experience caps pose **difficulty**, not just hold length: a first-timer is never offered an Advanced shape at a beginner's hold.
- **Benefit claims are flagged, never evidenced.** `client/src/lib/benefitClaims.ts` sorts catalog `benefits` lines into "reads as a sensation" and "names a condition or mechanism". The second group (85 lines, 72 poses) is listed in `docs/benefit-claim-review.md` for a qualified reviewer, and the pose page carries `BENEFIT_REVIEW_NOTE` until that review happens. The count is pinned by a test so a new clinical claim cannot land unnoticed. Never add citations or reviewer names to make one look checked.
- **Pose lessons (detail page):** `client/src/lib/poseLesson.ts` is the single timeline driving the demonstration, cue, step number, highlight, side, phase and remaining time for a catalog pose — `PoseExplanation` reads only from it. `client/src/data/poseDemoAvailability.ts` decides what may be shown: **the generated `/videos/poses/*` clips are never played in teaching.** They are 2.57s crossfades of 2–3 stills, and for 205 poses they blend in a *different* pose's illustration (Standing→tadasana, Restorative→sukhasana), which is why Warrior II's knee cue showed a standing figure and Cat–Cow's "all fours" showed a cross-legged seat. Teaching shows the pose's own still labelled "Static reference — movement demonstration unavailable" until a reviewed clip is added to `REVIEWED_MOVEMENT_DEMOS` (empty; never populate from code). Dynamic practices (`isDynamicPractice`) get rounds, not "Hold ~Ns". Highlights are gated on `VERIFIED_FOCUS_POSES` (empty) because authored zones are mis-scaled — Warrior II's "Arms extended" spans crown to waist. See `docs/pose-demo-production.md`.
- **Instructor demonstration media:** `client/src/data/instructorMediaManifest.ts` is the authority on what may be presented as instruction. Every clip carries provenance, usage rights, review stage (`missing → draft → content_review → playback_qa → published`), reviewer, review date and version. **`isMovementDemonstration()` is the only predicate allowed to gate "this shows how the pose is performed"** — it requires `published` + a named reviewer + a real source + prepare/enter/hold/exit segments. Illustrations and stills can never be promoted. All rows are currently `missing`; `instructorMediaManifest.test.ts` fails if that silently changes. Video belongs on the existing stream/CDN infrastructure, never in the bundle. See `docs/instructor-content-workflow.md` and `docs/instructor-asset-briefs.md`.
- **Instructor timeline:** `client/src/lib/instructorTimeline.ts` builds one clock for prepare → enter → hold → exit → transition and drives video, narration, captions, phase label, hold countdown and remaining time. Holds are separate segments keyed by `holdKeyFor(slug, side)` so "extend hold" lengthens only the hold — entry/exit are never replayed. Buffering stalls the whole session clock (see `stalled` in `InstructorSession`) so narration cannot run ahead of the body on screen.
- **Premium guided polish:** dual-layer pose cross-fade + idle chrome hide live in `GuidedSession`. Session summary (minutes / poses / breaths) auto-writes the journal via `logPracticeSession` + `sessionBreaths`. Human-provided narration, filmed/rigged motion, and camera joint-angle defs are documented in `docs/premium-assets.md` — do not invent those assets in code.
- **Account recovery without email:** when `emailDeliveryConfigured()` is false there is no inbox to verify and no way to send a reset code, so signup would otherwise create an account nobody could ever use. In that case signup **signs the user in immediately** and returns a one-time **recovery code** (`newRecoveryCode()`, ~98 bits, stored hashed in `password_reset_tokens`, shown once). `POST /api/auth/reset-password` accepts it in place of an emailed token — case- and dash-insensitive via `normalizeRecoveryCode` — and issues a replacement, since using one consumes it. `emailVerified` stays **false** (nothing was proven); the login gate is `!user.emailVerified && emailDeliveryConfigured()` so it only demands verification where one could actually have been sent. Never mark an address verified just because no mail could reach it.
- **Accounts:** `POST /api/auth/signup` creates an unverified user and does **not** set a session cookie (when mail is configured). Users must hit `/verify` (email link or pasted code) via `POST /api/auth/verify-email` before login. Non-production also returns `verifyToken` / `resetToken` in JSON for local flows. Existing Postgres users get `email_verified = true` via the schema default/ALTER.
- **Transactional email** (`server/email.ts`): Resend → `EMAIL_WEBHOOK_URL` → console log. Kinds: `verify`, `welcome`, `password_reset`, `password_changed`, `account_deleted`, `subscription_started`, `cancel_confirm`, `renewal_reminder`, `payment_failed`, `refund_confirm`. Billing renewal reminders also run via `startBillingScheduler` / `POST /api/billing/dispatch-renewal-reminders`.
- **Product analytics:** shared taxonomy + metric math live in `funnel/`. Client capture is `client/src/lib/productAnalytics.ts` (PostHog via `posthog-js` when `VITE_PUBLIC_POSTHOG_KEY` is set; always buffers locally). Server purchase/cancel capture is `server/productAnalytics.ts`. Acquisition quiz: `/start`. Operator funnel dashboard: `/analytics/funnel` in development only (demo data / HogQL). Production shows this-device metrics without operator controls. Privacy does not link the dashboard.
- **Subscription compliance:** cancel is two taps from Home (`/` → `/cancel/confirm` → Confirm). Public instructions at `/cancel`. Live entitlement/consent state for cancel + refunds lives in `server/billingStore.ts` (`.data/`). Consent audit + paywall HTML snapshots: `billing-consent-audit.jsonl`, `billing-paywall-snapshots/`. Seed a demo entitlement with `POST /api/billing/demo-subscribe`.
