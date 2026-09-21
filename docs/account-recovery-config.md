# Account recovery — how it works, and what to configure

## The short version

Recovery works today on a deployment with no email transport. It works better
with one. Nothing in the product claims an email was sent when it was not.

## Two paths, and which one is live

`emailDeliveryConfigured()` (`server/email.ts`) is true when either
`RESEND_API_KEY` or `EMAIL_WEBHOOK_URL` is set. Everything below branches on it,
and the client reads the same answer from `GET /api/auth/mail-status` so the
Reset screen leads with the path that actually works.

### With email configured

1. Signup creates an **unverified** user and does not set a session cookie.
2. A verification link goes to the address. `POST /api/auth/verify-email` marks
   the address verified, adopts this browser's guest practice, and signs in.
3. Login is gated on `emailVerified`.
4. Forgotten password: `POST /api/auth/forgot-password` mails a reset token,
   good for 60 minutes. `POST /api/auth/reset-password` consumes it, sets the
   new password, **and marks the address verified** — receiving that mail is
   proof of inbox access.

### Without email configured (the current live deployment)

1. Signup mints a one-time **recovery code** — about 98 bits, base32 without
   `I`, `L`, `O`, `U`, `0` or `1` so handwriting survives — stores only its
   hash in `password_reset_tokens`, shows it once, and signs the practitioner
   in immediately. There is no inbox to wait on.
2. `emailVerified` stays **false**. Nothing was sent, so nothing was proven.
3. The login gate is `!user.emailVerified && emailDeliveryConfigured()`, so it
   only demands verification where one could have been sent.
4. `POST /api/auth/reset-password` accepts the recovery code in place of an
   emailed token, case- and dash-insensitively (`normalizeRecoveryCode`). Using
   one consumes it, so a replacement is minted and returned exactly once.
5. A recovery-code reset **does not** mark the address verified. It proves the
   practitioner kept a code; it says nothing about the inbox.

Recovery codes remain available as a second path once email is configured.

## Failure and abuse behaviour

| Case | Response |
| --- | --- |
| Unknown email on forgot-password | Generic 200. Accounts are not enumerable. |
| Unknown email on resend-verification | Generic 200, same wording every time. |
| Expired reset token or recovery code | `400 Reset code is invalid or expired` |
| Token belonging to another account | Same 400 — never a different message |
| Replayed (already consumed) code | Same 400 |
| Malformed body | `400` from the schema, shape only |
| Repeated attempts | `authStrict` limiter: 10 requests / 15 min on `/api/auth/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` (`server/security.ts`) |

A successful reset also deletes every existing session for that user, so a
stolen session cookie does not survive a password change.

## Configuration to switch email on

Set **one** provider, plus a from-address, in the deployment environment
(Render → Environment, or `.env` locally):

```
# Option A — Resend HTTP API
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Sadhana <no-reply@your-domain>

# Option B — any relay that accepts POST {to, from, subject, text, html, kind}
EMAIL_WEBHOOK_URL=https://your-relay.example/send
EMAIL_FROM=Sadhana <no-reply@your-domain>
```

Also set, so links in those emails point somewhere real:

```
PUBLIC_APP_URL=https://your-custom-domain
```

`PUBLIC_APP_URL` must be a domain you control. Verification and reset links are
built from it, and it is also what rewrites the OG/canonical tags and
`/robots.txt` at serve time.

With Resend, the sending domain has to be verified in Resend first, or delivery
fails silently from the app's point of view — `sendPasswordResetEmail` reports
its transport mode to the server log (`[auth] password reset for user N via
resend|webhook|log`), which is the fastest way to tell which path ran.

## Verifying it after configuring

There is no way to confirm delivery from inside the app, and the app does not
claim to. Check, in order:

1. `GET /api/auth/mail-status` returns `{"emailEnabled": true}`.
2. `POST /api/auth/forgot-password` for a real account logs
   `via resend` (or `via webhook`), not `via log`.
3. The message arrives, and the link in it opens `/verify` or the reset form on
   `PUBLIC_APP_URL`.
4. `e2e/account-recovery.spec.ts` skips itself when email is on, because the
   code path it covers is the no-email one. Run it against a deployment with
   mail **off** to keep the fallback honest.

Until step 2 has been observed on the target deployment, the correct statement
is "email delivery is not verified", not "email works".
