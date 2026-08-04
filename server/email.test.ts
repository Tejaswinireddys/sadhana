import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildPasswordResetEmail,
  emailFrom,
  emailProvider,
  RESET_EXPIRY_MIN,
} from "./email";

const ENV_KEYS = ["RESEND_API_KEY", "EMAIL_WEBHOOK_URL", "EMAIL_FROM"] as const;
const saved: Record<string, string | undefined> = {};

function clearEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
}

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("email provider selection", () => {
  it("is 'none' with no configuration", () => {
    clearEnv();
    assert.equal(emailProvider(), "none");
  });

  it("prefers Resend when its key is set", () => {
    clearEnv();
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_WEBHOOK_URL = "https://relay.example/send";
    assert.equal(emailProvider(), "resend");
  });

  it("falls back to a webhook relay", () => {
    clearEnv();
    process.env.EMAIL_WEBHOOK_URL = "https://relay.example/send";
    assert.equal(emailProvider(), "webhook");
  });

  it("uses a configurable From address with a safe default", () => {
    clearEnv();
    assert.match(emailFrom(), /Sadhana/);
    process.env.EMAIL_FROM = "Sadhana <hi@sadhana.app>";
    assert.equal(emailFrom(), "Sadhana <hi@sadhana.app>");
  });
});

describe("password reset email content", () => {
  it("includes the code, single-use expiry, and escapes HTML", () => {
    clearEnv();
    const msg = buildPasswordResetEmail("person@example.com", "AB<CD>12");
    assert.equal(msg.to, "person@example.com");
    assert.match(msg.subject, /reset code/i);
    assert.ok(msg.text.includes("AB<CD>12"));
    assert.ok(msg.text.includes(String(RESET_EXPIRY_MIN)));
    // HTML output must not contain the raw angle brackets from the token.
    assert.ok(!msg.html.includes("AB<CD>12"));
    assert.ok(msg.html.includes("AB&lt;CD&gt;12"));
  });
});
