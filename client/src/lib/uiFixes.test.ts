import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDuration, formatHold, formatClock } from "./formatDuration";
import { searchPoses } from "./poseSearch";
import { isCorrect, makeParentGateQuestion } from "./parentGate";
import { toggleBodyAnswer, toggleBodyPart, moodFromEnergy } from "./yogaTrainer";

describe("formatDuration — one convention everywhere", () => {
  it("does not mix '2 min' and '3m 10s' styles", () => {
    // Builder said "3 min 10s", Trainer said "3m 10s", both in the same list.
    assert.equal(formatDuration(120), "2 min");
    assert.equal(formatDuration(190), "3 min 10 sec");
    assert.equal(formatDuration(45), "45 sec");
  });

  it("qualifies bilateral holds", () => {
    assert.equal(formatHold(45, "each"), "45 sec each side");
    assert.equal(formatHold(45, "once"), "45 sec");
  });

  it("keeps clock notation for the live countdown only", () => {
    assert.equal(formatClock(65), "1:05");
    assert.equal(formatClock(5), "0:05");
  });
});

describe("searchPoses — typeahead", () => {
  it("returns live matches instead of nothing but 'Search for …'", () => {
    const { items, total } = searchPoses("warrior");
    assert.ok(total > 1, `expected multiple warrior poses, got ${total}`);
    assert.ok(items.length > 0);
    assert.ok(
      items.some((p) => /warrior/i.test(p.english)),
      `no warrior in ${items.map((p) => p.english).join(", ")}`,
    );
  });

  it("ranks name matches above body-text matches", () => {
    // "warrior" matches 12 poses, but only 5 have it in the name — the rest
    // merely mention it in step text. In catalog order a body-only match
    // appears 5th, so an unranked list leaks them into the 6-item preview.
    const { items } = searchPoses("warrior", 6);
    const named = items.filter((p) => /warrior/i.test(p.english) || /warrior/i.test(p.sanskrit));
    assert.ok(
      named.length >= 5,
      `expected every named Warrior pose before body-text matches, got ${items
        .map((p) => p.english)
        .join(", ")}`,
    );
    // And the very first suggestion is always a name match.
    assert.match(items[0].english, /warrior/i);
  });

  it("handles squashed queries", () => {
    const { items } = searchPoses("downdog");
    assert.ok(items.length > 0, "downdog matched nothing");
  });

  it("returns nothing for an empty query", () => {
    assert.deepEqual(searchPoses("   "), { items: [], total: 0 });
  });

  it("caps the preview but reports the true total", () => {
    const { items, total } = searchPoses("a", 6);
    assert.ok(items.length <= 6);
    assert.ok(total >= items.length);
  });
});

describe("parent gate", () => {
  it("is no longer solvable by the children it exists to stop", () => {
    for (let i = 0; i < 200; i++) {
      const q = makeParentGateQuestion();
      assert.ok(q.a >= 12 && q.a <= 29, `a=${q.a}`);
      assert.ok(q.b >= 11 && q.b <= 19, `b=${q.b}`);
      // Both operands two-digit: no more "4 + 8".
      assert.ok(q.a * q.b >= 132, `product too small: ${q.a}×${q.b}`);
    }
  });

  it("accepts the right answer and rejects everything else", () => {
    const q = { a: 17, b: 14 };
    assert.equal(isCorrect(q, "238"), true);
    assert.equal(isCorrect(q, "31"), false, "must not accept the sum");
    assert.equal(isCorrect(q, ""), false);
    assert.equal(isCorrect(q, "abc"), false);
  });
});

describe("Trainer answer exclusivity", () => {
  it("does not let 'Great' and 'Injured' coexist", () => {
    let body = toggleBodyAnswer([], "Great");
    body = toggleBodyAnswer(body, "Injured");
    assert.deepEqual(body, ["Injured"], "contradictory answers were both kept");
  });

  it("clears specific complaints when 'Great' is chosen", () => {
    const body = toggleBodyAnswer(["Sore", "Injured"], "Great");
    assert.deepEqual(body, ["Great"]);
  });

  it("does not let 'Nothing specific' coexist with a complaint", () => {
    const body = toggleBodyAnswer(["Nothing specific"], "Sore");
    assert.deepEqual(body, ["Sore"]);
  });

  it("still allows genuinely compatible answers together", () => {
    let body = toggleBodyAnswer([], "Sore");
    body = toggleBodyAnswer(body, "Tired");
    assert.deepEqual(body, ["Sore", "Tired"]);
  });

  it("applies the same rule to body parts", () => {
    assert.deepEqual(toggleBodyPart(["None specific"], "Hips"), ["Hips"]);
    assert.deepEqual(toggleBodyPart(["Hips", "Knees"], "None specific"), ["None specific"]);
  });

  it("toggles an answer off when tapped twice", () => {
    assert.deepEqual(toggleBodyAnswer(["Sore"], "Sore"), []);
    assert.deepEqual(toggleBodyAnswer(["Great"], "Great"), []);
  });
});

describe("moodFromEnergy — reuse the answer we already have", () => {
  it("maps every energy option to a mood", () => {
    for (const energy of ["Energized", "Balanced", "Low", "Exhausted", "Restless"]) {
      assert.ok(moodFromEnergy(energy), `${energy} produced no mood`);
    }
  });

  it("returns null for an unknown value rather than guessing", () => {
    assert.equal(moodFromEnergy(""), null);
  });
});
