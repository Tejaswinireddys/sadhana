import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQuizPlan, parseProgramRef, PROGRAM_SEEDS } from "./quizPlan.ts";
import { asanaBySlug } from "./content.ts";

describe("quizPlan", () => {
  it("builds a real pose queue with resolvable slugs", () => {
    const plan = buildQuizPlan({
      goal: "calm",
      body: "full",
      experience: "new",
      time: "10",
      habit: "busy",
    });
    assert.ok(plan.poses.length >= 4);
    assert.ok(plan.minutes >= 5);
    assert.ok(plan.poseNames.length >= 3);
    for (const p of plan.poses) {
      assert.ok(asanaBySlug(p.slug), `missing asana ${p.slug}`);
    }
  });

  it("honors sleep and strength goals with distinct titles", () => {
    const sleep = buildQuizPlan({ goal: "sleep", body: "breath", time: "20" });
    const strength = buildQuizPlan({ goal: "strength", body: "full", time: "20" });
    assert.match(sleep.title, /Sleep/i);
    assert.match(strength.title, /Strength/i);
    assert.notEqual(sleep.poses[0]?.slug, strength.poses[0]?.slug);
  });

  it("keeps a 10-minute sleep quiz near 10 minutes", () => {
    const plan = buildQuizPlan({
      goal: "sleep",
      body: "full",
      experience: "new",
      time: "10",
      habit: "unsure",
    });
    assert.match(plan.title, /Sleep/i);
    assert.ok(plan.minutes >= 8, `expected ≥8 min, got ${plan.minutes}`);
    assert.ok(plan.minutes <= 12, `expected ≤12 min, got ${plan.minutes}`);
    assert.match(plan.timeLabel, /\d+ min/);
  });

  it("honors 20 and 30 minute budgets within a small window", () => {
    const twenty = buildQuizPlan({ goal: "calm", body: "full", experience: "new", time: "20" });
    const thirty = buildQuizPlan({ goal: "strength", body: "full", experience: "some", time: "30" });
    assert.ok(twenty.minutes >= 18 && twenty.minutes <= 22, `20-min plan was ${twenty.minutes}`);
    assert.ok(thirty.minutes >= 26 && thirty.minutes <= 32, `30-min plan was ${thirty.minutes}`);
  });

  it("parses program refs from the landing tiles", () => {
    assert.deepEqual(parseProgramRef("?ref=program-desk"), PROGRAM_SEEDS["program-desk"]);
    assert.equal(parseProgramRef("?ref=unknown"), null);
  });
});
