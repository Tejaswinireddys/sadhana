import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRACTICE_DATA_QUERY_KEYS } from "./practiceDataSync.ts";
import { completionLeavePath } from "./guidedCompletion.ts";

describe("practice data sync keys", () => {
  it("covers journal and session stats for cross-tab refresh", () => {
    const keys = PRACTICE_DATA_QUERY_KEYS.map((k) => k.join("/"));
    assert.ok(keys.includes("/api/journal"));
    assert.ok(keys.some((k) => k.includes("sessions")));
  });
});

describe("completion Reflect attaches to the saved journal entry", () => {
  it("uses edit= when an auto-save id is present", () => {
    assert.equal(
      completionLeavePath("journal", { title: "Flow", body: "Nice", editId: 17 }),
      "/journal?edit=17",
    );
  });
});
