import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asanaBySlug } from "@/data/content";
import { profileById } from "@/data/profiles";
import { composeTrainerSession } from "./yogaTrainer.ts";
import { recommendPractice } from "./homeRecommendation.ts";
import { poseBlockedReason } from "./bodyFilters.ts";

describe("body limits", () => {
  it("blocks inversions for high blood pressure and pregnancy", () => {
    const dog = asanaBySlug("adho-mukha-svanasana");
    assert.ok(dog);
    assert.equal(poseBlockedReason(dog, ["no-inversions"]), "no inversions");
    assert.equal(poseBlockedReason(dog, ["pregnancy"]), "pregnancy");
    assert.equal(poseBlockedReason(dog, []), null);
  });

  it("does not block Mountain Pose for wrists or knees", () => {
    const mountain = asanaBySlug("tadasana");
    assert.ok(mountain);
    assert.equal(poseBlockedReason(mountain, ["wrists", "knees", "no-jumping"]), null);
  });

  it("keeps the chosen path and drops the inversion it cannot keep", () => {
    const profile = profileById("stress-relief");
    assert.ok(profile);
    const base = {
      programDay: null,
      quizPlan: null,
      profile,
      intent: null,
      experience: "some" as const,
      hour: 12,
      preferredMinutes: null,
      hasPracticed: true,
      warmup: null,
    };
    const plain = recommendPractice(base);
    assert.equal(plain?.source, "profile");
    assert.equal(plain?.title, "Stress Relief session");
    assert.ok(plain?.poses.some((p) => p.slug === "viparita-karani"));

    const limited = recommendPractice({ ...base, bodyFilters: ["no-inversions"] });
    assert.equal(limited?.source, "profile");
    assert.equal(limited?.title, "Stress Relief session");
    assert.equal(limited?.poses.some((p) => p.slug === "viparita-karani"), false);
    assert.ok(limited?.poses.some((p) => p.slug === "sukhasana"));
    assert.match(limited?.reason ?? "", /Left out/);
  });

  it("a ten-minute practice still fits after inversions are removed", () => {
    const session = composeTrainerSession(
      { body: ["Great"], soreParts: [], energy: "Balanced", timeMinutes: 10, need: "movement" },
      { bodyFilters: ["no-inversions"] },
    );
    assert.equal(session.fit.fits, true, session.fit.explanation ?? "");
    for (const pose of session.poses) {
      const asana = asanaBySlug(pose.slug);
      assert.ok(asana);
      assert.equal(poseBlockedReason(asana, ["no-inversions"]), null, pose.slug);
    }
  });
});
