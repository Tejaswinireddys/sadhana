import { test } from "node:test";
import assert from "node:assert/strict";
import type { ClassRow } from "@shared/schema";
import type { MuxAsset, MuxAssetApi } from "./classAdd";
import { defaultThumbnailTime, parseClassUploadArgs, prepareClassUpload, runClassUpload } from "./classUpload";

const BASE = ["--file", "./video.mp4", "--title", "Slow flow", "--slug", "slow-flow", "--level", "beginner", "--focus", "flexibility"];
const knownPose = (slug: string) => slug === "tadasana";

function fakeFs(files: Record<string, string | number>) {
  return {
    stat: async (path: string) => {
      if (!(path in files)) throw new Error("ENOENT");
      return { isFile: () => true, size: typeof files[path] === "number" ? files[path] as number : 10 };
    },
    readFile: async (path: string) => {
      if (typeof files[path] !== "string") throw new Error("ENOENT");
      return files[path] as string;
    },
  };
}

test("parses upload arguments", () => {
  const options = parseClassUploadArgs([...BASE, "--tier", "plus", "--chapters", "./c.json", "--thumbnail-time", "12", "--dry-run"]);
  assert.equal(options.file, "./video.mp4");
  assert.equal(options.tier, "plus");
  assert.equal(options.chapters, "./c.json");
  assert.equal(options.thumbnailTime, 12);
  assert.equal(options.dryRun, true);
  assert.deepEqual(options.focus, ["flexibility"]);
  assert.throws(() => parseClassUploadArgs([...BASE.slice(2), "--tier", "free"]), /file/);
  assert.throws(() => parseClassUploadArgs([...BASE, "--tier", "gold"]), /tier/);
  assert.throws(() => parseClassUploadArgs([...BASE, "--tier", "free", "--asset", "x"]), /Unknown option/);
});

test("prepare (all a --dry-run does) validates the file, chapters JSON and captions", async () => {
  const chapters = JSON.stringify([{ startSec: 0, title: "Arrive" }, { startSec: 60, title: "Mountain", poseSlug: "tadasana" }]);
  const ok = await prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--chapters", "c.json"]),
    fakeFs({ "./video.mp4": 2048, "c.json": chapters }), knownPose);
  assert.equal(ok.size, 2048);
  assert.equal(ok.chapters.length, 2);
  assert.deepEqual(ok.captions, { kind: "generate" });

  const url = await prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--captions", "https://cdn.example/en.vtt"]),
    fakeFs({ "./video.mp4": 1 }), knownPose);
  assert.deepEqual(url.captions, { kind: "url", url: "https://cdn.example/en.vtt" });

  await assert.rejects(prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--chapters", "c.json"]),
    fakeFs({ "./video.mp4": 1, "c.json": "{not json" }), knownPose), /--chapters: invalid JSON/);
  await assert.rejects(prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--chapters", "c.json"]),
    fakeFs({ "./video.mp4": 1, "c.json": JSON.stringify([{ startSec: 0, title: "A", poseSlug: "unknown-pose" }]) }), knownPose), /unknown poseSlug/);
  await assert.rejects(prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free"]), fakeFs({}), knownPose), /--file not found/);
  await assert.rejects(prepareClassUpload(parseClassUploadArgs([...BASE.map((a) => a === "./video.mp4" ? "./notes.txt" : a), "--tier", "free"]),
    fakeFs({ "./notes.txt": 3 }), knownPose), /must be a video/);
  await assert.rejects(prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--captions", "en.vtt"]),
    fakeFs({ "./video.mp4": 1, "en.vtt": "WEBVTT\n\n00:00.000 --> 00:01.000\nHi" }), knownPose), /public https URL/);
  await assert.rejects(prepareClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--captions", "en.vtt"]),
    fakeFs({ "./video.mp4": 1, "en.vtt": "1\n00:00:00,000 --> 00:00:01,000" }), knownPose), /must be a WebVTT file/);
});

function mux(asset: MuxAsset) {
  const calls: string[] = [];
  const api: MuxAssetApi = {
    getAsset: async () => { calls.push("get"); return structuredClone(asset); },
    createPlaybackId: async (_a, policy) => { calls.push(`create:${policy}`); return { id: `new-${policy}`, policy }; },
    deletePlaybackId: async () => { calls.push("delete"); },
    addCaptionsTrack: async (_a, url) => { calls.push(`captions:${url}`); return { id: "track-cc", type: "text" }; },
    generateSubtitles: async (_a, audio) => { calls.push(`generate:${audio}`); },
  };
  return { api, calls };
}

