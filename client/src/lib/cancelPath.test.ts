/**
 * Documents the product promise: cancel is reachable in exactly two taps from Home.
 * Tap 1 = Home → /cancel/confirm ; Tap 2 = Confirm cancellation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("two-tap cancel path", () => {
  it("Home exposes a single Cancel subscription control linking to confirm", () => {
    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    assert.match(home, /data-testid="button-home-cancel"/);
    assert.match(home, /href=\{?["']\/cancel\/confirm["']\}?/);
    assert.match(home, /CancelAccessBanner/);
  });

  it("empty subscription state offers Home and sign-in, not only How to cancel", () => {
    const page = readFileSync(resolve("client/src/pages/CancelConfirm.tsx"), "utf8");
    assert.match(page, /No active paid subscription found on this device/);
    assert.match(page, /data-testid="button-cancel-empty-home"/);
    assert.match(page, /href="\/"/);
    assert.match(page, /data-testid="button-cancel-empty-signin"/);
    assert.match(page, /href="\/account"/);
  });

  it("confirm page has one Confirm cancellation action and no retention copy", () => {
    const page = readFileSync(resolve("client/src/pages/CancelConfirm.tsx"), "utf8");
    assert.match(page, /data-testid="button-confirm-cancel"/);
    assert.match(page, /Confirm cancellation/);
    assert.equal(
      /\bare you sure\b|special offer|limited.?time discount|chat with us|call us to cancel/i.test(
        page,
      ),
      false,
    );
  });

  it("public /cancel is linked from paywall and footer with no upsell", () => {
    const cancel = readFileSync(resolve("client/src/pages/Cancel.tsx"), "utf8");
    const plus = readFileSync(resolve("client/src/pages/Plus.tsx"), "utf8");
    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(cancel, /No upsell/);
    assert.match(plus, /data-testid="paywall-cancel-link"/);
    assert.match(layout, /data-testid="footer-cancel"/);
  });
});
