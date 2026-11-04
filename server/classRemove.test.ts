import { test } from "node:test";
import assert from "node:assert/strict";
import type { InsertClass } from "@shared/schema";
import { MemoryStorage } from "./storage";
import { MUX_PUBLIC_TEST_PLAYBACK_ID } from "./classSeed";
import {
  formatClassRemovalPlan,
  isConfirmation,
  muxAssetRemoval,
  parseClassRemoveArgs,
  planClassRemoval,
  runClassRemove,
  type ClassRemoveDeps,
} from "./classRemove";

function classRow(slug: string, overrides: Partial<InsertClass> = {}): InsertClass {
  return {
    slug, title: `Title ${slug}`, description: "", instructorName: "Sadhana team", level: "beginner",
    durationMinutes: 20, focusTags: [], muxPlaybackId: `pb_${slug.replace(/-/g, "_")}`, playbackPolicy: "signed",
    chapters: [{ startSec: 0, title: "Arrive" }, { startSec: 60, title: "Flow" }], thumbnailUrl: null, thumbnailTimeSec: null,
    tier: "plus", published: true, createdAt: "2026-10-01T00:00:00Z", ...overrides,
  };
}

/** Two classes; the target has two viewers' progress, the other one viewer's. */
async function fixture(target: Partial<InsertClass> = {}) {
  const store = new MemoryStorage();
  const doomed = await store.upsertClassBySlug(classRow("slow-flow", target));
  const kept = await store.upsertClassBySlug(classRow("kept-class"));
  await store.saveClassProgress("device-a", doomed.id, { secondsWatched: 30, completed: false });
  await store.saveClassProgress("user:7", doomed.id, { secondsWatched: 900, completed: true });
  await store.saveClassProgress("device-a", kept.id, { secondsWatched: 10, completed: false });
  return { store, doomed, kept };
}

function deps(store: MemoryStorage, overrides: Partial<ClassRemoveDeps> = {}) {
  const events: string[] = [];
  const logs: string[] = [];
  const d: ClassRemoveDeps = {
    store,
    lookupAsset: async (playbackId) => { events.push(`lookup:${playbackId}`); return "asset_slow"; },
    deleteAsset: async (assetId) => { events.push(`delete-asset:${assetId}`); },
    confirm: async () => { events.push("confirm"); return true; },
    log: (message) => logs.push(message),
    ...overrides,
  };
  return { d, events, logs };
}

async function remaining(store: MemoryStorage) {
  return {
    slugs: (await store.listClasses()).map((row) => row.slug),
    deviceA: (await store.getClassProgress("device-a")).length,
    user7: (await store.getClassProgress("user:7")).length,
  };
}

test("parses arguments; --slug is required and must be a slug", () => {
  assert.deepEqual(parseClassRemoveArgs(["--slug", "slow-flow"]), { slug: "slow-flow", deleteMuxAsset: false, yes: false, dryRun: false });
  assert.deepEqual(parseClassRemoveArgs(["--slug", "slow-flow", "--delete-mux-asset", "--yes", "--dry-run"]),
    { slug: "slow-flow", deleteMuxAsset: true, yes: true, dryRun: true });
  assert.throws(() => parseClassRemoveArgs(["--yes"]), /--slug is required/);
  assert.throws(() => parseClassRemoveArgs(["--slug", "Bad Slug"]), /slug/);
  assert.throws(() => parseClassRemoveArgs(["--slug", "a", "--force"]), /Unknown option/);
});