function deps(api: MuxAssetApi, tier: "free" | "plus") {
  const uploads: { isPlus: boolean; videoQuality: string }[] = [];
  const saved: unknown[] = [];
  const logs: string[] = [];
  return {
    uploads, saved, logs,
    deps: {
      upload: async (o: { isPlus: boolean; videoQuality: "plus" | "basic" }) => {
        uploads.push(o);
        return { uploadId: "up1", assetId: "asset1", playbackId: tier === "plus" ? "sig1" : "pub1", playbackPolicy: tier === "plus" ? "signed" as const : "public" as const, videoQuality: "plus" as const };
      },
      api,
      save: async (row: Record<string, unknown>) => { saved.push(row); return { ...row, id: 1 } as unknown as ClassRow; },
      log: (m: string) => logs.push(m),
      now: () => new Date("2026-11-01T00:00:00Z"),
    },
  };
}

test("a Plus upload is signed, auto-captioned, and saved with chapters and the asset's duration", async () => {
  const { api, calls } = mux({ id: "asset1", status: "ready", duration: 1490, playback_ids: [{ id: "sig1", policy: "signed" }],
    tracks: [{ id: "video1", type: "video" }, { id: "audio1", type: "audio" }] });
  const options = parseClassUploadArgs([...BASE, "--tier", "plus"]);
  const chapters = [{ startSec: 0, title: "Arrive" }, { startSec: 600, title: "Mountain", poseSlug: "tadasana" }];
  const d = deps(api, "plus");
  await runClassUpload(options, { size: 10, chapters, captions: { kind: "generate" } }, d.deps);
  assert.deepEqual(d.uploads, [{ isPlus: true, videoQuality: "plus" }]);
  assert.deepEqual(calls, ["get", "generate:audio1", "get"]);
  const row = d.saved[0] as Record<string, unknown>;
  assert.equal(row.muxPlaybackId, "sig1");
  assert.equal(row.playbackPolicy, "signed");
  assert.equal(row.durationMinutes, 25, "duration comes from the asset");
  assert.deepEqual(row.chapters, chapters);
  assert.equal(row.thumbnailTimeSec, 30);
  assert.equal(row.thumbnailUrl, null, "no unsigned thumbnail for a Plus class");
  assert.ok(d.logs.every((line) => !/secret|token|eyJ/i.test(line)), "logs carry ids only");
});

test("a free upload uses public playback, a captions URL, and a timed poster", async () => {
  const { api, calls } = mux({ id: "asset1", status: "ready", duration: 300, playback_ids: [{ id: "pub1", policy: "public" }], tracks: [] });
  const d = deps(api, "free");
  await runClassUpload(parseClassUploadArgs([...BASE, "--tier", "free", "--thumbnail-time", "12"]),
    { size: 10, chapters: [], captions: { kind: "url", url: "https://cdn.example/en.vtt" } }, d.deps);
  assert.deepEqual(d.uploads, [{ isPlus: false, videoQuality: "plus" }]);
  assert.ok(calls.includes("captions:https://cdn.example/en.vtt"));
  const row = d.saved[0] as Record<string, unknown>;
  assert.equal(row.playbackPolicy, "public");
  assert.equal(row.thumbnailUrl, "https://image.mux.com/pub1/thumbnail.webp?time=12");
  assert.equal(row.thumbnailTimeSec, 12);
});

test("chapters that run past the uploaded video stop before saving, naming the asset", async () => {
  const { api } = mux({ id: "asset1", status: "ready", duration: 100, playback_ids: [{ id: "pub1", policy: "public" }] });
  const d = deps(api, "free");
  await assert.rejects(runClassUpload(parseClassUploadArgs([...BASE, "--tier", "free"]),
    { size: 10, chapters: [{ startSec: 0, title: "A" }, { startSec: 150, title: "B" }], captions: { kind: "generate" } }, d.deps),
    /asset1 is uploaded.*class:add -- --asset asset1/s);
  assert.equal(d.saved.length, 0);
});

test("default poster time is a tenth of the way in, capped", () => {
  assert.equal(defaultThumbnailTime(null), null);
  assert.equal(defaultThumbnailTime(90), 9);
  assert.equal(defaultThumbnailTime(3600), 30);
});
