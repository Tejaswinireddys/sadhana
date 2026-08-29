import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { accountAuthTab } from "./hashQuery";
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
    assert.equal(savePromptLevel({ ...guest, totalSessions: 0, atCompletion: true }), "none");
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

  it("never blocks the start of a session", () => {
    const at = { ...guest, totalSessions: BLOCKING_AFTER_SESSIONS };
    assert.equal(savePromptLevel({ ...at, atCompletion: false }), "banner");
    assert.equal(savePromptLevel(at), "banner", "starting a mood session is not a gate");
  });

  it("offers a save prompt after a completed session, not before", () => {
    const at = { ...guest, totalSessions: BLOCKING_AFTER_SESSIONS };
    assert.equal(savePromptLevel({ ...at, atCompletion: true }), "blocking");
  });

  it("does not re-prompt within a week", () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(
      savePromptLevel({
        ...guest,
        totalSessions: 9,
        atCompletion: true,
        now: { blockedOn: today },
      }),
      "banner",
      "once a week — not after every practice",
    );
    assert.equal(
      savePromptLevel({
        ...guest,
        totalSessions: 9,
        atCompletion: true,
        now: { blockedOn: "2026-01-01" },
        clock: new Date(2026, 7, 28),
      }),
      "blocking",
    );
  });

  it("never prompts a signed-in practitioner", () => {
    assert.equal(
      savePromptLevel({ isSignedIn: true, totalSessions: 99, atCompletion: true, now: {} }),
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

describe("accountAuthTab", () => {
  it("maps the public ?tab=create name onto the signup tab", () => {
    assert.equal(accountAuthTab("create"), "signup");
    assert.equal(accountAuthTab("signup"), "signup");
    assert.equal(accountAuthTab("signin"), "signin");
    assert.equal(accountAuthTab("reset"), "reset");
    assert.equal(accountAuthTab(null), "signin");
  });
});

describe("save-practice CTAs point at real email signup", () => {
  it("does not send Create a free account to the on-device wizard", () => {
    const prompt = readFileSync(resolve("client/src/components/SavePracticePrompt.tsx"), "utf8");
    assert.match(prompt, /href="\/account\?tab=create"/);
    assert.equal(prompt.includes("/register?intent=save"), false);
    assert.equal(
      prompt.includes("There's no way for us to give it back"),
      false,
      "loss-framed copy on the save prompt",
    );
    assert.equal(prompt.includes("Keep your practice before you go further"), false);

    const gate = readFileSync(resolve("client/src/components/SignInGate.tsx"), "utf8");
    assert.match(gate, /href="\/account\?tab=create"/);
    assert.equal(gate.includes("/register?"), false);
  });

  it("does not mount a save wall on the guided pre-start screen", () => {
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    const preStart = src.slice(src.indexOf("// ---- pre-start"));
    assert.equal(
      preStart.includes("SavePracticeDialog") || preStart.includes("SavePracticeComplete"),
      false,
      "account wall still sits in front of the session",
    );
    assert.match(src, /SavePracticeCompleteCard/);
  });
});
