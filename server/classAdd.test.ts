import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildClassRow,
  muxApi,
  parseClassAddArgs,
  resolveClassPlayback,
  type MuxAsset,
  type MuxAssetApi,
} from "./classAdd";

const BASE = ["--asset", "asset123", "--title", "Slow flow", "--slug", "slow-flow", "--level", "beginner", "--focus", "Flexibility, back pain"];

function fakeMux(asset: MuxAsset) {
  const calls: string[] = [];
  const api: MuxAssetApi = {
    getAsset: async () => { calls.push("get"); return structuredClone(asset); },
    createPlaybackId: async (_asset, policy) => { calls.push(`create:${policy}`); return { id: `new${policy}Id`, policy }; },
    deletePlaybackId: async (_asset, id) => { calls.push(`delete:${id}`); },
  };
  return { api, calls };
}

test("parses arguments and rejects bad ones", () => {
  const options = parseClassAddArgs([...BASE, "--tier", "plus", "--duration", "25"]);
  assert.equal(options.tier, "plus");
  assert.equal(options.duration, 25);
  assert.deepEqual(options.focus, ["flexibility", "back pain"]);
  assert.equal(options.draft, false);
  assert.throws(() => parseClassAddArgs([...BASE, "--tier", "gold"]), /tier/);
  assert.throws(() => parseClassAddArgs([...BASE.slice(2), "--tier", "free"]), /asset/);
  assert.throws(() => parseClassAddArgs([...BASE, "--tier", "free", "--slug", "Bad Slug"]), /slug/);
  assert.throws(() => parseClassAddArgs([...BASE, "--tier", "free", "--asset", "../x"]), /asset/);
});

test("a Plus asset reuses its signed id, and is stored signed", async () => {
  const { api, calls } = fakeMux({ id: "asset123", status: "ready", duration: 1490.2, playback_ids: [{ id: "signedAbc", policy: "signed" }] });
  const options = parseClassAddArgs([...BASE, "--tier", "plus"]);
  const playback = await resolveClassPlayback(api, options);
  assert.deepEqual(calls, ["get"]);
  const row = buildClassRow(options, playback, new Date("2026-11-01T00:00:00Z"));
  assert.equal(row.muxPlaybackId, "signedAbc");
  assert.equal(row.playbackPolicy, "signed");
  assert.equal(row.tier, "plus");
  assert.equal(row.durationMinutes, 25, "rounded up from the asset's length");
  assert.equal(row.thumbnailUrl, null, "no unsigned Mux thumbnail for a Plus class");
  assert.equal(row.published, true);
});

test("a Plus asset with only a public id gets a signed one created; public ids are reported, removed only on request", async () => {
  const asset: MuxAsset = { id: "asset123", status: "ready", duration: 600, playback_ids: [{ id: "publicXyz", policy: "public" }] };
  const keep = fakeMux(asset);
  const kept = await resolveClassPlayback(keep.api, parseClassAddArgs([...BASE, "--tier", "plus"]));
  assert.deepEqual(keep.calls, ["get", "create:signed"]);
  assert.equal(kept.playbackId, "newsignedId");
  assert.equal(kept.created, true);
  assert.deepEqual(kept.publicIdsOnPlus, ["publicXyz"]);

  const remove = fakeMux(asset);
  const removed = await resolveClassPlayback(remove.api, parseClassAddArgs([...BASE, "--tier", "plus", "--remove-public"]));
  assert.deepEqual(remove.calls, ["get", "create:signed", "delete:publicXyz"]);
  assert.deepEqual(removed.publicIdsOnPlus, []);
  assert.deepEqual(removed.removedPublicIds, ["publicXyz"]);
});

test("a free asset uses a public id and Mux's thumbnail; free classes are never forced to signed", async () => {
  const { api, calls } = fakeMux({ id: "asset123", status: "ready", duration: 300, playback_ids: [{ id: "publicXyz", policy: "public" }, { id: "signedAbc", policy: "signed" }] });
  const options = parseClassAddArgs([...BASE, "--tier", "free", "--draft"]);
  const row = buildClassRow(options, await resolveClassPlayback(api, options));
  assert.deepEqual(calls, ["get"]);
  assert.equal(row.muxPlaybackId, "publicXyz");
  assert.equal(row.playbackPolicy, "public");
  assert.equal(row.thumbnailUrl, "https://image.mux.com/publicXyz/thumbnail.webp");
  assert.equal(row.published, false);
});

test("refuses assets that are not ready, and dry runs change nothing in Mux", async () => {
  await assert.rejects(resolveClassPlayback(fakeMux({ id: "a", status: "preparing" }).api, parseClassAddArgs([...BASE, "--tier", "plus"])), /not ready/);
  const dry = fakeMux({ id: "asset123", status: "ready", playback_ids: [{ id: "publicXyz", policy: "public" }] });
  await assert.rejects(resolveClassPlayback(dry.api, parseClassAddArgs([...BASE, "--tier", "plus", "--dry-run", "--remove-public"])), /no signed playback id/);
  assert.deepEqual(dry.calls, ["get"]);
  const options = parseClassAddArgs([...BASE, "--tier", "plus"]);
  assert.throws(() => buildClassRow(options, { playbackId: "s", playbackPolicy: "signed", durationSeconds: null, created: false, publicIdsOnPlus: [], removedPublicIds: [] }), /--duration/);
});

test("muxApi sends basic auth to the asset endpoints", async () => {
  const seen: { url: string; method: string; auth: string | null; body?: string }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    seen.push({ url, method: init.method!, auth: new Headers(init.headers).get("authorization"), body: init.body as string | undefined });
    return new Response(JSON.stringify({ data: { id: "p1", policy: "signed" } }), { status: 201 });
  }) as unknown as typeof fetch;
  const api = muxApi("tid", "tsecret", fetcher);
  await api.createPlaybackId("asset123", "signed");
  assert.equal(seen[0].url, "https://api.mux.com/video/v1/assets/asset123/playback-ids");
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].auth, `Basic ${Buffer.from("tid:tsecret").toString("base64")}`);
  assert.equal(seen[0].body, JSON.stringify({ policy: "signed" }));
});
