/**
 * Source + unit contracts for the QA follow-up batch (paused breathing,
 * chair check-in, reset copy, cancel empty state, analytics split, Core
 * filter, adaptive lock/swap).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ASANAS } from "../data/content";
import { matchesCategoryFilter } from "../data/poseTaxonomy";
import { breathDisplayRound, breathTickDelta } from "./breathingClock";
import { mobilityCheckInCopy } from "./mobilityCheckIn";
import { pickEasierSwap } from "./adaptiveGenerator";
import { careAgreement } from "./yogaTrainer";

describe("paused breathing progress", () => {
  it("keeps the in-progress round while paused, not idle Round 0", () => {
    assert.equal(
      breathDisplayRound({ started: false, done: false, completedRounds: 0, totalRounds: 8 }),
      0,
    );
    assert.equal(
      breathDisplayRound({ started: true, done: false, completedRounds: 0, totalRounds: 8 }),
      1,
    );
    assert.equal(
      breathDisplayRound({ started: true, done: false, completedRounds: 2, totalRounds: 8 }),
      3,
    );
    assert.equal(
      breathDisplayRound({ started: true, done: true, completedRounds: 8, totalRounds: 8 }),
      8,
    );
  });

  it("does not skip wall-clock time across a long pause", () => {
    const paused = breathTickDelta(null, 40_000);
    assert.equal(paused.dt, 0);
    assert.equal(paused.nextLast, 40_000);
    const next = breathTickDelta(paused.nextLast, 40_250);
    assert.equal(next.dt, 0.25);
  });
});

describe("program-specific mobility check-in", () => {
  it("uses seated comfort/range for the chair program, not floor splits", () => {
    const chair = mobilityCheckInCopy("chair-limited-mobility");
    assert.equal(chair.mode, "chair");
    assert.match(chair.primaryLabel, /Comfort/);
    assert.match(chair.secondaryLabel, /Seated range/);
    assert.equal(/front hip|half-split|Front split|Backbend depth/i.test(chair.prompt), false);
    assert.equal(/front hip|half-split|Front split/i.test(chair.followUpPrompt), false);
    assert.match(chair.prompt, /chair/i);
  });

  it("keeps split measurements for the splits program", () => {
    const splits = mobilityCheckInCopy("sixty-day-splits");
    assert.equal(splits.mode, "splits");
    assert.match(splits.primaryLabel, /Front split/);
  });
});

describe("reset-password copy", () => {
  it("does not tell production users to read server logs", () => {
    const src = readFileSync(resolve("client/src/pages/Account.tsx"), "utf8");
    assert.equal(/server logs/i.test(src), false);
    assert.match(src, /emailEnabled/);
    assert.match(src, /privacy@sadhana\.app/);
    assert.match(src, /\/api\/auth\/mail-status/);
  });
});

describe("analytics consumer vs operator", () => {
  it("Privacy no longer deep-links guests into the operator dashboard", () => {
    const privacy = readFileSync(resolve("client/src/pages/Privacy.tsx"), "utf8");
    assert.equal(/\/analytics\/funnel/.test(privacy), false);
  });

  it("hides demo controls, env-var names, and SQL unless DEV", () => {
    const dash = readFileSync(resolve("client/src/pages/FunnelDashboard.tsx"), "utf8");
    assert.match(dash, /import\.meta\.env\.DEV/);
    assert.equal(/VITE_PUBLIC_POSTHOG_KEY/.test(dash), false);
    assert.match(dash, /isOperator && \(/);
    assert.match(dash, /Load demo data/);
    assert.match(dash, /this browser only/);
  });
});

describe("adaptive lock and easier swap", () => {
  it("does not pick an easier pose already in the session", () => {
    const pick = pickEasierSwap("tadasana", ["tadasana", "balasana", "savasana"]);
    assert.ok(pick);
    assert.notEqual(pick, "tadasana");
    assert.notEqual(pick, "balasana");
    assert.notEqual(pick, "savasana");
  });

  it("disables swap while a pose is locked", () => {
    const src = readFileSync(resolve("client/src/pages/AdaptivePlan.tsx"), "utf8");
    assert.match(src, /disabled=\{isLocked\}/);
    assert.match(src, /Lock keeps a pose when you regenerate/);
    assert.match(src, /pickEasierSwap/);
  });
});

describe("Core filter training focus", () => {
  it("includes Plank, Side Plank, and Boat without recategorizing them", () => {
    const plank = ASANAS.find((a) => a.slug === "kumbhakasana");
    const side = ASANAS.find((a) => a.slug === "vasisthasana");
    const boat = ASANAS.find((a) => a.slug === "navasana");
    assert.ok(plank && side && boat);
    assert.equal(plank.category, "Backbends");
    assert.equal(side.category, "Backbends");
    assert.equal(boat.category, "Seated");
    assert.equal(matchesCategoryFilter(plank, "Core"), true);
    assert.equal(matchesCategoryFilter(side, "Core"), true);
    assert.equal(matchesCategoryFilter(boat, "Core"), true);
    assert.equal(matchesCategoryFilter(plank, "Backbends"), true);
    assert.equal(matchesCategoryFilter(boat, "Seated"), true);
    const tadasana = ASANAS.find((a) => a.slug === "tadasana")!;
    assert.equal(matchesCategoryFilter(tadasana, "Core"), false);
  });
});

describe("trainer care grammar", () => {
  it("agrees with plural body parts", () => {
    assert.equal(careAgreement(["Knees"]), "are");
    assert.equal(careAgreement(["Hips"]), "are");
    assert.equal(careAgreement(["Neck"]), "is");
    assert.equal(careAgreement(["Lower back"]), "is");
    assert.equal(careAgreement(["Knees", "Wrists"]), "are");
  });
});
