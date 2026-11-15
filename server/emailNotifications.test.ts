/**
 * Contract tests for transactional email helpers.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  formatAccessDate,
  formatMoney,
  sendAccountDeletedEmail,
  sendCancelConfirmationEmail,
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendPaymentFailedEmail,
  sendRefundConfirmationEmail,
  sendRenewalReminderEmail,
  sendSubscriptionStartedEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  emailConfigWarning,
  emailDeliveryConfigured,
  settleWithin,
  resolveSmtpConfig,
  resolveMailProvider,
  mailStatusPayload,
  fromAddress,
  __resetSmtpTransporterForTests,
  __setSmtpSendMailForTests,
} from "./email";

const SMTP_ENV_KEYS = [
  "RESEND_API_KEY",
  "EMAIL_WEBHOOK_URL",
  "EMAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
] as const;

function snapshotEmailEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key of SMTP_ENV_KEYS) snap[key] = process.env[key];
  return snap;
}

function restoreEmailEnv(snap: Record<string, string | undefined>): void {
  for (const key of SMTP_ENV_KEYS) {
    if (snap[key] === undefined) delete process.env[key];
    else process.env[key] = snap[key];
  }
}

function clearEmailEnv(): void {
  for (const key of SMTP_ENV_KEYS) delete process.env[key];
}

describe("email formatting helpers", () => {
  it("formats money and access dates", () => {
    assert.match(formatMoney(9.99, "usd"), /\$9\.99/);
    assert.match(formatAccessDate("2026-08-15T00:00:00.000Z"), /August/);
  });
});

describe("SMTP / Gmail provider selection", () => {
  let snap: Record<string, string | undefined>;
  beforeEach(() => {
    snap = snapshotEmailEnv();
    clearEmailEnv();
    __resetSmtpTransporterForTests();
  });
  afterEach(() => {
    __resetSmtpTransporterForTests();
    restoreEmailEnv(snap);
  });

  it("maps GMAIL_USER + GMAIL_APP_PASSWORD to smtp.gmail.com:465", () => {
    const cfg = resolveSmtpConfig({
      GMAIL_USER: "practice@gmail.com",
      GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    });
    assert.deepEqual(cfg, {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      user: "practice@gmail.com",
      pass: "abcd efgh ijkl mnop",
    });
    assert.equal(resolveMailProvider({
      GMAIL_USER: "practice@gmail.com",
      GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
      RESEND_API_KEY: "re_also_set",
    }), "smtp");
  });

  it("defaults SMTP_PORT to 465 and SMTP_SECURE from the port", () => {
    assert.equal(
      resolveSmtpConfig({
        SMTP_HOST: "mail.example.com",
        SMTP_USER: "bot@example.com",
        SMTP_PASS: "secret",
      })?.secure,
      true,
    );
    assert.equal(
      resolveSmtpConfig({
        SMTP_HOST: "mail.example.com",
        SMTP_PORT: "587",
        SMTP_USER: "bot@example.com",
        SMTP_PASS: "secret",
      })?.secure,
      false,
    );
    assert.equal(
      resolveSmtpConfig({
        SMTP_HOST: "mail.example.com",
        SMTP_PORT: "587",
        SMTP_SECURE: "true",
        SMTP_USER: "bot@example.com",
        SMTP_PASS: "secret",
      })?.secure,
      true,
    );
  });

  it("prefers SMTP over Resend over webhook for mail-status", () => {
    assert.deepEqual(mailStatusPayload({}), { emailEnabled: false, provider: "none" });
    assert.deepEqual(
      mailStatusPayload({ EMAIL_WEBHOOK_URL: "https://example.com/hook" }),
      { emailEnabled: true, provider: "webhook" },
    );
    assert.deepEqual(
      mailStatusPayload({
        RESEND_API_KEY: "re_test",
        EMAIL_WEBHOOK_URL: "https://example.com/hook",
      }),
      { emailEnabled: true, provider: "resend" },
    );
    assert.deepEqual(
      mailStatusPayload({
        GMAIL_USER: "practice@gmail.com",
        GMAIL_APP_PASSWORD: "app-pass",
        RESEND_API_KEY: "re_test",
        EMAIL_WEBHOOK_URL: "https://example.com/hook",
      }),
      { emailEnabled: true, provider: "smtp" },
    );
    const status = mailStatusPayload({
      GMAIL_USER: "practice@gmail.com",
      GMAIL_APP_PASSWORD: "app-pass",
    });
    assert.equal(status.emailEnabled, true);
    assert.equal(status.provider, "smtp");
    assert.equal("user" in status, false);
    assert.equal(JSON.stringify(status).includes("practice@gmail.com"), false);
    assert.equal(JSON.stringify(status).includes("app-pass"), false);
  });

  it("defaults From to Sadhana <GMAIL_USER> when EMAIL_FROM is unset", () => {
    assert.equal(
      fromAddress({
        GMAIL_USER: "practice@gmail.com",
        GMAIL_APP_PASSWORD: "app-pass",
      }),
      "Sadhana <practice@gmail.com>",
    );
    assert.equal(
      fromAddress({
        GMAIL_USER: "practice@gmail.com",
        GMAIL_APP_PASSWORD: "app-pass",
        EMAIL_FROM: "Sadhana <custom@example.com>",
      }),
      "Sadhana <custom@example.com>",
    );
  });

  it("does not warn about the Resend sandbox when SMTP is active", () => {
    assert.equal(
      emailConfigWarning({
        RESEND_API_KEY: "re_test",
        GMAIL_USER: "practice@gmail.com",
        GMAIL_APP_PASSWORD: "app-pass",
      }),
      null,
    );
  });

  it("sends via the mocked SMTP transport and reports SMTP failures", async () => {
    process.env.GMAIL_USER = "practice@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-pass";
    assert.equal(emailDeliveryConfigured(), true);

    let sawFrom = "";
    __setSmtpSendMailForTests(async (mail) => {
      sawFrom = mail.from;
      return { messageId: "smtp-test-id" };
    });
    const ok = await sendVerificationEmail({ to: "a@example.com", token: "token-abcdefghijklmnop" });
    assert.equal(ok.sent, true);
    assert.equal(ok.mode, "smtp");
    assert.equal(ok.id, "smtp-test-id");
    assert.equal(sawFrom, "Sadhana <practice@gmail.com>");

    __setSmtpSendMailForTests(async () => {
      throw new Error("Invalid login");
    });
    const fail = await sendVerificationEmail({ to: "a@example.com", token: "token-abcdefghijklmnop" });
    assert.equal(fail.sent, false);
    assert.equal(fail.mode, "smtp");
    assert.match(fail.error ?? "", /Invalid login/);
  });
});

describe("email notification templates", () => {
  let snap: Record<string, string | undefined>;
  beforeEach(() => {
    snap = snapshotEmailEnv();
    clearEmailEnv();
    __resetSmtpTransporterForTests();
  });
  afterEach(() => {
    __resetSmtpTransporterForTests();
    restoreEmailEnv(snap);
  });

  it("emits every notification kind through the log transport", async () => {
    const kinds: string[] = [];
    const original = console.info;
    console.info = ((...args: unknown[]) => {
      const line = String(args[0] ?? "");
      const m = line.match(/^\[email:([^\]]+)\]/);
      if (m) kinds.push(m[1]!);
    }) as typeof console.info;

    try {
      await sendVerificationEmail({ to: "a@example.com", token: "token-abcdefghijklmnop" });
      await sendWelcomeEmail({ to: "a@example.com", displayName: "Maya" });
      await sendPasswordResetEmail({ to: "a@example.com", token: "reset-abcdefghijklmnop" });
      await sendPasswordChangedEmail({ to: "a@example.com" });
      await sendAccountDeletedEmail({ to: "a@example.com" });
      await sendSubscriptionStartedEmail({
        to: "a@example.com",
        plan: "plus",
        manageUrl: "http://localhost:5000/plus",
      });
      await sendCancelConfirmationEmail({
        to: "a@example.com",
        plan: "plus",
        accessUntil: "2026-09-01T00:00:00.000Z",
        manageUrl: "http://localhost:5000/plus",
      });
      await sendRenewalReminderEmail({
        to: "a@example.com",
        plan: "coach",
        amount: 14.99,
        currency: "usd",
        chargeDate: "2026-09-01T00:00:00.000Z",
        manageUrl: "http://localhost:5000/plus",
      });
      await sendPaymentFailedEmail({
        to: "a@example.com",
        plan: "plus",
        manageUrl: "http://localhost:5000/plus",
      });
      await sendRefundConfirmationEmail({ to: "a@example.com", amount: 9.99, currency: "usd" });

      assert.deepEqual(kinds, [
        "verify",
        "welcome",
        "password_reset",
        "password_changed",
        "account_deleted",
        "subscription_started",
        "cancel_confirm",
        "renewal_reminder",
        "payment_failed",
        "refund_confirm",
      ]);
    } finally {
      console.info = original;
    }
  });

  it("rejects missing recipients", async () => {
    const result = await sendWelcomeEmail({ to: "" });
    assert.equal(result.sent, false);
    assert.equal(result.error, "No recipient email");
  });

  it("reports whether a real mail transport is configured", () => {
    assert.equal(emailDeliveryConfigured(), false);
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(emailDeliveryConfigured(), true);
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_WEBHOOK_URL = "https://example.com/hook";
    assert.equal(emailDeliveryConfigured(), true);
    delete process.env.EMAIL_WEBHOOK_URL;
    process.env.GMAIL_USER = "practice@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "app-pass";
    assert.equal(emailDeliveryConfigured(), true);
  });

  it("reports a Resend rejection instead of pretending the message was only logged", async () => {
    process.env.RESEND_API_KEY = "re_test";
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "domain is not verified" }), { status: 403 })) as typeof fetch;
    try {
      const result = await sendVerificationEmail({ to: "a@example.com", token: "token-abcdefghijklmnop" });
      assert.equal(result.sent, false);
      assert.equal(result.mode, "resend");
      assert.match(result.error ?? "", /403/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("stops waiting when a send never returns", async () => {
    const started = Date.now();
    const result = await settleWithin(40, new Promise<string>(() => undefined), "fallback");
    assert.equal(result, "fallback");
    assert.ok(Date.now() - started < 500);
  });

  it("warns when the Resend key would only deliver to the account owner", () => {
    assert.equal(emailConfigWarning({}), null);
    assert.match(
      emailConfigWarning({ RESEND_API_KEY: "re_test" }) ?? "",
      /EMAIL_FROM/,
    );
    assert.match(
      emailConfigWarning({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Sadhana <onboarding@resend.dev>" }) ?? "",
      /sandbox/,
    );
    assert.equal(
      emailConfigWarning({ RESEND_API_KEY: "re_test", EMAIL_FROM: "Sadhana <no-reply@example.com>" }),
      null,
    );
  });
});
