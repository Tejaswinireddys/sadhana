import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classListQuerySchema,
  continueWatching,
  durationRange,
  filterClasses,
  isClassLocked,
  isCompleteAt,
  nextClassSuggestion,
  nextProgress,
  paginate,
  presentClass,
  resumeFrom,
  sortClasses,
  type ClassRecord,
  type ClassSummary,
} from "./classLibrary";

let id = 0;
function row(overrides: Partial<ClassRecord> = {}): ClassRecord {
  id += 1;
  return {
    id, slug: `class-${id}`, title: `Class ${id}`, description: "", instructorName: "Team",
    level: "beginner", durationMinutes: 20, focusTags: ["flexibility"], muxPlaybackId: `pb${id}`,
    thumbnailUrl: `/poses/p${id}.webp`, tier: "free", published: true, createdAt: `2026-01-0${(id % 9) + 1}T00:00:00Z`,
    ...overrides,
  };
}

describe("filterClasses", () => {
  const rows = [
    row({ slug: "a", level: "beginner", durationMinutes: 10, focusTags: ["morning"], tier: "free" }),
    row({ slug: "b", level: "intermediate", durationMinutes: 25, focusTags: ["Back Pain", "flexibility"], tier: "plus" }),
    row({ slug: "c", level: "advanced", durationMinutes: 45, focusTags: ["stress"], tier: "plus" }),
    row({ slug: "d", level: "beginner", durationMinutes: 15, focusTags: ["stress", "sleep"], tier: "free", published: false }),
  ];
  const slugs = (filters: Parameters<typeof filterClasses>[1]) => filterClasses(rows, filters).map((r) => r.slug);

  it("never lists unpublished classes", () => {
    assert.deepEqual(slugs({}), ["a", "b", "c"]);
  });
  it("filters by level, tier and duration bounds (inclusive)", () => {
    assert.deepEqual(slugs({ level: "beginner" }), ["a"]);
    assert.deepEqual(slugs({ tier: "plus" }), ["b", "c"]);
    assert.deepEqual(slugs({ minMinutes: 10, maxMinutes: 25 }), ["a", "b"]);
    assert.deepEqual(slugs({ minMinutes: 26 }), ["c"]);
  });
  it("matches any requested focus, case-insensitively", () => {
    assert.deepEqual(slugs({ focus: ["back pain"] }), ["b"]);
    assert.deepEqual(slugs({ focus: ["morning", "stress"] }), ["a", "c"]);
  });
  it("combines facets with AND", () => {
    assert.deepEqual(slugs({ tier: "plus", focus: ["stress"], maxMinutes: 30 }), []);
  });
  it("duration chips map to the same bounds", () => {
    assert.deepEqual(durationRange("under-15"), { minMinutes: 0, maxMinutes: 14 });
    assert.deepEqual(durationRange("30-plus"), { minMinutes: 31, maxMinutes: undefined });
    assert.deepEqual(durationRange(undefined), {});
  });
});

describe("classListQuerySchema", () => {
  it("parses query strings, splits focus and applies paging defaults", () => {
    const q = classListQuerySchema.parse({ level: "advanced", focus: "Back pain, stress", minMinutes: "15" });
    assert.deepEqual(q, { level: "advanced", focus: ["back pain", "stress"], minMinutes: 15, page: 1, pageSize: 24 });
  });
  it("rejects unknown levels, inverted ranges and oversized pages", () => {
    assert.equal(classListQuerySchema.safeParse({ level: "expert" }).success, false);
    assert.equal(classListQuerySchema.safeParse({ minMinutes: "30", maxMinutes: "10" }).success, false);
    assert.equal(classListQuerySchema.safeParse({ pageSize: "500" }).success, false);
  });
});

describe("Plus lock", () => {
  const plus = row({ tier: "plus", muxPlaybackId: "secretPlusId", thumbnailUrl: "/poses/x.webp" });
  const free = row({ tier: "free", muxPlaybackId: "freeId" });

  it("locks Plus classes for free viewers only", () => {
    assert.equal(isClassLocked(plus, "free"), true);
    assert.equal(isClassLocked(plus, "plus"), false);
    assert.equal(isClassLocked(free, "free"), false);
  });

  it("a locked class carries no playback id anywhere", () => {
    const view = presentClass(plus, "free");
    assert.equal(view.locked, true);
    assert.equal(view.playback, null);
    assert.equal(JSON.stringify(view).includes("secretPlusId"), false);
    assert.equal(view.thumbnailUrl, "/poses/x.webp", "an unrelated thumbnail is kept");
  });

  it("drops a thumbnail that embeds the playback id while locked", () => {
    const leaky = row({ tier: "plus", muxPlaybackId: "secretPlusId", thumbnailUrl: "https://image.mux.com/secretPlusId/thumbnail.webp" });
    assert.equal(presentClass(leaky, "free").thumbnailUrl, null);
    assert.equal(presentClass(leaky, "plus").thumbnailUrl, leaky.thumbnailUrl);
  });

  it("Plus viewers and free classes get playback", () => {
    assert.deepEqual(presentClass(plus, "plus").playback, { provider: "mux", playbackId: "secretPlusId" });
    assert.deepEqual(presentClass(free, "free").playback, { provider: "mux", playbackId: "freeId" });
    assert.equal(presentClass(row({ muxPlaybackId: null }), "plus").playback, null);
  });
});

