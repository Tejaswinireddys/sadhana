import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendConsentAudit,
  issueCancelToken,
  needsRenewalReminder,
  readConsentAudit,
  refundEligible,
  savePaywallSnapshot,
  verifyCancelToken,
  type BillingEntitlement,
} from "./billingStore";
import { BILLING_TERMS_VERSION, isPaidActive, priceLabel } from "./billingCompliance";

describe("billing compliance policy", () => {
  it("marks first-charge refund eligible for 14 days only", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    const ent: BillingEntitlement = {
      plan: "plus",
      status: "active",
      renewsAt: null,
      firstChargedAt: "2026-08-01T12:00:00.000Z",
    };
    assert.equal(refundEligible(ent, now), true);
    assert.equal(refundEligible({ ...ent, firstChargedAt: "2026-07-20T12:00:00.000Z" }, now), false);
    assert.equal(refundEligible({ ...ent, refundedAt: "2026-08-02T00:00:00.000Z" }, now), false);
  });

  it("schedules renewal reminders inside the 3-day window once", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    const renewsAt = "2026-08-12T12:00:00.000Z"; // 2 days out
    const ent: BillingEntitlement = {
      plan: "plus",
      status: "active",
      renewsAt,
      cancelAtPeriodEnd: false,
    };
    assert.equal(needsRenewalReminder(ent, now), true);
    assert.equal(needsRenewalReminder({ ...ent, lastReminderForRenewalAt: renewsAt }, now), false);
    assert.equal(needsRenewalReminder({ ...ent, cancelAtPeriodEnd: true }, now), false);
    assert.equal(
      needsRenewalReminder({ ...ent, renewsAt: "2026-08-20T12:00:00.000Z" }, now),
      false,
    );
  });

  it("appends immutable consent audit with paywall snapshot id", () => {
    const ownerId = `audit-test-${Date.now()}`;
    const before = readConsentAudit(ownerId).length;
    const snap = savePaywallSnapshot("<div data-testid='paywall'>Plus $9.99/mo</div>");
    const a = appendConsentAudit({
      ownerId,
      ip: "203.0.113.9",
      userAgent: "test",
      plan: "plus",
      interval: "month",
      amount: 9.99,
      currency: "USD",
      termsVersion: BILLING_TERMS_VERSION,
      priceDisplayed: priceLabel(9.99, "USD", "month"),
      termsDisplayed: "Cancel in two taps.",
      paywallSnapshotId: snap,
    });
    appendConsentAudit({
      ownerId,
      ip: "203.0.113.9",
      userAgent: "test",
      plan: "plus",
      interval: "year",
      amount: 79,
      currency: "USD",
      termsVersion: BILLING_TERMS_VERSION,
      priceDisplayed: priceLabel(79, "USD", "year"),
      termsDisplayed: "Cancel in two taps.",
      paywallSnapshotId: snap,
    });
    const rows = readConsentAudit(ownerId);
    assert.equal(rows.length, before + 2);
    assert.equal(rows[0]!.id, a.id);
    assert.equal(rows[0]!.ip, "203.0.113.9");
    assert.match(rows[0]!.priceDisplayed, /\$9\.99/);
    // Prior rows are never rewritten — ids remain stable on re-read.
    assert.equal(readConsentAudit(ownerId)[0]!.id, a.id);
  });

  it("verifies one-click cancel tokens", () => {
    const { raw, hash } = issueCancelToken();
    assert.equal(verifyCancelToken(raw, hash), true);
    assert.equal(verifyCancelToken("nope", hash), false);
  });

  it("treats cancel-at-period-end as still paid-active for Home CTA", () => {
    assert.equal(
      isPaidActive({
        plan: "plus",
        status: "active",
        renewsAt: "2026-09-01T00:00:00.000Z",
        cancelAtPeriodEnd: true,
      }),
      true,
    );
    assert.equal(
      isPaidActive({ plan: "free", status: "active", renewsAt: null }),
      false,
    );
  });
});
