import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { MemoryStorage } from "./storage";
import { registerClassRoutes } from "./classLibrary";
import { MUX_PUBLIC_TEST_PLAYBACK_ID, PLACEHOLDER_CLASSES, seedPlaceholderClasses } from "./classSeed";

type Summary = { slug: string; tier: string; locked: boolean; playback: { playbackId: string } | null; thumbnailUrl: string | null; progress: { secondsWatched: number; completed: boolean } | null };

async function harness() {
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store);
  const free = await store.createUser("free@example.com", "hash");
  const plus = await store.createUser("plus@example.com", "hash");
  await store.setUserPlan(plus.id, "plus");
  const app = express();
  app.use(express.json());
  // Stand-in for ownerMiddleware: x-as picks the viewer, x-owner a guest device.
  app.use((req, _res, next) => {
    const as = req.get("x-as");
    req.userId = as === "plus" ? plus.id : as === "free" ? free.id : undefined;
    req.ownerId = req.userId ? `user:${req.userId}` : req.get("x-owner") || "device-guest";
    next();
  });
  registerClassRoutes(app, { store });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const get = async (path: string, as?: string, owner?: string) => {
    const res = await fetch(`${base}${path}`, { headers: { ...(as ? { "x-as": as } : {}), ...(owner ? { "x-owner": owner } : {}) } });
    return { status: res.status, text: await res.clone().text(), body: await res.json(), cache: res.headers.get("cache-control") };
  };
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { store, get, post, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

const plusSlugs = PLACEHOLDER_CLASSES.filter((row) => row.tier === "plus").map((row) => row.slug);
const freeSlugs = PLACEHOLDER_CLASSES.filter((row) => row.tier === "free").map((row) => row.slug);

test("seed: six placeholders, three free and three Plus, idempotent", async () => {
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store);
  await seedPlaceholderClasses(store);
  const rows = await store.listClasses();
  assert.equal(rows.length, 6);
  assert.equal(rows.filter((row) => row.tier === "free").length, 3);
  assert.ok(rows.every((row) => row.published && row.muxPlaybackId === MUX_PUBLIC_TEST_PLAYBACK_ID));
  assert.ok(rows.every((row) => !row.thumbnailUrl?.includes(row.muxPlaybackId!)), "thumbnails never embed a playback id");
});

test("Plus playback info never reaches a guest or a free account — list, detail or next", async () => {
  const h = await harness();
  try {
    for (const viewer of [undefined, "free"]) {
      const list = await h.get("/api/classes", viewer);
      assert.equal(list.status, 200);
      assert.equal(list.cache, "private, no-store");
      for (const row of list.body.items as Summary[]) {
        if (row.tier === "plus") {
          assert.equal(row.locked, true);
          assert.equal(row.playback, null);
        } else {
          assert.equal(row.locked, false);
          assert.equal(row.playback?.playbackId, MUX_PUBLIC_TEST_PLAYBACK_ID);
        }
      }
      for (const slug of plusSlugs) {
        const detail = await h.get(`/api/classes/${slug}`, viewer);
        assert.equal(detail.status, 200);
        assert.equal(detail.body.class.locked, true);
        assert.equal(detail.body.class.playback, null);
        // The strongest check: the id appears nowhere in the payload.
        assert.equal(detail.text.includes(MUX_PUBLIC_TEST_PLAYBACK_ID), false, `${slug} leaked playback to ${viewer ?? "guest"}`);
      }
      const plusOnly = await h.get("/api/classes?tier=plus", viewer);
      assert.equal(plusOnly.text.includes(MUX_PUBLIC_TEST_PLAYBACK_ID), false);
    }
    const asPlus = await h.get(`/api/classes/${plusSlugs[0]}`, "plus");
    assert.equal(asPlus.body.class.locked, false);
    assert.equal(asPlus.body.class.playback.playbackId, MUX_PUBLIC_TEST_PLAYBACK_ID);
  } finally { await h.close(); }
});

test("a locked class whose thumbnail embeds the playback id gets no thumbnail", async () => {
  const h = await harness();
  try {
    await h.store.upsertClassBySlug({ ...PLACEHOLDER_CLASSES[3], thumbnailUrl: `https://image.mux.com/${MUX_PUBLIC_TEST_PLAYBACK_ID}/thumbnail.webp`, createdAt: new Date().toISOString() });
    const detail = await h.get(`/api/classes/${PLACEHOLDER_CLASSES[3].slug}`, "free");
    assert.equal(detail.body.class.thumbnailUrl, null);
    assert.equal(detail.text.includes(MUX_PUBLIC_TEST_PLAYBACK_ID), false);
    const asPlus = await h.get(`/api/classes/${PLACEHOLDER_CLASSES[3].slug}`, "plus");
    assert.match(asPlus.body.class.thumbnailUrl, /image\.mux\.com/);
  } finally { await h.close(); }
});

test("filters and pagination", async () => {
  const h = await harness();
  try {
    assert.deepEqual((await h.get("/api/classes?level=beginner")).body.items.map((r: Summary) => r.slug), freeSlugs);
    assert.equal((await h.get("/api/classes?tier=plus")).body.total, 3);
    assert.deepEqual((await h.get("/api/classes?minMinutes=15&maxMinutes=30")).body.items.map((r: Summary) => r.slug),
      ["desk-back-relief", "unwind-before-sleep", "steady-strength-flow", "deep-hamstring-release"]);
    assert.deepEqual((await h.get("/api/classes?focus=back%20pain")).body.items.map((r: Summary) => r.slug),
      ["desk-back-relief", "deep-hamstring-release"]);
    const page2 = (await h.get("/api/classes?pageSize=4&page=2")).body;
    assert.deepEqual([page2.total, page2.pageCount, page2.items.length, page2.hasMore], [6, 2, 2, false]);
    assert.equal((await h.get("/api/classes?level=expert")).status, 400);
    assert.equal((await h.get("/api/classes?minMinutes=30&maxMinutes=10")).status, 400);
    assert.equal((await h.get("/api/classes/no-such-class")).status, 404);
    assert.equal((await h.get("/api/classes/Bad%20Slug")).status, 404);
  } finally { await h.close(); }
});

