import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStreamPlaybackUrls, streamConfigured, streamCspHosts } from "./streamConfig";

describe("streamConfig", () => {
  it("builds Bunny HLS + MP4 URLs from a playback id", () => {
    const prevHost = process.env.BUNNY_STREAM_CDN_HOSTNAME;
    const prevProvider = process.env.STREAM_PROVIDER;
    process.env.STREAM_PROVIDER = "bunny";
    process.env.BUNNY_STREAM_CDN_HOSTNAME = "vz-demo.b-cdn.net";
    try {
      assert.equal(streamConfigured("bunny"), true);
      const urls = buildStreamPlaybackUrls("abc-123");
      assert.ok(urls);
      assert.equal(urls!.provider, "bunny");
      assert.equal(urls!.hls, "https://vz-demo.b-cdn.net/abc-123/playlist.m3u8");
      assert.equal(urls!.mp4, "https://vz-demo.b-cdn.net/abc-123/play_720p.mp4");
      assert.ok(streamCspHosts("bunny").some((h) => h.includes("b-cdn.net")));
    } finally {
      if (prevHost === undefined) delete process.env.BUNNY_STREAM_CDN_HOSTNAME;
      else process.env.BUNNY_STREAM_CDN_HOSTNAME = prevHost;
      if (prevProvider === undefined) delete process.env.STREAM_PROVIDER;
      else process.env.STREAM_PROVIDER = prevProvider;
    }
  });

  it("builds Mux URLs", () => {
    const urls = buildStreamPlaybackUrls("playXYZ", "mux");
    assert.ok(urls);
    assert.equal(urls!.hls, "https://stream.mux.com/playXYZ.m3u8");
  });

  it("builds Cloudflare Stream URLs", () => {
    const prev = process.env.CF_STREAM_CUSTOMER_SUBDOMAIN;
    process.env.CF_STREAM_CUSTOMER_SUBDOMAIN = "customer-demo.cloudflarestream.com";
    try {
      const urls = buildStreamPlaybackUrls("vid99", "cloudflare");
      assert.ok(urls);
      assert.equal(
        urls!.hls,
        "https://customer-demo.cloudflarestream.com/vid99/manifest/video.m3u8",
      );
    } finally {
      if (prev === undefined) delete process.env.CF_STREAM_CUSTOMER_SUBDOMAIN;
      else process.env.CF_STREAM_CUSTOMER_SUBDOMAIN = prev;
    }
  });
});
