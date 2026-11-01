import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveVideoSource } from "./videoSource";

test("video source resolves Mux IDs, HLS query URLs, progressive files and missing media", () => {
  assert.deepEqual(resolveVideoSource({ playbackId: "publicID_123" }), { url: "https://stream.mux.com/publicID_123.m3u8", hls: true });
  assert.deepEqual(resolveVideoSource({ videoUrl: "/video/demo.mp4" }), { url: "/video/demo.mp4", hls: false });
  assert.equal(resolveVideoSource({ videoUrl: "https://stream.mux.com/demo.m3u8?token=example" })?.hls, true);
  assert.equal(resolveVideoSource({}), null);
  assert.equal(resolveVideoSource({ videoUrl: "javascript:alert(1)" }), null);
  assert.equal(resolveVideoSource({ playbackId: "../bad" }), null);
});


test("signed playback cannot fall back to an unsigned playback ID", () => {
  assert.equal(resolveVideoSource({ playbackId: "signedID", playbackPolicy: "signed" }), null);
  const url = "https://stream.mux.com/signedID.m3u8?token=authorized";
  assert.deepEqual(resolveVideoSource({ videoUrl: url, playbackId: "signedID", playbackPolicy: "signed" }), { url, hls: true });
});
