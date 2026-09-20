import { test, expect } from "@playwright/test";

/**
 * Account recovery on a deployment that cannot send email.
 *
 * The reported P1: signup created an account nobody could get back into. With
 * no mail transport there is no verification link and no reset code, so the
 * account was unusable the moment it existed.
 *
 * Deliberately ONE test. `/api/auth/*` is rate limited to 10 calls per 15
 * minutes (server/security.ts `authStrict`), shared across the whole suite, so
 * a chattier spec starves the other journeys of their budget. Properties that
 * do not need a live server are unit-tested in server/recoveryCode.test.ts.
 */
const PASSWORD = "first-passw0rd";
const NEXT_PASSWORD = "second-passw0rd";

test("a new account can be created, used, and recovered without email", async ({ request }) => {
  const mail = await (await request.get("/api/auth/mail-status")).json();
  test.skip(mail.emailEnabled === true, "this server sends email; the code path under test is off");

  const email = `recovery-${Math.random().toString(36).slice(2, 10)}@example.test`;

  // 1. Signup hands back a recovery code instead of an unreachable link, and
  //    signs the practitioner in — the account is usable immediately, which is
  //    exactly what used to be impossible.
  const signup = await request.post("/api/auth/signup", {
    data: { email, password: PASSWORD, displayName: "Recovery Test" },
  });
  expect(signup.status()).toBe(201);
  const created = await signup.json();
  expect(created.needsVerification, "must not wait on an email it can never receive").toBe(false);
  expect(created.user?.email).toBe(email);
  expect(created.recoveryCode).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
  // The address was never proven, so the flag must not claim it was.
  expect(created.user.emailVerified, "an unproven address was marked verified").toBeFalsy();

  // 2. A forgotten password is recoverable, typed the way it is read off
  //    paper: lowercase, no dashes.
  const messy = String(created.recoveryCode).toLowerCase().replace(/-/g, "");
  const reset = await request.post("/api/auth/reset-password", {
    data: { email, token: messy, password: NEXT_PASSWORD },
  });
  expect(reset.status(), "recovery code was rejected").toBe(200);
  const afterReset = await reset.json();

  // 3. Using the code consumes it, so a replacement is issued — otherwise the
  //    next reset would be a dead end all over again.
  expect(afterReset.recoveryCode).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/);
  expect(afterReset.recoveryCode).not.toBe(created.recoveryCode);

  // 4. The new password works.
  const login = await request.post("/api/auth/login", {
    data: { email, password: NEXT_PASSWORD },
  });
  expect(login.status(), "could not sign in after recovery").toBe(200);

  // 5. The spent code cannot be replayed.
  const replay = await request.post("/api/auth/reset-password", {
    data: { email, token: created.recoveryCode, password: "third-passw0rd" },
  });
  // 400 rejects it; 429 means the strict limiter stepped in first. Both refuse.
  expect([400, 429], `unexpected status ${replay.status()}`).toContain(replay.status());
});
