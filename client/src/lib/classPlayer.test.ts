import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classCompletionLog, classKeyAction, parseClassSpeed, watchedAfter } from "./classPlayer";

describe("class speed", () => {
  it("accepts only 0.75, 1 and 1.25, defaulting to 1", () => {
    assert.equal(parseClassSpeed("0.75"), 0.75);
    assert.equal(parseClassSpeed("1.25"), 1.25);
    for (const bad of [null, "", "2", "abc", "1.5"]) assert.equal(parseClassSpeed(bad), 1);
  });
});

describe("watchedAfter", () => {
  it("adds normal playback steps and ignores seeks and scrubs", () => {
    let state: { watched: number; last: number | null } = { watched: 0, last: null };
    for (const t of [0, 0.25, 0.5, 1, 2]) state = watchedAfter(state, t);
    assert.equal(state.watched, 2);
    state = watchedAfter(state, 500); // jumped ahead
    assert.equal(state.watched, 2);
    state = watchedAfter(state, 501.25);
    assert.equal(state.watched, 3.25);
    state = watchedAfter(state, 100); // jumped back
    assert.equal(state.watched, 3.25);
  });
});

describe("classCompletionLog", () => {
  const base = {
    title: "Slow flow", instructorName: "Asha", durationMinutes: 20,
    chapters: [{ startSec: 0, title: "Arrive" }, { startSec: 60, title: "Mountain", poseSlug: "tadasana" }, { startSec: 90, title: "Again", poseSlug: "tadasana" }],
    poseName: (slug: string) => (slug === "tadasana" ? "Mountain Pose" : undefined),
  };

  it("logs time practised (not class length) into the same session + journal write as guided practice", () => {
    const log = classCompletionLog({ ...base, watchedSeconds: 1130 });
    assert.ok(log);
    assert.equal(log.minutes, 19);
    assert.equal(log.plannedMinutes, 20);
    assert.equal(log.label, "Slow flow");
    assert.equal(log.kind, "asana", "counts toward the same stats and streak");
    assert.deepEqual(log.poseNames, ["Mountain Pose"]);
    assert.deepEqual(log.journalTags, ["Slow flow", "class"]);
    assert.equal(log.journalBody, "Slow flow — video class with Asha. 19 min practised: Mountain Pose.");
  });

  it("does not count skipping through", () => {
    assert.equal(classCompletionLog({ ...base, watchedSeconds: 59 }), null);
    assert.equal(classCompletionLog({ ...base, watchedSeconds: Number.NaN }), null);
    assert.equal(classCompletionLog({ ...base, watchedSeconds: 60 })?.minutes, 1);
  });
});

describe("classKeyAction", () => {
  const page = { tagName: "DIV", closest: () => null };
  const key = (k: string, target: object | null = page, mods = {}) => classKeyAction({ key: k, target: target as never, ...mods });

  it("maps space, arrows, f and c", () => {
    assert.equal(key(" "), "toggle");
    assert.equal(key("ArrowLeft"), "back");
    assert.equal(key("ArrowRight"), "forward");
    assert.equal(key("f"), "fullscreen");
    assert.equal(key("C"), "captions");
    assert.equal(key("x"), null);
  });

  it("stays out of the way of typing, controls, modifiers and the player's own hotkeys", () => {
    assert.equal(key(" ", { tagName: "INPUT" }), null);
    assert.equal(key("f", { tagName: "TEXTAREA" }), null);
    assert.equal(key(" ", { tagName: "BUTTON", closest: () => null }), null, "Space activates the focused button");
    assert.equal(key("ArrowRight", { tagName: "BUTTON", closest: () => null }), "forward");
    assert.equal(key(" ", { tagName: "SPAN", closest: (s: string) => (s === "mux-player" ? {} : null) }), null);
    assert.equal(key("f", page, { metaKey: true }), null);
  });
});
