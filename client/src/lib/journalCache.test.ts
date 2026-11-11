import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyJournalDeleted, applyJournalSaved } from "./journalCache.ts";
import type { Journal as JournalEntry } from "@shared/schema";

function entry(partial: Partial<JournalEntry> & Pick<JournalEntry, "id" | "body">): JournalEntry {
  return {
    ownerId: "device:test",
    date: "2026-11-11",
    title: null,
    mood: null,
    tags: "[]",
    createdAt: "2026-11-11T00:00:00.000Z",
    ...partial,
  };
}

describe("journal cache updates", () => {
  it("prepends a new entry onto an empty list", () => {
    const saved = entry({ id: 1, body: "first", title: "Morning" });
    assert.deepEqual(applyJournalSaved(undefined, saved), [saved]);
    assert.deepEqual(applyJournalSaved([], saved), [saved]);
  });

  it("replaces an edited entry in place", () => {
    const a = entry({ id: 1, body: "old" });
    const b = entry({ id: 2, body: "keep" });
    const edited = entry({ id: 1, body: "new", title: "Edited" });
    assert.deepEqual(applyJournalSaved([a, b], edited), [edited, b]);
  });

  it("removes a deleted entry", () => {
    const a = entry({ id: 1, body: "a" });
    const b = entry({ id: 2, body: "b" });
    assert.deepEqual(applyJournalDeleted([a, b], 1), [b]);
    assert.deepEqual(applyJournalDeleted([a, b], 99), [a, b]);
    assert.deepEqual(applyJournalDeleted(undefined, 1), []);
  });
});
