import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canLeaveCompletion,
  completionLeavePath,
  reflectionAction,
  shouldFireBackgroundSave,
} from "./guidedCompletion.ts";

describe("guided completion leave", () => {
  it("sends Done home and Reflect to edit the auto-saved journal entry when possible", () => {
    assert.equal(completionLeavePath("home"), "/");
    const journal = completionLeavePath("journal", {
      title: "Mountain Pose",
      body: "2 minutes · 1 pose",
    });
    assert.match(journal, /^\/journal\?/);
    assert.match(journal, /new=1/);
    assert.match(journal, /title=Mountain/);
    assert.equal(
      completionLeavePath("journal", {
        title: "Mountain Pose",
        body: "2 minutes · 1 pose",
        editId: 42,
      }),
      "/journal?edit=42",
    );
  });

  it("never blocks leaving on an in-flight or failed save", () => {
    assert.equal(canLeaveCompletion(), true);
    assert.equal(
      shouldFireBackgroundSave({ credited: true, sessionLogged: false, saving: false }),
      true,
    );
    assert.equal(
      shouldFireBackgroundSave({ credited: true, sessionLogged: false, saving: true }),
      false,
    );
    assert.equal(
      shouldFireBackgroundSave({ credited: true, sessionLogged: true, saving: false }),
      false,
    );
    assert.equal(
      shouldFireBackgroundSave({ credited: false, sessionLogged: false, saving: false }),
      false,
    );
  });

  it("clears player state before routing from each completion action", () => {
    const src = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(src, /leaveCompletedSession/);
    assert.match(src, /completionLeavePath\("home"\)/);
    assert.match(src, /completionLeavePath\("journal"/);
    assert.match(src, /setFinished\(false\)/);
    // Navigation must not wait for sessionLogged after a successful save.
    const doneHandler = src.slice(src.indexOf("button-log-continue") - 400);
    assert.match(doneHandler, /leaveCompletedSession/);
    assert.equal(/if \(sessionLogged\.current \|\| !credited\) \{\s*clear\(\);\s*navigate\("\/"\)/.test(src), false);
  });
});

describe("reflectionAction (a rating given around the auto-save)", () => {
  it("queues a rating confirmed while the save is still in flight, instead of dropping it", () => {
    assert.equal(reflectionAction({ sessionLogged: false, saveInFlight: true, counts: true }), "queue");
  });

  it("amends once saved, saves when nothing has been, and skips practice that did not count", () => {
    assert.equal(reflectionAction({ sessionLogged: true, saveInFlight: false, counts: true }), "amend");
    assert.equal(reflectionAction({ sessionLogged: false, saveInFlight: false, counts: true }), "save");
    assert.equal(reflectionAction({ sessionLogged: true, saveInFlight: false, counts: false }), "skip");
  });

  it("the player applies the queued rating when the save lands", () => {
    const page = readFileSync(resolve("client/src/pages/GuidedSession.tsx"), "utf8");
    assert.match(page, /queuedReflection\.current = \{/);
    assert.match(page, /const queued = queuedReflection\.current;/);
  });
});
