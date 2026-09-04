/**
 * Contract tests for transactional email helpers.
 */
import { describe, it } from "node:test";
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
  emailDeliveryConfigured,
} from "./email";

describe("email formatting helpers", () => {
  it("formats money and access dates", () => {
    assert.match(formatMoney(9.99, "usd"), /\$9\.99/);
    assert.match(formatAccessDate("2026-08-15T00:00:00.000Z"), /August/);
  });
});

describe("email notification templates", () => {
  it("emits every notification kind through the log transport", async () => {
    const kinds: string[] = [];
    const original = console.info;
    console.info = ((...args: unknown[]) => {
      const line = String(args[0] ?? "");
      const m = line.match(/^\[email:([^\]]+)\]/);
      if (m) kinds.push(m[1]!);
    }) as typeof console.info;

    try {
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_WEBHOOK_URL;

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
    const prevResend = process.env.RESEND_API_KEY;
    const prevHook = process.env.EMAIL_WEBHOOK_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_WEBHOOK_URL;
    assert.equal(emailDeliveryConfigured(), false);
    process.env.RESEND_API_KEY = "re_test";
    assert.equal(emailDeliveryConfigured(), true);
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_WEBHOOK_URL = "https://example.com/hook";
    assert.equal(emailDeliveryConfigured(), true);
    if (prevResend === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevResend;
    if (prevHook === undefined) delete process.env.EMAIL_WEBHOOK_URL;
    else process.env.EMAIL_WEBHOOK_URL = prevHook;
  });
});
