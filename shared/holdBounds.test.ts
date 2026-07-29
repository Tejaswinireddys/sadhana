import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampHoldSeconds,
  insertCustomFlowSchema,
  MAX_HOLD_SECONDS,
  MIN_HOLD_SECONDS,
} from "./schema";

const flow = (poseSequence: string) => ({
  name: "Test flow",
  description: null,
  poseSequence,
  createdAt: new Date().toISOString(),
  lastUsedAt: null,
});

describe("clampHoldSeconds", () => {
  it("rejects the mangled negative that produced a 33-minute Mountain Pose", () => {
    assert.equal(clampHoldSeconds(-999), MIN_HOLD_SECONDS);
    assert.equal(clampHoldSeconds(1999), MAX_HOLD_SECONDS);
  });

  it("falls back to a sane default for garbage", () => {
    assert.equal(clampHoldSeconds("abc"), 30);
    assert.equal(clampHoldSeconds(NaN), 30);
    assert.equal(clampHoldSeconds(undefined), 30);
  });

  it("leaves valid values alone", () => {
    assert.equal(clampHoldSeconds(45), 45);
  });
});

describe("insertCustomFlowSchema — server-side hold bounds", () => {
  it("rejects an over-long hold even though the client sent it happily", () => {
    const res = insertCustomFlowSchema.safeParse(
      flow(JSON.stringify([{ slug: "tadasana", holdSeconds: 1999 }])),
    );
    assert.equal(res.success, false);
  });

  it("rejects a negative hold", () => {
    const res = insertCustomFlowSchema.safeParse(
      flow(JSON.stringify([{ slug: "tadasana", holdSeconds: -999 }])),
    );
    assert.equal(res.success, false);
  });

  it("rejects a sequence with no poses", () => {
    assert.equal(insertCustomFlowSchema.safeParse(flow("[]")).success, false);
  });

  it("rejects malformed JSON rather than storing it", () => {
    assert.equal(insertCustomFlowSchema.safeParse(flow("not json")).success, false);
  });

  it("accepts a sequence inside the allowed range", () => {
    const res = insertCustomFlowSchema.safeParse(
      flow(
        JSON.stringify([
          { slug: "tadasana", holdSeconds: MIN_HOLD_SECONDS },
          { slug: "balasana", holdSeconds: MAX_HOLD_SECONDS, sides: "once" },
        ]),
      ),
    );
    assert.equal(res.success, true, JSON.stringify(res.error?.issues));
  });
});
