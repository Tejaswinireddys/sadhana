import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Minimal sessionStorage shim for node test runner
const mem = new Map<string, string>();
(globalThis as any).sessionStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, v);
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
};

import {
  savePersistedPractice,
  loadPersistedPractice,
  clearPersistedPractice,
  updatePersistedProgress,
} from "./practicePersist.ts";

describe("practicePersist", () => {
  beforeEach(() => {
    mem.clear();
  });

  it("round-trips a queued session", () => {
    savePersistedPractice({
      poses: [{ slug: "tadasana", holdSeconds: 30, sides: "once" }],
      meta: { label: "Test", pathwaySlug: null },
      progress: null,
    });
    const loaded = loadPersistedPractice();
    assert.ok(loaded);
    assert.equal(loaded!.poses[0].slug, "tadasana");
    assert.equal(loaded!.meta.label, "Test");
  });

  it("updates progress without dropping poses", () => {
    savePersistedPractice({
      poses: [{ slug: "balasana", holdSeconds: 60 }],
      meta: { label: null, pathwaySlug: null },
    });
    updatePersistedProgress({
      mode: "guided",
      index: 0,
      started: true,
      elapsedTotal: 12,
      phase: "hold",
      phaseRemaining: 40,
    });
    const loaded = loadPersistedPractice();
    assert.equal(loaded!.poses.length, 1);
    assert.equal(loaded!.progress?.mode, "guided");
    assert.equal(loaded!.progress?.elapsedTotal, 12);
  });

  it("clears storage", () => {
    savePersistedPractice({
      poses: [{ slug: "tadasana" }],
      meta: { label: null, pathwaySlug: null },
    });
    clearPersistedPractice();
    assert.equal(loadPersistedPractice(), null);
  });
});
