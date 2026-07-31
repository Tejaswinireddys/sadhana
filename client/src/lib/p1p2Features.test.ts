import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_EVENTS, track, readAnalyticsCounts, writeAnalyticsPrefs } from "./analytics";
import { pronunciationFor } from "./sanskritPronunciation";
import { DEFAULT_HABIT_PLAN, isHabitDay, inQuietHours } from "./habitPlan";
import { PLANS } from "./plans";
import { CONTENT_SCHEMA_VERSION } from "../data/contentProvenance";
import { PATHWAYS, asanaBySlug } from "../data/content";

describe("analytics taxonomy", () => {
  it("lists stable event names", () => {
    assert.ok(ANALYTICS_EVENTS.includes("practice_start"));
    assert.ok(ANALYTICS_EVENTS.includes("practice_complete"));
  });

  it("ignores events when analytics are off", () => {
    writeAnalyticsPrefs({ enabled: false });
    const before = { ...readAnalyticsCounts() };
    track("practice_start");
    assert.deepEqual(readAnalyticsCounts(), before);
  });
});

describe("sanskrit pronunciation", () => {
  it("knows mountain pose", () => {
    const p = pronunciationFor("tadasana", "Tadasana");
    assert.match(p.approx, /tah/i);
  });

  it("falls back for unknown slugs", () => {
    const p = pronunciationFor("unknown-pose", "Unknown");
    assert.equal(p.transliteration, "Unknown");
  });
});

describe("habit plan", () => {
  it("detects configured weekdays", () => {
    const monday = new Date("2026-07-27T12:00:00"); // Monday
    assert.equal(isHabitDay({ ...DEFAULT_HABIT_PLAN, days: [1] }, monday), true);
    assert.equal(isHabitDay({ ...DEFAULT_HABIT_PLAN, days: [2] }, monday), false);
  });

  it("handles overnight quiet hours", () => {
    const late = new Date("2026-07-27T22:00:00");
    assert.equal(
      inQuietHours({ ...DEFAULT_HABIT_PLAN, quietHoursStart: 21, quietHoursEnd: 7 }, late),
      true,
    );
  });
});

describe("plans scaffolding", () => {
  it("keeps free forever features listed", () => {
    const free = PLANS.find((p) => p.id === "free");
    assert.ok(free?.alwaysIncluded);
    assert.ok(free!.bullets.some((b) => /safety/i.test(b)));
  });
});

describe("content schema + outcome programs", () => {
  it("exposes a content schema version", () => {
    assert.match(CONTENT_SCHEMA_VERSION, /^\d{4}/);
  });

  it("includes beginner, stress, and limited-mobility programs with real poses", () => {
    for (const slug of [
      "foundations-beginner",
      "stress-release-week",
      "chair-limited-mobility",
      "better-sleep-flow",
    ]) {
      const p = PATHWAYS.find((x) => x.slug === slug);
      assert.ok(p, `missing pathway ${slug}`);
      const poses =
        p!.kind === "daily"
          ? (p!.dailyPlan ?? []).flatMap((d) => d.poses)
          : (p!.weekPlan[0]?.poses ?? []);
      assert.ok(poses.length > 0, `${slug} has no poses`);
      for (const pose of poses) {
        assert.ok(asanaBySlug(pose.asanaSlug), `${slug} references missing ${pose.asanaSlug}`);
      }
    }
  });
});
