import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  appendProductEvents,
  captureProduct,
  clearProductEventBuffer,
  readProductEventBuffer,
} from "./productAnalytics";
import { makeLoggedEvent } from "../../../funnel/eventLog";
import { writeAnalyticsPrefs } from "./analytics";

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

  it("accepts appended demo events for the dashboard", () => {
    appendProductEvents([
      makeLoggedEvent("session_completed", { actual_minutes: 10, poses_completed: 4, poses_skipped: 0 }, "t"),
    ]);
    assert.equal(readProductEventBuffer().at(-1)?.event, "session_completed");
  });
});
