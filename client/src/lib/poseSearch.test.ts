import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankedPoses, searchPoses } from "./poseSearch";

describe("rankedPoses — anatomy vs distinctive names", () => {
  it("returns nothing for an empty query", () => {
    assert.deepEqual(rankedPoses(""), []);
    assert.deepEqual(rankedPoses("   "), []);
    assert.deepEqual(searchPoses(""), { items: [], total: 0 });
  });

  it("ranks Hip Openers and pigeon-class poses above Mountain/Tree/Warrior II for hip", () => {
    const ranked = rankedPoses("hip");
    assert.ok(ranked.length > 0, "hip matched nothing");
    // Anatomy maps to the Hip Openers category instead of every cue that says "hips".
    assert.ok(
      ranked.length < 80,
      `hip should not dump the catalog, got ${ranked.length} poses`,
    );

    const top = ranked.slice(0, 8);
    assert.ok(
      top.every((p) => p.category === "Hip Openers" || /hip|pigeon/i.test(p.english)),
      `expected Hip Openers / hip-named poses on top, got ${top.map((p) => `${p.english} [${p.category}]`).join(", ")}`,
    );

    const pigeonIdx = ranked.findIndex((p) => /pigeon/i.test(p.english));
    assert.ok(pigeonIdx >= 0, "expected a pigeon-class pose in hip results");

    for (const noisy of ["Mountain Pose", "Tree Pose", "Warrior II"]) {
      const idx = ranked.findIndex((p) => p.english === noisy);
      assert.ok(
        idx === -1 || idx > pigeonIdx,
        `${noisy} ranked at ${idx}, ahead of pigeon at ${pigeonIdx}`,
      );
      assert.ok(
        idx === -1 || idx >= 8,
        `${noisy} should not lead hip results (index ${idx})`,
      );
    }
  });

  it("keeps pigeon as a small, name-led set", () => {
    const ranked = rankedPoses("pigeon");
    assert.ok(ranked.length > 0, "pigeon matched nothing");
    assert.ok(
      ranked.length <= 12,
      `pigeon should stay tight, got ${ranked.length}: ${ranked.map((p) => p.english).join(", ")}`,
    );
    assert.match(ranked[0].english, /pigeon/i);
    const named = ranked.filter((p) => /pigeon/i.test(p.english));
    assert.ok(named.length >= 2, "expected more than one named pigeon pose");
    // Named pigeons come before poses that only mention pigeon in body text.
    const lastNamed = Math.max(...named.map((p) => ranked.indexOf(p)));
    const firstUnnamed = ranked.findIndex((p) => !/pigeon/i.test(p.english));
    if (firstUnnamed >= 0) {
      assert.ok(
        lastNamed < firstUnnamed || named.length === ranked.length,
        `unnamed match ${ranked[firstUnnamed].english} appeared before a named pigeon`,
      );
    }
  });

  it("maps a core query onto the Core family", () => {
    const ranked = rankedPoses("core");
    assert.ok(ranked.length > 0, "core matched nothing");
    const coreHits = ranked.filter((p) => p.category === "Core");
    assert.ok(coreHits.length >= 5, `expected the Core family in results, got ${coreHits.length}`);
    assert.ok(
      coreHits.some((p) => p.slug === "dolphin-plank"),
      "Dolphin Plank should appear for core",
    );
    assert.ok(
      coreHits.some((p) => p.slug === "dead-bug"),
      "Dead Bug should appear for core",
    );
    assert.ok(
      ranked.some((p) => p.slug === "kumbhakasana"),
      "Plank should appear for a core search even though its family is Backbends",
    );
    assert.ok(
      ranked.some((p) => p.slug === "vasisthasana"),
      "Side Plank should appear for a core search",
    );
    assert.ok(
      ranked.some((p) => p.slug === "navasana"),
      "Boat should appear for a core search",
    );
    const firstCore = ranked.findIndex((p) => p.category === "Core");
    assert.ok(firstCore >= 0, "Core family missing from results");
    const firstFocus = ranked.findIndex((p) =>
      ["dolphin-plank", "dead-bug", "kumbhakasana", "navasana", "vasisthasana"].includes(p.slug),
    );
    assert.ok(firstFocus >= 0 && firstFocus < 3, `core-training poses should lead, first at ${firstFocus}`);
  });
});
