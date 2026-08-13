import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { upsertPosePlayback, getPosePlayback } from "./poseStreamStore";
import { buildPoseMediaManifest } from "./poseMediaManifest";

describe("pose stream store + manifest", () => {
  const prevHost = process.env.BUNNY_STREAM_CDN_HOSTNAME;
  const prevProvider = process.env.STREAM_PROVIDER;

  before(() => {
    process.env.STREAM_PROVIDER = "bunny";
    process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-test.b-cdn.net";
  });

  after(() => {
    if (prevHost === undefined) delete process.env.BUNNY_STREAM_CDN_HOSTNAME;
    else process.env.BUNNY_STREAM_CDN_HOSTNAME = prevHost;
    if (prevProvider === undefined) delete process.env.STREAM_PROVIDER;
    else process.env.STREAM_PROVIDER = prevProvider;
  });

  it("surfaces playback id through the media manifest as HLS", async () => {
    const slug = "stream-test-pose-xyz";
    await upsertPosePlayback(slug, "guid-aaa", "bunny");
    const row = await getPosePlayback(slug);
    assert.ok(row);
    assert.equal(row!.playbackId, "guid-aaa");

    const m = await buildPoseMediaManifest(slug);
    assert.ok(m.video);
    assert.equal(m.video!.provider, "bunny");
    assert.equal(m.video!.playbackId, "guid-aaa");
    assert.equal(m.video!.hls, "https://vz-test.b-cdn.net/guid-aaa/playlist.m3u8");
    assert.match(m.video!.poster, /\/poses\/stream-test-pose-xyz\.png$/);
  });
});
