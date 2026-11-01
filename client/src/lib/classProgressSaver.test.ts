import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClassProgressSaver } from "./classProgressSaver";

function setup(alreadyCompleted = false) {
  let clock = 1_000_000;
  const sent: { body: Record<string, unknown>; keepalive: boolean }[] = [];
  const saver = new ClassProgressSaver((body, { keepalive }) => { sent.push({ body, keepalive }); }, () => clock, alreadyCompleted);
  return { saver, sent, advance: (ms: number) => { clock += ms; } };
}

describe("ClassProgressSaver", () => {
  it("saves every 15s of playback, not on every timeupdate", () => {
    const { saver, sent, advance } = setup();
    for (let t = 1; t <= 14; t++) { advance(1000); saver.tick(t, 600); }
    assert.equal(sent.length, 0);
    advance(1000); saver.tick(15, 600);
    assert.deepEqual(sent.map((s) => s.body), [{ secondsWatched: 15, durationSeconds: 600 }]);
    for (let t = 16; t <= 29; t++) { advance(1000); saver.tick(t, 600); }
    assert.equal(sent.length, 1);
    advance(1000); saver.tick(30, 600);
    assert.equal(sent.length, 2);
  });

  it("saves on pause, and an exit right after a pause is not sent twice", () => {
    const { saver, sent, advance } = setup();
    advance(4000); saver.tick(4.6, 600);
    saver.pause(4.6, 600);
    assert.deepEqual(sent.at(-1), { body: { secondsWatched: 4, durationSeconds: 600 }, keepalive: false });
    saver.flush();
    assert.equal(sent.length, 1);
  });

  it("an exit without a pause flushes with keepalive", () => {
    const { saver, sent, advance } = setup();
    advance(7000); saver.tick(7, 600);
    saver.flush();
    assert.deepEqual(sent, [{ body: { secondsWatched: 7, durationSeconds: 600 }, keepalive: true }]);
  });

  it("marks complete the moment playback crosses 90%, once", () => {
    const { saver, sent, advance } = setup();
    advance(1000); saver.tick(539, 600);
    assert.equal(sent.length, 0);
    advance(1000); saver.tick(540, 600);
    assert.deepEqual(sent.at(-1)?.body, { secondsWatched: 540, durationSeconds: 600, completed: true });
    advance(1000); saver.tick(541, 600);
    assert.equal(sent.length, 1, "no second completion save");
    assert.equal(saver.isCompleted, true);
  });

  it("ending the video completes it at full length", () => {
    const { saver, sent } = setup();
    saver.end(600);
    assert.deepEqual(sent.at(-1)?.body, { secondsWatched: 600, durationSeconds: 600, completed: true });
  });

  it("sends nothing when nothing was watched", () => {
    const { saver, sent } = setup();
    saver.pause(0, 600);
    saver.flush();
    assert.equal(sent.length, 0);
  });

  it("a rewatch of a finished class keeps reporting completed", () => {
    const { saver, sent, advance } = setup(true);
    advance(16_000); saver.tick(16, 600);
    assert.equal(sent.at(-1)?.body.completed, true);
  });

  it("a failing save never throws into the player", async () => {
    let clock = 0;
    const saver = new ClassProgressSaver(() => Promise.reject(new Error("offline")), () => clock);
    clock += 20_000;
    assert.doesNotThrow(() => saver.tick(20, 600));
    await new Promise((resolve) => setImmediate(resolve));
  });
});