test("the plan names the class row, chapters, progress rows, ratings and the Mux asset", async () => {
  const { store, doomed } = await fixture();
  const plan = await planClassRemoval("slow-flow", deps(store).d);
  assert.equal(plan.classId, doomed.id);
  assert.equal(plan.chapters, 2);
  assert.equal(plan.progressRows, 2, "only this class's progress, not kept-class's");
  assert.deepEqual(plan.asset, { kind: "found", assetId: "asset_slow" });
  const text = formatClassRemovalPlan(plan, { deleteMuxAsset: false }).join("\n");
  assert.match(text, /class row, with 2 chapters/);
  assert.match(text, /2 progress rows/);
  assert.match(text, /Ratings: none are stored per class/);
  assert.match(text, /Mux asset: asset_slow/);
  assert.match(text, /Mux asset will be kept/);
  assert.match(formatClassRemovalPlan(plan, { deleteMuxAsset: true }).join("\n"), /Delete: Mux asset asset_slow/);
  await assert.rejects(planClassRemoval("no-such-class", deps(store).d), /No class with slug "no-such-class"/);
});

test("--dry-run prints the plan and changes nothing, without prompting", async () => {
  const { store } = await fixture();
  const before = await remaining(store);
  const { d, events, logs } = deps(store);
  const result = await runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--dry-run", "--delete-mux-asset"]), d);
  assert.equal(result.status, "dry-run");
  assert.deepEqual(await remaining(store), before);
  assert.deepEqual(events, ["lookup:pb_slow_flow"], "no prompt, no Mux delete");
  assert.match(logs.join("\n"), /Dry run: nothing deleted/);
});

