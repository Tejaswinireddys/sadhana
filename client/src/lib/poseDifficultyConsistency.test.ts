import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ASANAS } from "../data/content.ts";
import {
  catalogDifficultyToLevel,
  defaultPoseLevel,
} from "./localPrefs.ts";

/**
 * Catalog `difficulty` is the single source of truth for a pose's level label.
 * Every row must map onto a real variations path, and with no onboarding
 * experience the detail page must open on that path — not Intermediate.
 */
describe("pose difficulty consistency", () => {
  it("every catalog pose maps difficulty onto a real variations path", () => {
    const allowed = new Set(["Beginner", "Intermediate", "Advanced"]);
    for (const asana of ASANAS) {
      assert.ok(allowed.has(asana.difficulty), `${asana.slug}: ${asana.difficulty}`);
      const level = catalogDifficultyToLevel(asana.difficulty);
      assert.ok(asana.variations[level], `${asana.slug} missing variations.${level}`);
      assert.equal(
        defaultPoseLevel(null, asana.difficulty),
        level,
        `${asana.slug}: unset experience must follow catalog difficulty`,
      );
    }
  });

  it("tadasana defaults to beginner, matching its Level field", () => {
    const tadasana = ASANAS.find((a) => a.slug === "tadasana");
    assert.ok(tadasana);
    assert.equal(tadasana.difficulty, "Beginner");
    assert.equal(defaultPoseLevel(null, tadasana.difficulty), "beginner");
    assert.equal(defaultPoseLevel(undefined, tadasana.difficulty), "beginner");
  });
});
