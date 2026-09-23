import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startOfWeek, weeklyProgress } from "./practiceStats.ts";

/**
 * Home showed 8 days practised and 17 sessions under a heading reading "This
 * week". Both numbers were lifetime totals; a week has seven days.
 */
const s = (date: string, durationMinutes = 10) => ({
  date,
  durationMinutes,
  kind: "asana" as const,
});

describe("the week boundary", () => {
  it("starts on Monday by default", () => {
    // 2026-09-23 is a Wednesday.
    assert.equal(startOfWeek("2026-09-23"), "2026-09-21");
    assert.equal(startOfWeek("2026-09-21"), "2026-09-21", "Monday is its own week start");
    assert.equal(startOfWeek("2026-09-27"), "2026-09-21", "Sunday still belongs to that week");
  });

  it("can start on Sunday instead", () => {
    assert.equal(startOfWeek("2026-09-23", 0), "2026-09-20");
    assert.equal(startOfWeek("2026-09-20", 0), "2026-09-20");
  });

  it("crosses a month and a year end", () => {
    assert.equal(startOfWeek("2026-10-01"), "2026-09-28");
    assert.equal(startOfWeek("2027-01-01"), "2026-12-28");
  });
});

describe("weekly practice", () => {
  it("counts only sessions inside the current week", () => {
    const week = weeklyProgress(
      [
        s("2026-09-20", 30), // Sunday, the week before
        s("2026-09-21", 10), // Monday, week start
        s("2026-09-23", 15),
        s("2026-09-28", 20), // next Monday
      ],
      "2026-09-23",
    );
    assert.equal(week.weekStart, "2026-09-21");
    assert.equal(week.weekEnd, "2026-09-27");
    assert.equal(week.sessions, 2);
    assert.equal(week.minutes, 25);
    assert.equal(week.daysPracticed, 2);
  });

  it("counts a day once however many times you practised on it", () => {
    const week = weeklyProgress(
      [s("2026-09-22", 10), s("2026-09-22", 5), s("2026-09-22", 12)],
      "2026-09-23",
    );
    assert.equal(week.sessions, 3);
    assert.equal(week.daysPracticed, 1, "three sessions on one Tuesday is one day");
    assert.equal(week.minutes, 27);
  });

  it("includes both midnight edges of the week", () => {
    const week = weeklyProgress(
      [s("2026-09-21T00:00:00", 5), s("2026-09-27T23:59:59", 5)],
      "2026-09-24",
    );
    assert.equal(week.sessions, 2);
    assert.equal(week.daysPracticed, 2);
  });

  it("uses the date on the session, not a UTC reinterpretation of it", () => {
    // A 23:30 Sunday practice belongs to the week that is ending, even though
    // the same instant is already Monday in UTC.
    const week = weeklyProgress([s("2026-09-27T23:30:00", 20)], "2026-09-27");
    assert.equal(week.weekStart, "2026-09-21");
    assert.equal(week.sessions, 1, "the late Sunday session stayed in its own week");
    const nextWeek = weeklyProgress([s("2026-09-27T23:30:00", 20)], "2026-09-28");
    assert.equal(nextWeek.sessions, 0, "and did not reappear in the next one");
  });

  it("is empty, not absent, in a week with no practice", () => {
    const week = weeklyProgress([s("2026-09-01")], "2026-09-23");
    assert.equal(week.sessions, 0);
    assert.equal(week.daysPracticed, 0);
    assert.equal(week.minutes, 0);
    assert.equal(week.weekStart, "2026-09-21");
  });

  it("does not count a zero-minute row as a day practised", () => {
    const week = weeklyProgress([s("2026-09-22", 0)], "2026-09-23");
    assert.equal(week.daysPracticed, 0);
    assert.equal(week.sessions, 1);
  });

  it("never reports more than seven days", () => {
    const every = Array.from({ length: 14 }, (_, i) =>
      s(`2026-09-${String(15 + i).padStart(2, "0")}`, 10),
    );
    const week = weeklyProgress(every, "2026-09-23");
    assert.ok(week.daysPracticed <= 7, `reported ${week.daysPracticed} days in a week`);
    assert.equal(week.daysPracticed, 7);
    assert.equal(week.sessions, 7);
  });
});
