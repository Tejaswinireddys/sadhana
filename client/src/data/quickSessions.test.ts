import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { asanaBySlug } from "./content.ts";
import {
  QUICK_SESSIONS,
  preSessionSummary,
  quickSessionMeta,
  sessionMinutes,
  sessionTimeLabel,
} from "./quickSessions.ts";

describe("mood-session duration on the confirm screen", () => {
  it("shows I'm tired as 4 poses · 7 min, matching the hub card", () => {
    const tired = QUICK_SESSIONS.find((q) => q.id === "tired");
    assert.ok(tired);
    assert.equal(tired.poses.length, 4);
    assert.equal(sessionTimeLabel(tired.poses), "7 min");
    assert.equal(quickSessionMeta(tired).plannedMinutes, 7);
    assert.equal(
      preSessionSummary({
        label: tired.label,
        poseCount: tired.poses.length,
        minutes: sessionMinutes(tired.poses),
      }),
      "I'm tired · 4 poses · 7 min · a continuous voice-narrated flow.",
    );
  });

  it("uses the same derived minutes on every hub card and its session meta", () => {
    for (const q of QUICK_SESSIONS) {
      const minutes = sessionMinutes(q.poses);
      assert.equal(sessionTimeLabel(q.poses), `${minutes} min`, q.id);
      assert.equal(quickSessionMeta(q).plannedMinutes, minutes, q.id);
      assert.match(
        preSessionSummary({
          label: q.label,
          poseCount: q.poses.length,
          minutes,
        }),
        new RegExp(`${q.poses.length} poses · ${minutes} min`),
      );
      for (const p of q.poses) {
        assert.ok(asanaBySlug(p.slug), `${q.id} missing ${p.slug}`);
      }
    }
  });

  it("puts that summary on the guided pre-session screen", () => {
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    const preStart = src.slice(src.indexOf("// ---- pre-start"));
    assert.match(preStart, /preSessionSummary/);
    assert.match(preStart, /data-testid="pre-session-summary"/);
    assert.match(preStart, /plannedMinutes \?\? sessionMinutes\(todays\)/);
    assert.equal(/\{todays\.length\} poses · a continuous/.test(preStart), false);
  });
});
