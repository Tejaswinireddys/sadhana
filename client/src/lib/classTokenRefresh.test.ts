import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_TOKEN_REFRESH_LEAD_MS,
  CLASS_TOKEN_RETRY_MS,
  restorePoint,
  tokenRefreshDelayMs,
  tokenRefreshDue,
  tokenRetryDelayMs,
} from "./classTokenRefresh";
import { CLASS_TOKEN_SECONDS } from "@shared/classLibrary";

describe("class token refresh", () => {
  const now = 1_800_000_000_000;
  const expiresAt = now / 1000 + CLASS_TOKEN_SECONDS;

  it("refreshes five minutes before a fresh 1h token expires", () => {
    assert.equal(tokenRefreshDelayMs(expiresAt, now), CLASS_TOKEN_SECONDS * 1000 - CLASS_TOKEN_REFRESH_LEAD_MS);
    assert.equal(tokenRefreshDue(expiresAt, now), false);
  });

  it("is due immediately inside the lead window or after expiry (a tab that slept)", () => {
    assert.equal(tokenRefreshDelayMs(expiresAt, expiresAt * 1000 - 60_000), 0);
    assert.equal(tokenRefreshDelayMs(expiresAt, expiresAt * 1000 + 3_600_000), 0);
    assert.equal(tokenRefreshDue(expiresAt, expiresAt * 1000 - 60_000), true);
  });

  it("never schedules past setTimeout's limit", () => {
    assert.equal(tokenRefreshDelayMs(now / 1000 + 10 * 365 * 86400, now), 2_147_483_647);
  });

  it("retries a failed refresh soon, but not past the expiry", () => {
    assert.equal(tokenRetryDelayMs(expiresAt, now), CLASS_TOKEN_RETRY_MS);
    assert.equal(tokenRetryDelayMs(expiresAt, expiresAt * 1000 - 5_000), 5_000);
    assert.equal(tokenRetryDelayMs(expiresAt, expiresAt * 1000 + 5_000), CLASS_TOKEN_RETRY_MS, "after expiry, keep retrying at the normal pace");
  });

  it("captures where to resume after the token swap reloads the stream", () => {
    assert.deepEqual(restorePoint({ currentTime: 1234.5, paused: false }), { at: 1234.5, play: true });
    assert.deepEqual(restorePoint({ currentTime: 90, paused: true }), { at: 90, play: false });
    assert.deepEqual(restorePoint({ currentTime: Number.NaN, paused: true }), { at: 0, play: false });
    assert.deepEqual(restorePoint(null), { at: 0, play: false });
  });
});
