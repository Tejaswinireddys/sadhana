# Content entitlements

Account access is `users.plan`: `free` (default, including existing users and
guests) or `plus`. This is independent of legacy billing records and the local
preferred-plan setting. There is no public plan mutation endpoint. Stripe test-mode Checkout and signed
webhooks now drive this field; see the Stripe setup in `README.md`. The integration calls
`IStorage.setUserPlan(userId, plan)`; both database and memory stores implement it.
Signup does not accept a plan. `/api/auth/me` and other public-user responses
include the stored plan. The SQL schema adds the column idempotently with a
constraint limiting values to free/plus.

`useEntitlement()` reads the auth query, defaults unknown plans to free and
exposes `plan`, `isPlus`, `isLoading` and `canAccess(content)`. Auth cache resets
on sign in/out; account changes otherwise refresh when the auth query refetches.
The server reads the current user row for every protected request.

Set `isPlus: true` on a raw pose or pathway in `client/src/data/content.ts` to
mark it. Omitted flags resolve to false. All existing content remains free
pending a product selection. Classes are listings of pathways and inherit the
same flag; the older `plus` listing property remains as an alias. The previous
program-length-based Plus badges now follow the explicit flag. Regenerate the
portable pose export after changing pose flags.

`ContentAccessGate` protects pose/program detail routes and practice/guided
queues, including restored queues and program provenance in session metadata.
The instructor pilot starts with all five pilot poses selected, so its route
requires access to every pilot pose.
It waits for auth before mounting Plus content and displays an upgrade screen
for free users. The upgrade link uses the existing `/plus` route, so no new
client routes are introduced.

The server protects pose media/TTS and partner pose-detail endpoints, and offers
`GET /api/content/{poses|classes|programs}/:slug` with the same 403
`PLUS_REQUIRED` check. Catalog summaries remain browsable. No client-supplied
plan, local preference or legacy billing entitlement can grant access.

Current architecture limitation: pose/program data and local media are shipped
publicly as static assets. This layer gates supported UI and API access; it does
not make downloaded catalog data or static media confidential. Before shipping
paid exclusive assets, move their payloads out of the public bundle and serve
media through authenticated or signed delivery.

## Verification

- `npm run check`: passed.
- `npm test`: 783 tests passed, including account-plan middleware, spoofed plan
  headers, upgrade/downgrade, rendered free/Plus/loading states, trailing-slash
  routes, restored queues and program provenance.
- `npm run build`: passed.
- `npm run test:e2e`: all 161 browser tests passed on port 5071. Shared welcome
  bootstrap logic now handles legacy hash bookmarks, returning users without
  the welcome cookie, and the first-visit `/` → `/welcome` redirect. Regression
  coverage verifies that destination queries and normal deep links survive.
