import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { completionTiles } from "./completionSummary.ts";

describe("completion tiles", () => {
  it("says 1 POSE, not 1 POSES", () => {
    const tiles = completionTiles({
      minutes: 1,
      posesCompleted: 1,
      posesTotal: 1,
      posesSkipped: 0,
      breaths: 10,
    });
    const poses = tiles.find((t) => t.id === "poses")!;
    assert.equal(poses.value, "1");
    assert.equal(poses.label, "pose");
    assert.equal(tiles.find((t) => t.id === "minutes")!.label, "minute");
  });

  it("hides breaths when there was no hold time to estimate from", () => {
    const tiles = completionTiles({
      minutes: 2,
      posesCompleted: 0,
      posesTotal: 4,
      posesSkipped: 4,
      breaths: 0,
    });
    assert.equal(
      tiles.some((t) => t.id === "breaths"),
      false,
    );
  });

  it("marks the breath count as an estimate when it shows one", () => {
    const tiles = completionTiles({
      minutes: 12,
      posesCompleted: 6,
      posesTotal: 6,
      posesSkipped: 0,
      breaths: 84,
    });
    assert.match(tiles.find((t) => t.id === "breaths")!.label, /est\./);
  });

  it("shows completed out of total when poses were skipped", () => {
    const tiles = completionTiles({
      minutes: 5,
      posesCompleted: 3,
      posesTotal: 7,
      posesSkipped: 4,
      breaths: 30,
    });
    const poses = tiles.find((t) => t.id === "poses")!;
    assert.equal(poses.value, "3/7");
    assert.match(poses.label, /4 skipped/);
  });
});
