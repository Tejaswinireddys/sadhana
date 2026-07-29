import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildJournalEntry } from "./logPracticeSession";

const base = {
  label: "I'm tense",
  minutes: 1,
  poseNames: ["A", "B", "C", "D", "E", "F", "G", "H"],
  posesCompleted: 8,
  posesSkipped: 0,
  preMood: null,
  postMood: null,
};

describe("buildJournalEntry — one definition of duration", () => {
  it("titles the entry with the minutes actually practiced", () => {
    // The P0: the title carried the planned 5 min while Home's "Minutes
    // practiced" summed the elapsed 1 min — two numbers, one session.
    const e = buildJournalEntry({ ...base, minutes: 1, plannedMinutes: 5 });
    assert.equal(e.title, "I'm tense · 1 min");
    assert.ok(!/5 min ·/.test(e.title));
  });

  it("records the planned duration as context, not as the headline", () => {
    const e = buildJournalEntry({ ...base, minutes: 1, plannedMinutes: 5 });
    assert.match(e.body, /1 min \(planned 5 min\)/);
  });

  it("omits the planned note when it matches what was practiced", () => {
    const e = buildJournalEntry({ ...base, minutes: 5, plannedMinutes: 5 });
    assert.ok(!/planned/.test(e.body));
  });

  it("says how many poses were skipped instead of claiming them all", () => {
    const e = buildJournalEntry({ ...base, posesCompleted: 0, posesSkipped: 8 });
    assert.match(e.body, /0 of 8 poses \(8 skipped\)/);
  });

  it("lists the poses when nothing was skipped", () => {
    const e = buildJournalEntry({ ...base, poseNames: ["Mountain Pose"], posesCompleted: 1 });
    assert.match(e.body, /practiced Mountain Pose\./);
  });
});
