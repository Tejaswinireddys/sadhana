# Account recovery — how it works, and what to configure

## The short version

Recovery works today on a deployment with no email transport. It works better
with one. Nothing in the product claims an email was sent when it was not.

## Two paths, and which one is live

`emailDeliveryConfigured()` (`server/email.ts`) is true when SMTP (including
the Gmail App Password shortcut), `RESEND_API_KEY`, or `EMAIL_WEBHOOK_URL` is
set. Everything below branches on it, and the client reads the same answer from
`GET /api/auth/mail-status` so the Reset screen leads with the path that
actually works. That endpoint also returns `provider` (`smtp` | `resend` |
`webhook` | `none`) and never includes credentials or the from-address.

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

Set **one** provider (SMTP takes precedence when present, then Resend, then the
webhook), plus a from-address when the provider needs one, in the deployment
environment (Render → Environment, or `.env` locally):

```
# Option A — Gmail App Password (no custom domain required)
# 1. Turn on 2-Step Verification for the Google account.
# 2. Create an App Password at https://myaccount.google.com/apppasswords
# 3. Set on Render and redeploy:
GMAIL_USER=your.name@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
PUBLIC_APP_URL=https://sadhana-ou9m.onrender.com
# EMAIL_FROM is optional; when unset, From defaults to Sadhana <GMAIL_USER>
# (Gmail rewrites any other From to the authenticated account anyway).
# Gmail personal accounts allow roughly 500 messages per day — fine for
# verification and resets, not for bulk marketing.

# Option B — generic SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=465
# SMTP_SECURE defaults to true when port is 465; set false for STARTTLS on 587
SMTP_USER=bot@example.com
SMTP_PASS=secret
# EMAIL_FROM=Sadhana <bot@example.com>

# Option C — Resend HTTP API (needs a domain verified in Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Sadhana <no-reply@your-domain>

# Option D — any relay that accepts POST {to, from, subject, text, html, kind}
EMAIL_WEBHOOK_URL=https://your-relay.example/send
EMAIL_FROM=Sadhana <no-reply@your-domain>
```

Also set, so links in those emails point somewhere real:

```
PUBLIC_APP_URL=https://your-custom-domain
```

Until you have a custom domain, use the Render URL people actually open
(e.g. `https://sadhana-ou9m.onrender.com`). Verification and reset links are
built from it, and it is also what rewrites the OG/canonical tags and
`/robots.txt` at serve time.

With Resend, the sending domain has to be verified in Resend first. A key with
no `EMAIL_FROM`, or `EMAIL_FROM` left on `onboarding@resend.dev`, only delivers
to the Resend account owner. Boot logs `[email] RESEND_API_KEY is set but
EMAIL_FROM is missing…` in that case — **unless** SMTP/Gmail is also
configured, in which case SMTP is used and the Resend sandbox warning is
skipped. A rejected send is **not** reported as the console-only path: signup
returns `emailSent: false` and says the message was not sent, resend returns
HTTP 503 with the same fact (including SMTP errors), and the server log is
`[auth] verification email for user N was not delivered (smtp|resend|webhook: …)`.

## Verifying it after configuring

Signup reports `emailSent`. A failed provider call is an error in the log, not
a success toast. Check, in order:

1. `GET /api/auth/mail-status` returns
   `{"emailEnabled": true, "provider": "smtp"}` (or `resend` / `webhook`).
2. Boot does not warn about `EMAIL_FROM` (or SMTP is active). A real signup or
   reset logs `via smtp` / `via resend` / `via webhook`. `was not delivered`
   means the provider rejected it.
3. The message arrives, and the link in it opens `/verify` or the reset form on
   `PUBLIC_APP_URL`.
4. `e2e/account-recovery.spec.ts` skips itself when email is on, because the
   code path it covers is the no-email one. Run it against a deployment with
   mail **off** to keep the fallback honest.

Until step 2 has been observed on the target deployment, the correct statement
is "email delivery is not verified", not "email works".