test("declining the prompt deletes nothing", async () => {
  const { store } = await fixture();
  const before = await remaining(store);
  const { d, logs } = deps(store, { confirm: async () => false });
  assert.equal((await runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow"]), d)).status, "aborted");
  assert.deepEqual(await remaining(store), before);
  assert.match(logs.join("\n"), /Aborted: nothing deleted/);
});

test("confirming deletes the class and its progress rows only, and keeps the Mux asset by default", async () => {
  const { store } = await fixture();
  const { d, events } = deps(store);
  const result = await runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow"]), d);
  assert.equal(result.status, "removed");
  assert.deepEqual(await remaining(store), { slugs: ["kept-class"], deviceA: 1, user7: 0 });
  assert.ok(result.status === "removed" && result.progressRows === 2 && result.deletedAssetId === null);
  assert.deepEqual(events, ["lookup:pb_slow_flow", "confirm"]);
});

test("--yes skips the prompt; --delete-mux-asset deletes the asset after the rows", async () => {
  const { store } = await fixture();
  const order: string[] = [];
  const deleteClass = store.deleteClassWithProgress.bind(store);
  store.deleteClassWithProgress = async (id) => { order.push("rows"); return deleteClass(id); };
  const { d, events } = deps(store, { deleteAsset: async (id) => { order.push(`asset:${id}`); } });
  const result = await runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--yes", "--delete-mux-asset"]), d);
  assert.ok(result.status === "removed" && result.deletedAssetId === "asset_slow");
  assert.deepEqual(order, ["rows", "asset:asset_slow"]);
  assert.equal(events.includes("confirm"), false);
});

test("--delete-mux-asset refuses up front when the asset cannot be safely deleted", async () => {
  const cases: Array<[string, Partial<InsertClass>, Partial<ClassRemoveDeps>, RegExp]> = [
    ["no Mux credentials", {}, { lookupAsset: null, deleteAsset: null }, /could not be looked up/],
    ["lookup fails", {}, { lookupAsset: async () => { throw new Error("Mux API GET playback-ids returned HTTP 404"); } }, /lookup failed/],
    ["Mux's public test clip", { muxPlaybackId: MUX_PUBLIC_TEST_PLAYBACK_ID, playbackPolicy: "public", tier: "free" }, {}, /public test clip/],
    ["no playback id", { muxPlaybackId: null }, {}, /no playback id/],
  ];
  for (const [name, target, overrides, pattern] of cases) {
    const { store } = await fixture(target);
    const before = await remaining(store);
    const { d } = deps(store, overrides);
    await assert.rejects(runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--yes", "--delete-mux-asset"]), d), pattern, name);
    assert.deepEqual(await remaining(store), before, `${name}: nothing deleted`);
  }
});

test("--delete-mux-asset refuses when another class uses the same playback id", async () => {
  const { store } = await fixture();
  await store.upsertClassBySlug(classRow("twin", { muxPlaybackId: "pb_slow_flow" }));
  const { d } = deps(store);
  await assert.rejects(runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--yes", "--delete-mux-asset"]), d), /used by twin/);
  assert.equal((await store.listClasses()).length, 3);
  // Without the flag the class itself can still go; the shared asset stays.
  const result = await runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--yes"]), d);
  assert.equal(result.status, "removed");
});

test("a failed database delete says it was rolled back, names the cause, and never touches Mux", async () => {
  const { store } = await fixture();
  store.deleteClassWithProgress = async () => {
    throw new Error("Failed query: delete from \"classes\"", { cause: new Error("blocked for rollback test") });
  };
  const { d, events } = deps(store);
  await assert.rejects(runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--yes", "--delete-mux-asset"]), d),
    /failed and was rolled back; nothing was deleted \(blocked for rollback test\)/);
  assert.equal(events.some((e) => e.startsWith("delete-asset")), false);
});

test("a failed Mux delete reports the orphaned asset after the rows are gone", async () => {
  const { store } = await fixture();
  const { d } = deps(store, { deleteAsset: async () => { throw new Error("Mux API DELETE assets returned HTTP 500"); } });
  await assert.rejects(runClassRemove(parseClassRemoveArgs(["--slug", "slow-flow", "--yes", "--delete-mux-asset"]), d),
    /class is deleted, but deleting Mux asset asset_slow failed/);
  assert.deepEqual((await remaining(store)).slugs, ["kept-class"]);
});

test("only an explicit yes confirms", () => {
  for (const answer of ["y", "yes", " YES "]) assert.equal(isConfirmation(answer), true, answer);
  for (const answer of ["", "n", "no", "yess", "sure"]) assert.equal(isConfirmation(answer), false, answer);
});

test("Mux calls: playback id → asset id, then DELETE the asset", async () => {
  const calls: Array<{ method: string; url: string; auth: string | null }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ method: init?.method ?? "GET", url: String(input), auth: new Headers(init?.headers).get("authorization") });
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({ data: { id: "pb1", policy: "signed", object: { type: "asset", id: "asset_1" } } });
  }) as typeof fetch;
  const mux = muxAssetRemoval("tid", "tsecret", fetcher);
  assert.equal(await mux.lookupAsset("pb1"), "asset_1");
  await mux.deleteAsset("asset_1");
  assert.deepEqual(calls.map(({ method, url }) => `${method} ${url}`), [
    "GET https://api.mux.com/video/v1/playback-ids/pb1",
    "DELETE https://api.mux.com/video/v1/assets/asset_1",
  ]);
  assert.equal(calls[0].auth, `Basic ${Buffer.from("tid:tsecret").toString("base64")}`);

  const live = muxAssetRemoval("tid", "tsecret", (async () => Response.json({ data: { object: { type: "live_stream", id: "ls1" } } })) as typeof fetch);
  await assert.rejects(live.lookupAsset("pb1"), /does not belong to an asset/);
  const missing = muxAssetRemoval("tid", "tsecret", (async () => new Response("{}", { status: 404 })) as typeof fetch);
  await assert.rejects(missing.lookupAsset("pb1"), /HTTP 404/);
});

test("storage: deleteClassWithProgress counts and removes exactly one class's rows", async () => {
  const { store, doomed, kept } = await fixture();
  assert.equal(await store.countClassProgressForClass(doomed.id), 2);
  assert.deepEqual(await store.deleteClassWithProgress(doomed.id), { classRows: 1, progressRows: 2 });
  assert.equal(await store.countClassProgressForClass(kept.id), 1);
  assert.deepEqual(await store.deleteClassWithProgress(doomed.id), { classRows: 0, progressRows: 0 });
});
