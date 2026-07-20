import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidDeviceId } from "./owner";

describe("isValidDeviceId", () => {
  it("accepts a UUID v4", () => {
    assert.equal(isValidDeviceId("550e8400-e29b-41d4-a716-446655440000"), true);
  });

  it("rejects empty / short / non-uuid strings", () => {
    assert.equal(isValidDeviceId(""), false);
    assert.equal(isValidDeviceId("not-a-uuid"), false);
    assert.equal(isValidDeviceId("550e8400-e29b-41d4-a716"), false);
  });
});
