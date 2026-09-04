import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buddyPairingError } from "./buddyPairing.ts";

describe("buddy pairing validation", () => {
  it("rejects an empty code with a specific message", () => {
    assert.match(buddyPairingError("   ", "SB-AAAAAA") ?? "", /SB-/);
    assert.equal(buddyPairingError("SB-ZZZZZZ", "SB-AAAAAA"), null);
    assert.match(buddyPairingError("SB-AAAAAA", "SB-AAAAAA") ?? "", /own code/);
  });
});
