import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSessionsCsv } from "./healthExport.ts";
import { inAppReminder, restFriendlyStreak, weeklySummary, type HabitPlan } from "./habitPlan.ts";

const plan: HabitPlan = {
  days: [1, 3, 5],
  hour: 19,
  quietHoursStart: 21,
  quietHoursEnd: 7,
  compassionateRecovery: true,
};

describe("rest-day streaks and the weekly line", () => {
  it("walks through a rest day and stops on a missed practice day", () => {
    const practiced = new Set(["2026-11-16", "2026-11-18"]);
    assert.equal(restFriendlyStreak(practiced, plan.days, "2026-11-18"), 2);
    assert.equal(restFriendlyStreak(new Set(["2026-11-13", "2026-11-16", "2026-11-18"]), plan.days, "2026-11-18"), 3);
  });

  it("names the week and a rest day without calling it a miss", () => {
    const line = weeklySummary({ days: 1, sessions: 1, minutes: 12, restDayToday: true });
    assert.match(line, /1 day, 1 session, 12 minutes/);
    assert.match(line, /rest day/);
    assert.match(line, /Nothing is due/);
  });

  it("nudges on a practice day after the planned hour, and stays quiet on a rest day", () => {
    const monday = new Date("2026-11-16T20:00:00");
    const tuesday = new Date("2026-11-17T20:00:00");
    assert.ok(inAppReminder({ plan, now: monday, practicedToday: false, remindersEnabled: true }));
    assert.equal(inAppReminder({ plan, now: tuesday, practicedToday: false, remindersEnabled: true }), null);
    assert.equal(inAppReminder({ plan, now: monday, practicedToday: true, remindersEnabled: true }), null);
  });
});

describe("session export", () => {
  it("writes every session and does not claim a health-app sync", () => {
    const csv = buildSessionsCsv([
      { date: "2026-11-14", minutes: 12, kind: "asana", label: "Morning" },
      { date: "2026-11-15", minutes: 8, kind: "breathing" },
    ]);
    assert.match(csv, /^date,minutes,kind,label/);
    assert.match(csv, /2026-11-14,12,asana,"Morning"/);
    assert.match(csv, /2026-11-15,8,breathing,""/);
  });
});
