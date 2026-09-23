import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { composeTrainerSession, NEED_OPTIONS, TIME_OPTIONS } from "./yogaTrainer.ts";
import { generateAdaptiveSession } from "./adaptiveGenerator.ts";
import {
  adjustedPractice,
  alternativePractices,
  type HomeContext,
} from "./homeRecommendation.ts";
import { countOf, posesQueued } from "./plural.ts";

const ctx = (over: Partial<HomeContext> = {}): HomeContext => ({
  programDay: null,
  quizPlan: null,
  profile: null,
  intent: null,
  experience: "new",
  hour: 14,
  preferredMinutes: 15,
  hasPracticed: true,
  warmup: null,
  ...over,
});

describe("a generated session says its own length", () => {
  it("the trainer names the minutes it produced, not the minutes requested", () => {
    // The report: "Here are 5 minutes" above a nine-minute practice.
    for (const minutes of TIME_OPTIONS) {
      for (const { id } of NEED_OPTIONS) {
        const s = composeTrainerSession({
          body: ["Great"],
          soreParts: [],
          energy: "Balanced",
          timeMinutes: minutes,
          need: id,
        });
        const said = s.reasoning.match(/(\d+) minutes/);
        assert.ok(said, `no duration in: ${s.reasoning}`);
        assert.equal(
          Number(said![1]),
          s.totalMinutes,
          `${minutes}min/${id}: says ${said![1]}, runs ${s.totalMinutes}`,
        );
      }
    }
  });

  it("a five-minute request is answered with five minutes, not an apology", () => {
    const s = composeTrainerSession({
      body: ["Great"],
      soreParts: [],
      energy: "Balanced",
      timeMinutes: 5,
      need: "movement",
    });
    assert.equal(s.fit.fits, true, s.fit.explanation ?? "");
    assert.ok(s.totalMinutes <= 6, `ran ${s.totalMinutes} min`);
    // Fewer poses, not rushed ones.
    assert.ok(s.poses.length >= 3, "a practice needs more than a couple of shapes");
    assert.equal(s.fit.explanation, null);
  });

  it("never shows 'Shortened to fit' next to a session that does not fit", () => {
    for (const minutes of TIME_OPTIONS) {
      const s = composeTrainerSession({
        body: ["Great"],
        soreParts: [],
        energy: "Balanced",
        timeMinutes: minutes,
        need: "movement",
      });
      if (s.trimNote && !s.fit.fits) {
        // The badge is gated on fit in Trainer.tsx; the note itself must then
        // not claim the request was met.
        assert.doesNotMatch(s.trimNote, /really is about \d+ minutes/);
      }
    }
  });
});

describe("the adaptive plan explains its length once", () => {
  it("has exactly one duration sentence, from the final queue", () => {
    for (const minutes of [10, 15, 20, 25]) {
      const r = generateAdaptiveSession({ intentMinutes: minutes });
      const duration = r.explanations.filter((e) => /\d+ minutes|\d+ min\b/.test(e));
      assert.equal(
        duration.length,
        1,
        `${minutes}min produced ${duration.length}: ${duration.join(" | ")}`,
      );
      const said = duration[0]!.match(/runs (\d+) min/);
      if (said) {
        assert.equal(Number(said[1]), r.session.totalMinutes);
      }
    }
  });

  it("lands inside the requested length", () => {
    for (const minutes of [10, 15, 20, 25]) {
      const r = generateAdaptiveSession({ intentMinutes: minutes });
      const tolerance = Math.max(45, minutes * 60 * 0.15);
      const over = r.session.totalSeconds - minutes * 60;
      assert.ok(
        over <= tolerance || r.session.fit.explanation,
        `${minutes}min ran ${r.session.totalMinutes}min with no explanation`,
      );
    }
  });
});

describe("Today's adjustment copy", () => {
  it("only claims the requested length when it got it", () => {
    const five = adjustedPractice(ctx({ preferredMinutes: 5 }), { minutes: 5, need: null });
    const said = five.reason.match(/(\d+) minutes/);
    assert.ok(said);
    if (Number(said![1]) === 5) {
      assert.match(five.reason, /at the length you asked for/);
    } else {
      assert.doesNotMatch(five.reason, /at the length you asked for/);
      assert.match(five.reason, /closest/);
    }
  });
});

describe("alternatives are about the focus on screen", () => {
  it("compares against the selected focus, not an assumed one", () => {
    const withMovement = ctx({ preferredNeed: "movement" });
    const primary = adjustedPractice(withMovement, { minutes: 15, need: "movement" });
    const alts = alternativePractices(withMovement, primary);
    const blob = alts.map((a) => `${a.title} ${a.reason}`).join(" | ");
    // The report: "Wake up instead … rather than settling" beside "Just move".
    assert.doesNotMatch(blob, /rather than settling/i);
    assert.match(blob, /same just move focus/i);
  });

  it("does not offer 'something gentler' when nothing is gentler", () => {
    for (const need of ["calm", "sleep"]) {
      const c = ctx({ preferredNeed: need });
      const alts = alternativePractices(c, adjustedPractice(c, { minutes: 15, need }));
      assert.equal(
        alts.some((a) => a.title === "Something gentler"),
        false,
        `${need} was offered something gentler than itself`,
      );
    }
  });

  it("never offers the practice already on screen as an alternative", () => {
    for (const need of ["movement", "calm", "strength", "sleep", "energy"]) {
      const c = ctx({ preferredNeed: need });
      const primary = adjustedPractice(c, { minutes: 15, need });
      const sig = (r: { poses: { slug: string }[] }) => r.poses.map((p) => p.slug).join(">");
      const alts = alternativePractices(c, primary);
      const all = [sig(primary), ...alts.map(sig)];
      assert.equal(new Set(all).size, all.length, `${need}: a duplicate practice was offered`);
    }
  });
});

describe("counted nouns", () => {
  it("agrees with one", () => {
    assert.equal(posesQueued(1), "1 pose queued");
    assert.equal(posesQueued(4), "4 poses queued");
    assert.equal(countOf(1, "pose"), "1 pose");
    assert.equal(countOf(0, "pose"), "0 poses");
    assert.equal(countOf(1, "minute"), "1 minute");
  });
});
