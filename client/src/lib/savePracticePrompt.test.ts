import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BANNER_AFTER_SESSIONS,
  BLOCKING_AFTER_SESSIONS,
  savePromptLevel,
  shouldShowSaveBanner,
  stakeSummary,
} from "./savePracticePrompt";

const guest = { isSignedIn: false, now: {} };

describe("savePromptLevel", () => {
  it("never interrupts someone who hasn't practised yet", () => {
    // A wall in front of the first session is how a wellness app dies.
    assert.equal(savePromptLevel({ ...guest, totalSessions: 0, atSessionBoundary: true }), "none");
  });

  it("shows the soft banner once there is something to lose", () => {
    assert.equal(
      savePromptLevel({ ...guest, totalSessions: BANNER_AFTER_SESSIONS }),
      "banner",
    );
  });

  it("respects a dismissal for the rest of the day", () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(
      savePromptLevel({ ...guest, totalSessions: 2, now: { bannerDay: today } }),
      "none",
    );
  });

  it("blocks only at a session boundary, never mid-practice", () => {
    const at = { ...guest, totalSessions: BLOCKING_AFTER_SESSIONS };
    assert.equal(savePromptLevel({ ...at, atSessionBoundary: true }), "blocking");
    assert.equal(savePromptLevel({ ...at, atSessionBoundary: false }), "banner");
  });

  it("does not re-block until the stakes have actually risen", () => {
    const declined = { blockedAt: 3 };
    assert.equal(
      savePromptLevel({ ...guest, totalSessions: 3, atSessionBoundary: true, now: declined }),
      "banner",
      "re-blocking on the very next session is a dark pattern",
    );
    assert.equal(
      savePromptLevel({ ...guest, totalSessions: 4, atSessionBoundary: true, now: declined }),
      "blocking",
    );
  });

  it("never prompts a signed-in practitioner", () => {
    assert.equal(
      savePromptLevel({ isSignedIn: true, totalSessions: 99, atSessionBoundary: true, now: {} }),
      "none",
    );
  });
});

describe("shouldShowSaveBanner", () => {
  it("stays hidden until there has been repeated value (2 sessions on 2 days)", () => {
    // Before value: banner level, but not enough sessions/days.
    assert.equal(
      shouldShowSaveBanner({ level: "banner", totalSessions: 1, daysPracticed: 1 }),
      false,
    );
    // Two sessions but all on a single day — not yet.
    assert.equal(
      shouldShowSaveBanner({ level: "banner", totalSessions: 2, daysPracticed: 1 }),
      false,
    );
    // Active two days but only one session — not yet.
    assert.equal(
      shouldShowSaveBanner({ level: "banner", totalSessions: 1, daysPracticed: 2 }),
      false,
    );
  });

  it("shows once both thresholds are met", () => {
    assert.equal(
      shouldShowSaveBanner({ level: "banner", totalSessions: 2, daysPracticed: 2 }),
      true,
    );
    assert.equal(
      shouldShowSaveBanner({ level: "banner", totalSessions: 5, daysPracticed: 3 }),
      true,
    );
  });

  it("never shows when the base level isn't a banner", () => {
    assert.equal(
      shouldShowSaveBanner({ level: "none", totalSessions: 9, daysPracticed: 9 }),
      false,
    );
    assert.equal(
      shouldShowSaveBanner({ level: "blocking", totalSessions: 9, daysPracticed: 9 }),
      false,
    );
  });
});

describe("stakeSummary", () => {
  it("states the stake in numbers, not adjectives", () => {
    assert.equal(stakeSummary(1, 1), "1 session");
    assert.equal(stakeSummary(7, 4), "7 sessions and a 4-day streak");
  });
});
