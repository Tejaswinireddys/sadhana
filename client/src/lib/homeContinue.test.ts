import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { continueRowState } from "./homeContinue";

describe("continueRowState", () => {
  it("holds a placeholder while class progress is still loading, even if programs have loaded", () => {
    assert.equal(continueRowState({ classProgressPending: true, programsPending: false, hasItems: false }), "loading");
    assert.equal(continueRowState({ classProgressPending: true, programsPending: false, hasItems: true }), "loading",
      "no card popping in after the row has rendered");
  });

  it("holds a placeholder while program progress is still loading", () => {
    assert.equal(continueRowState({ classProgressPending: false, programsPending: true, hasItems: false }), "loading");
  });

  it("says 'Nothing in progress' only once everything has loaded empty", () => {
    assert.equal(continueRowState({ classProgressPending: false, programsPending: false, hasItems: false }), "empty");
    assert.equal(continueRowState({ classProgressPending: false, programsPending: false, hasItems: true }), "items");
  });
});
