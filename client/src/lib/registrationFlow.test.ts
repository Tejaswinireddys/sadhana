/**
 * Guards the registration + email verification UX contract.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("registration + email verification contract", () => {
  it("exposes confirm-password signup fields and a verify route", () => {
    const account = readFileSync(resolve("client/src/pages/Account.tsx"), "utf8");
    assert.match(account, /data-testid="signup-confirm"/);
    assert.match(account, /credentialsSchema/);
    assert.match(account, /needsVerification/);
    assert.match(account, /\/verify/);

    const app = readFileSync(resolve("client/src/App.tsx"), "utf8");
    assert.match(app, /path="\/verify"/);
    assert.match(app, /"\/verify"/);

    const verify = readFileSync(resolve("client/src/pages/VerifyEmail.tsx"), "utf8");
    assert.match(verify, /data-testid="verify-submit"/);
    assert.match(verify, /data-testid="verify-resend"/);
  });

  it("gates login until emailVerified and issues verify tokens on signup", () => {
    const routes = readFileSync(resolve("server/routes.ts"), "utf8");
    assert.match(routes, /\/api\/auth\/verify-email/);
    assert.match(routes, /\/api\/auth\/resend-verification/);
    assert.match(routes, /needsVerification:\s*true/);
    assert.match(routes, /if\s*\(!user\.emailVerified\)/);
    assert.match(routes, /sendVerificationEmail/);
  });
});
