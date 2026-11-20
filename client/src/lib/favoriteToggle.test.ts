import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyFavoriteToggle } from "./favoriteToggle.ts";

describe("optimistic pose favorites", () => {
  it("adds a slug immediately and does not duplicate it", () => {
    assert.deepEqual(applyFavoriteToggle([], "tadasana", false), ["tadasana"]);
    assert.deepEqual(applyFavoriteToggle(["tadasana"], "tadasana", false), ["tadasana"]);
  });

  it("removes a slug immediately", () => {
    assert.deepEqual(applyFavoriteToggle(["tadasana", "balasana"], "tadasana", true), ["balasana"]);
  });

  it("leaves the previous list untouched so a failed request can roll back", () => {
    const before = ["balasana"];
    const next = applyFavoriteToggle(before, "tadasana", false);
    assert.deepEqual(before, ["balasana"]);
    assert.deepEqual(next, ["balasana", "tadasana"]);
  });
});