test("unpublished classes are invisible", async () => {
  const h = await harness();
  try {
    await h.store.upsertClassBySlug({ ...PLACEHOLDER_CLASSES[0], slug: "draft-class", published: false, createdAt: new Date().toISOString() });
    assert.equal((await h.get("/api/classes")).body.total, 6);
    assert.equal((await h.get("/api/classes/draft-class")).status, 404);
    assert.equal((await h.post("/api/classes/draft-class/progress", { secondsWatched: 10 })).status, 404);
  } finally { await h.close(); }
});

test("progress: idempotent, owner-scoped, completes at 90%, sticky, and drives Continue watching", async () => {
  const h = await harness();
  const slug = freeSlugs[0];
  try {
    const save = async (body: unknown, owner = "device-a") => h.post(`/api/classes/${slug}/progress`, body, { "x-owner": owner });
    const first = await (await save({ secondsWatched: 120, durationSeconds: 600 })).json();
    const again = await (await save({ secondsWatched: 120, durationSeconds: 600 })).json();
    assert.deepEqual([first.progress.secondsWatched, first.progress.completed], [120, false]);
    assert.deepEqual([again.progress.secondsWatched, again.progress.completed], [120, false]);
    assert.equal((await h.store.getClassProgress("device-a")).length, 1, "one row per owner and class");

    const mine = (await h.get("/api/class-progress", undefined, "device-a")).body.items as Summary[];
    assert.deepEqual(mine.map((row) => [row.slug, row.progress?.secondsWatched]), [[slug, 120]]);
    assert.equal((await h.get("/api/class-progress")).body.items.length, 0, "another owner's progress is not visible");

    const done = await (await save({ secondsWatched: 540, durationSeconds: 600 })).json();
    assert.equal(done.progress.completed, true, "90% counts as finished");
    assert.equal((await h.get("/api/class-progress", undefined, "device-a")).body.items.length, 0, "finished classes leave Continue watching");
    const rewound = await (await save({ secondsWatched: 30, durationSeconds: 600 })).json();
    assert.deepEqual([rewound.progress.secondsWatched, rewound.progress.completed], [30, true], "rewinding keeps completion");

    const clamped = await (await save({ secondsWatched: 80_000 }, "device-b")).json();
    assert.equal(clamped.progress.secondsWatched, PLACEHOLDER_CLASSES[0].durationMinutes * 60);

    assert.equal((await save({ secondsWatched: -1 })).status, 400);
    assert.equal((await save({})).status, 400);
  } finally { await h.close(); }
});

test("progress on a locked class is refused for free viewers and accepted for Plus", async () => {
  const h = await harness();
  try {
    const locked = await h.post(`/api/classes/${plusSlugs[0]}/progress`, { secondsWatched: 60 }, { "x-as": "free" });
    assert.equal(locked.status, 403);
    assert.equal((await locked.json()).upgradeUrl, "/plus");
    assert.equal((await h.post(`/api/classes/${plusSlugs[0]}/progress`, { secondsWatched: 60 })).status, 403, "guests too");
    assert.equal((await h.post(`/api/classes/${plusSlugs[0]}/progress`, { secondsWatched: 60 }, { "x-as": "plus" })).status, 200);
  } finally { await h.close(); }
});

test("progress saves are throttled per owner and class", async () => {
  const h = await harness();
  try {
    const statuses: number[] = [];
    for (let i = 0; i < 14; i++) {
      statuses.push((await h.post(`/api/classes/${freeSlugs[1]}/progress`, { secondsWatched: i }, { "x-owner": "device-throttle" })).status);
    }
    assert.deepEqual(statuses.slice(0, 12), Array(12).fill(200));
    assert.equal(statuses[12], 429);
    // A different class still has its own budget.
    assert.equal((await h.post(`/api/classes/${freeSlugs[2]}/progress`, { secondsWatched: 1 }, { "x-owner": "device-throttle" })).status, 200);
  } finally { await h.close(); }
});

test("guest progress follows the device into an account and merges collisions", async () => {
  const store = new MemoryStorage();
  await seedPlaceholderClasses(store);
  const [a, b] = await store.listClasses();
  await store.saveClassProgress("user:9", a.id, { secondsWatched: 50, completed: true });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await store.saveClassProgress("device-x", a.id, { secondsWatched: 200, completed: false });
  await store.saveClassProgress("device-x", b.id, { secondsWatched: 80, completed: false });
  await store.transferOwnerData("device-x", "user:9");
  const rows = await store.getClassProgress("user:9");
  assert.equal(rows.length, 2);
  const merged = rows.find((row) => row.classId === a.id)!;
  assert.deepEqual([merged.secondsWatched, merged.completed], [200, true], "newest position, finished if either was");
  assert.equal((await store.getClassProgress("device-x")).length, 0);
  await store.clearOwnerData("user:9");
  assert.equal((await store.getClassProgress("user:9")).length, 0, "account wipe clears class progress");
});
