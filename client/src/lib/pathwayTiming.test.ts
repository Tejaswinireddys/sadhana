import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PATHWAYS, asanaBySlug } from "../data/content.ts";
import {
  catalogSessionLabel,
  catalogSessionMinutes,
  catalogSessionSeconds,
  dailySessionLabel,
  flowSessionLabel,
  flowSessionMinutes,
  poseSides,
  timerOnlySessionSeconds,
  weekSessionLabel,
} from "./pathwayTiming.ts";
import { sessionTimeLabel } from "../data/quickSessions.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUICK_FLOWS = PATHWAYS.filter((p) => p.kind === "flow");

describe("shared catalog timing", () => {
  it("counts each-side holds twice plus a switch", () => {
    assert.equal(poseSides({ holdSeconds: 30, note: "each side" }), "each");
    assert.equal(poseSides({ holdSeconds: 30, sides: "once", note: "each side" }), "once");
    const once = catalogSessionSeconds([{ slug: "tadasana", holdSeconds: 30 }]);
    const each = catalogSessionSeconds([
      { slug: "anjaneyasana", holdSeconds: 30, note: "each side" },
    ]);
    assert.ok(each > once, `each-side ${each} should exceed single-side ${once}`);
  });

  it("matches guided setup for every advertised quick flow", () => {
    assert.equal(QUICK_FLOWS.length, 15);
    for (const p of QUICK_FLOWS) {
      const slug = p.slug;
      assert.ok(p, slug);
      const poses = p.weekPlan[0]?.poses ?? [];
      assert.ok(poses.length > 0, slug);
      const timed = poses.map((pose) => {
        const asana = asanaBySlug(pose.asanaSlug);
        assert.ok(asana, `${slug} missing ${pose.asanaSlug}`);
        return {
          slug: pose.asanaSlug,
          holdSeconds: pose.holdSeconds,
          sides: poseSides(pose),
          stepCount: asana.steps.length,
        };
      });
      assert.equal(flowSessionLabel(p), sessionTimeLabel(timed), slug);
      assert.equal(flowSessionMinutes(p), catalogSessionMinutes(poses), slug);
      assert.ok(
        catalogSessionSeconds(poses) > timerOnlySessionSeconds(poses),
        `${slug} guided time should include narration`,
      );
    }
  });

  it("counts both sides on Front Splits week 1 instead of a holds-only sum", () => {
    const front = PATHWAYS.find((p) => p.slug === "front-splits");
    assert.ok(front);
    const week1 = front.weekPlan[0];
    assert.ok(week1);
    const holdOnly = week1.poses.reduce((s, p) => s + p.holdSeconds, 0);
    const guided = catalogSessionSeconds(week1.poses);
    assert.ok(guided > holdOnly * 1.4, `week 1 guided ${guided} vs holds ${holdOnly}`);
    assert.equal(weekSessionLabel(week1), catalogSessionLabel(week1.poses));
  });

  it("uses the same label for a daily program day and its guided setup", () => {
    const morning = PATHWAYS.find((p) => p.slug === "7-day-morning-ritual");
    assert.ok(morning?.dailyPlan?.[0]);
    const day1 = morning.dailyPlan[0]!;
    const timed = day1.poses.map((pose) => ({
      slug: pose.asanaSlug,
      holdSeconds: pose.holdSeconds,
      sides: poseSides(pose),
      stepCount: asanaBySlug(pose.asanaSlug)?.steps.length ?? 0,
    }));
    assert.equal(dailySessionLabel(day1), sessionTimeLabel(timed));
  });

  it("renders derived minutes on flow cards and week cards, not authored literals", () => {
    const pathways = readFileSync(resolve("client/src/pages/Pathways.tsx"), "utf8");
    assert.match(pathways, /flowSessionLabel/);
    assert.equal(/p\.minutesPerSession \?\? p\.timePerSession/.test(pathways), false);

    const home = readFileSync(resolve("client/src/pages/Home.tsx"), "utf8");
    assert.match(home, /flowSessionLabel/);

    const detail = readFileSync(resolve("client/src/pages/PathwayDetail.tsx"), "utf8");
    assert.match(detail, /weekSessionLabel/);
    assert.equal(/poses\.reduce\(\(sum, p\) => sum \+ p\.holdSeconds/.test(detail), false);

    const daily = readFileSync(resolve("client/src/components/DailyProgram.tsx"), "utf8");
    assert.match(daily, /dailySessionLabel/);
  });
});
