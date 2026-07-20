import { describe, it } from "node:test";
import assert from "node:assert/strict";

const MS_PER_DAY = 86400000;

function completedWeeksFromSessions(
  sessions: { date: string; pathwaySlug: string | null }[],
  pathwaySlug: string,
  startDate: string,
  totalWeeks: number,
): Set<number> {
  const done = new Set<number>();
  const start = new Date(startDate.slice(0, 10) + "T00:00:00").getTime();
  for (const s of sessions) {
    if (s.pathwaySlug !== pathwaySlug) continue;
    const t = new Date(s.date.length <= 10 ? s.date + "T00:00:00" : s.date).getTime();
    const dayN = Math.floor((t - start) / MS_PER_DAY) + 1;
    if (dayN < 1) continue;
    const weekN = Math.min(totalWeeks, Math.ceil(dayN / 7));
    done.add(weekN);
  }
  return done;
}

describe("pathway week progress from sessions", () => {
  it("does not advance weeks without logged practice", () => {
    const done = completedWeeksFromSessions([], "hip-opening", "2026-07-01", 4);
    assert.equal(done.size, 0);
  });

  it("attributes sessions to the correct week", () => {
    const done = completedWeeksFromSessions(
      [
        { date: "2026-07-01", pathwaySlug: "hip-opening" },
        { date: "2026-07-10", pathwaySlug: "hip-opening" },
        { date: "2026-07-10", pathwaySlug: "other" },
      ],
      "hip-opening",
      "2026-07-01",
      4,
    );
    assert.deepEqual([...done].sort(), [1, 2]);
  });
});
