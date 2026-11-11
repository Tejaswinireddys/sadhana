import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  appendProductEvents,
  captureProduct,
  clearProductEventBuffer,
  readProductEventBuffer,
  trackAppFirstOpen,
  trackAppReturn,
} from "./productAnalytics";
import { makeLoggedEvent } from "../../../funnel/eventLog";
import { writeAnalyticsPrefs } from "./analytics";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("productAnalytics buffer", () => {
  before(() => {
    if (typeof globalThis.localStorage !== "undefined") return;
    const store = new Map<string, string>();
    // @ts-expect-error node stub
    globalThis.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    };
  });

  beforeEach(() => {
    clearProductEventBuffer();
    writeAnalyticsPrefs({ enabled: true });
    try {
      localStorage.removeItem("sadhana.analytics.firstOpenDone");
      localStorage.removeItem("sadhana.analytics.firstOpenAt");
      localStorage.removeItem("sadhana.analytics.lastReturnDay");
    } catch {
      /* ignore */
    }
  });

  it("buffers quiz_started with exact event name and props", async () => {
    await captureProduct("quiz_started", {
      flow_id: "onboarding_v1",
      ref: "pose-tadasana",
      utm_source: "google",
    });
    const buf = readProductEventBuffer();
    assert.ok(buf.length >= 1);
    const last = buf[buf.length - 1]!;
    assert.equal(last.event, "quiz_started");
    assert.equal(last.properties.flow_id, "onboarding_v1");
    assert.equal(last.properties.utm_source, "google");
  });

  it("buffers welcome, class and signup funnel events", async () => {
    await captureProduct("welcome_viewed", { path: "/welcome" });
    await captureProduct("class_started", { slug: "gentle-morning-wake-up", tier: "free", minutes: 10 });
    await captureProduct("class_completed", { slug: "gentle-morning-wake-up", tier: "free", minutes: 10 });
    await captureProduct("signup_completed", { needs_verification: true });
    const names = readProductEventBuffer().map((e) => e.event);
    for (const name of ["welcome_viewed", "class_started", "class_completed", "signup_completed"]) {
      assert.ok(names.includes(name), name);
    }
  });

  it("records app_return with days_since_first_open after the first open day", async () => {
    await trackAppFirstOpen("app");
    const eightDaysLater = new Date();
    eightDaysLater.setDate(eightDaysLater.getDate() + 8);
    // Backdate first open so "today" is day 8.
    localStorage.setItem(
      "sadhana.analytics.firstOpenAt",
      new Date(eightDaysLater.getTime() - 8 * 86_400_000).toISOString(),
    );
    localStorage.removeItem("sadhana.analytics.lastReturnDay");
    await trackAppReturn(eightDaysLater);
    const last = readProductEventBuffer().at(-1);
    assert.equal(last?.event, "app_return");
    assert.equal(last?.properties.days_since_first_open, 8);
  });

  it("accepts appended demo events for the dashboard", () => {
    appendProductEvents([
      makeLoggedEvent("session_completed", { actual_minutes: 10, poses_completed: 4, poses_skipped: 0 }, "t"),
    ]);
    assert.equal(readProductEventBuffer().at(-1)?.event, "session_completed");
  });
});

describe("docs/ANALYTICS.md", () => {
  const doc = readFileSync(resolve("docs/ANALYTICS.md"), "utf8");

  it("documents the PostHog env var and the key funnel events", () => {
    assert.match(doc, /VITE_PUBLIC_POSTHOG_KEY/);
    for (const name of [
      "welcome_viewed",
      "session_started",
      "session_completed",
      "quiz_completed",
      "class_started",
      "class_completed",
      "signup_completed",
      "checkout_started",
      "purchase_completed",
      "app_return",
    ]) {
      assert.match(doc, new RegExp(name));
    }
    assert.match(doc, /Do Not Track|Global Privacy Control/);
  });
});
