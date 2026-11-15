import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EIGHT_LIMBS, limbForDay } from "./eightLimbs.ts";

describe("eight limbs", () => {
  it("lists eight limbs with IAST, Devanagari, and a practice link", () => {
    assert.equal(EIGHT_LIMBS.length, 8);
    for (const limb of EIGHT_LIMBS) {
      assert.ok(limb.iast.length > 1, limb.slug);
      assert.ok(limb.devanagari.length > 0, limb.slug);
      assert.match(limb.practiceHref, /^\//);
      assert.doesNotMatch(limb.body, /guaranteed|enlightenment|will awaken/i);
    }
    assert.equal(EIGHT_LIMBS[0]?.slug, "yama");
    assert.equal(EIGHT_LIMBS[7]?.slug, "samadhi");
  });

  it("advances one limb per calendar day and wraps", () => {
    assert.equal(limbForDay("2026-11-01", "2026-11-01").slug, "yama");
    assert.equal(limbForDay("2026-11-01", "2026-11-02").slug, "niyama");
    assert.equal(limbForDay("2026-11-01", "2026-11-09").slug, "yama");
  });

  it("says where translations differ, and does not require a theology", () => {
    const yama = EIGHT_LIMBS.find((limb) => limb.slug === "yama");
    const niyama = EIGHT_LIMBS.find((limb) => limb.slug === "niyama");
    assert.match(yama?.body ?? "", /Translators disagree/);
    assert.match(niyama?.body ?? "", /without sharing that theology/);
  });
});
