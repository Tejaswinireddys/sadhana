import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { browserDoNotTrack } from "./doNotTrack";

describe("browserDoNotTrack", () => {
  it("is false when unset", () => {
    assert.equal(browserDoNotTrack({}), false);
    assert.equal(browserDoNotTrack({ doNotTrack: "0" }), false);
    assert.equal(browserDoNotTrack(null), false);
  });

  it("honours classic DNT and Global Privacy Control", () => {
    assert.equal(browserDoNotTrack({ doNotTrack: "1" }), true);
    assert.equal(browserDoNotTrack({ doNotTrack: "yes" }), true);
    assert.equal(browserDoNotTrack({ globalPrivacyControl: true }), true);
  });
});