describe("progress", () => {
  it("completes at 90% of the media", () => {
    assert.equal(isCompleteAt(539, 600), false);
    assert.equal(isCompleteAt(540, 600), true);
    assert.equal(isCompleteAt(540, undefined), false);
  });

  it("is idempotent, clamps to the media, prefers the real length, and keeps completion", () => {
    const body = { secondsWatched: 120.4, durationSeconds: 600 };
    assert.deepEqual(nextProgress(null, body, 10), nextProgress(null, body, 10));
    assert.deepEqual(nextProgress(null, body, 10), { secondsWatched: 120, completed: false });
    assert.deepEqual(nextProgress(null, { secondsWatched: 5000 }, 10), { secondsWatched: 600, completed: true });
    assert.deepEqual(nextProgress({ completed: true }, { secondsWatched: 3, durationSeconds: 600 }, 10), { secondsWatched: 3, completed: true });
    assert.equal(nextProgress(null, { secondsWatched: 10, completed: true }, 10).completed, true);
  });

  it("resumes from the saved position, but restarts finished or barely-started classes", () => {
    assert.equal(resumeFrom({ secondsWatched: 95, completed: false, updatedAt: "" }), 95);
    assert.equal(resumeFrom({ secondsWatched: 95, completed: true, updatedAt: "" }), 0);
    assert.equal(resumeFrom({ secondsWatched: 3, completed: false, updatedAt: "" }), 0);
    assert.equal(resumeFrom(null), 0);
  });
});

function summary(overrides: Partial<ClassSummary> & { slug: string }): ClassSummary {
  return { ...presentClass(row({ slug: overrides.slug }), "plus"), ...overrides };
}

describe("continueWatching", () => {
  it("lists started, unfinished classes, most recent first", () => {
    const rows = [
      summary({ slug: "old", progress: { secondsWatched: 60, completed: false, updatedAt: "2026-01-01" } }),
      summary({ slug: "new", progress: { secondsWatched: 60, completed: false, updatedAt: "2026-02-01" } }),
      summary({ slug: "done", progress: { secondsWatched: 600, completed: true, updatedAt: "2026-03-01" } }),
      summary({ slug: "blip", progress: { secondsWatched: 2, completed: false, updatedAt: "2026-03-01" } }),
      summary({ slug: "never", progress: null }),
    ];
    assert.deepEqual(continueWatching(rows).map((r) => r.slug), ["new", "old"]);
  });
});

describe("nextClassSuggestion", () => {
  const current = summary({ slug: "now", focusTags: ["stress", "sleep"], level: "beginner" });
  it("prefers shared focus, then level, skipping finished and the current class", () => {
    const all = [
      current,
      summary({ slug: "other", focusTags: ["strength"], level: "beginner" }),
      summary({ slug: "same-focus", focusTags: ["sleep"], level: "advanced" }),
      summary({ slug: "best", focusTags: ["stress", "sleep"], level: "beginner", progress: { secondsWatched: 999, completed: true, updatedAt: "" } }),
    ];
    assert.equal(nextClassSuggestion(current, all)?.slug, "same-focus");
  });
  it("prefers an open class over a locked one, falling back to locked when nothing else is left", () => {
    const locked = summary({ slug: "locked", focusTags: ["stress"], locked: true, playback: null });
    const open = summary({ slug: "open", focusTags: ["strength"] });
    assert.equal(nextClassSuggestion(current, [current, locked, open])?.slug, "open");
    assert.equal(nextClassSuggestion(current, [current, locked])?.slug, "locked");
    assert.equal(nextClassSuggestion(current, [current]), null);
  });
});

describe("library order and paging", () => {
  it("free before Plus, then oldest first", () => {
    const rows = [
      row({ title: "P", tier: "plus", createdAt: "2026-01-01" }),
      row({ title: "F2", tier: "free", createdAt: "2026-01-03" }),
      row({ title: "F1", tier: "free", createdAt: "2026-01-02" }),
    ];
    assert.deepEqual(sortClasses(rows).map((r) => r.title), ["F1", "F2", "P"]);
  });
  it("paginates with totals", () => {
    assert.deepEqual(paginate([1, 2, 3, 4, 5], 2, 2), { items: [3, 4], page: 2, pageSize: 2, total: 5, pageCount: 3, hasMore: true });
    assert.deepEqual(paginate([], 1, 24).pageCount, 1);
  });
});
