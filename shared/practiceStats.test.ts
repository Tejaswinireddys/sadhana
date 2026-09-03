import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  JOURNAL_PROGRESS_FIXTURE,
  assertDaysPracticedInvariant,
  computeStats,
  homeProgressTiles,
} from "./practiceStats";

describe("daysPracticed invariant", () => {
  it("holds for every computeStats result: daysPracticed >= longestStretch", () => {
    const cases: { sessions: { date: string; durationMinutes: number }[]; today: string }[] = [
      { sessions: [], today: "2026-08-28" },
      { sessions: [{ date: "2026-08-28", durationMinutes: 5 }], today: "2026-08-28" },
      {
        sessions: [
          { date: "2026-08-26", durationMinutes: 5 },
          { date: "2026-08-27", durationMinutes: 5 },
          { date: "2026-08-28", durationMinutes: 5 },
        ],
        today: "2026-08-28",
      },
      { sessions: JOURNAL_PROGRESS_FIXTURE, today: "2026-08-28" },
      {
        sessions: [
          { date: "2026-01-01", durationMinutes: 10 },
          { date: "2026-06-01", durationMinutes: 10 },
        ],
        today: "2026-09-03",
      },
    ];
    for (const { sessions, today } of cases) {
      const stats = computeStats(sessions, today);
      assert.ok(
        stats.daysPracticed >= stats.longestStreak,
        `daysPracticed ${stats.daysPracticed} < longestStreak ${stats.longestStreak}`,
      );
      assertDaysPracticedInvariant(stats.daysPracticed, stats.longestStreak);
    }
  });

  it("throws when a caller tries to display a contradictory pair", () => {
    assert.throws(
      () => assertDaysPracticedInvariant(1, 2),
      /daysPracticed \(1\) must be >= longestStretch \(2\)/,
    );
  });
});

describe("Home progress tiles vs journal fixture", () => {
  it("reconciles all four tiles against seeded sessions on Jul 28, Jul 29, Aug 28", () => {
    // Viewing on Aug 28: current streak is 1 (today only), longest stretch is 2
    // (Jul 28–29). The first tile must still read 3 distinct practice days.
    const stats = computeStats(JOURNAL_PROGRESS_FIXTURE, "2026-08-28");
    assert.equal(stats.currentStreak, 1, "streak is 1 — the old tile value");
    assert.equal(stats.daysPracticed, 3);
    assert.equal(stats.longestStreak, 2);
    assert.equal(stats.totalSessions, 4);
    assert.equal(stats.totalMinutes, 5);
    assert.ok(stats.daysPracticed >= stats.longestStreak);

    const tiles = homeProgressTiles(stats, { compassionateRecovery: true });
    assert.equal(tiles.daysPracticed.label, "Days practiced (no shame)");
    assert.equal(tiles.daysPracticed.value, 3);
    assert.equal(tiles.daysPracticed.testId, "stat-days-practiced");
    assert.equal(tiles.longestStretch.value, 2);
    assert.equal(tiles.totalSessions.value, 4);
    assert.equal(tiles.minutesPracticed.value, 5);
    assert.ok(tiles.daysPracticed.value >= tiles.longestStretch.value);
  });

  it("still shows distinct days when compassionate recovery is off", () => {
    const stats = computeStats(JOURNAL_PROGRESS_FIXTURE, "2026-08-28");
    const tiles = homeProgressTiles(stats, { compassionateRecovery: false });
    assert.equal(tiles.daysPracticed.label, "Days practiced");
    assert.equal(tiles.daysPracticed.value, 3);
    assert.notEqual(tiles.daysPracticed.value, stats.currentStreak);
  });

  it("refuses to build tiles that would show days practiced below longest stretch", () => {
    assert.throws(
      () =>
        homeProgressTiles(
          { daysPracticed: 1, longestStreak: 2, totalSessions: 4, totalMinutes: 5 },
          { compassionateRecovery: true },
        ),
      /daysPracticed \(1\) must be >= longestStretch \(2\)/,
    );
  });
});
