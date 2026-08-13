/**
 * Adaptive streaming host configuration.
 *
 * Provider is selected with STREAM_PROVIDER (default: bunny).
 * Playback IDs are stored per pose (DB / seed file); this module only builds URLs.
 *
 * Env:
 *   STREAM_PROVIDER=bunny|mux|cloudflare
 *   BUNNY_STREAM_CDN_HOSTNAME=vz-xxxx.b-cdn.net
 *   BUNNY_STREAM_LIBRARY_ID=   (optional; used by upload tooling)
 *   BUNNY_STREAM_API_KEY=      (optional; upload tooling)
 *   MUX_PLAYBACK_DOMAIN=stream.mux.com
 *   CF_STREAM_CUSTOMER_SUBDOMAIN=customer-xxxxx.cloudflarestream.com
 */

export type StreamProvider = "bunny" | "mux" | "cloudflare";

export type StreamPlaybackUrls = {
  provider: StreamProvider;
  playbackId: string;
  hls: string;
  /** Progressive MP4 when the host exposes one; null if HLS-only. */
  mp4: string | null;
};

export function streamProvider(): StreamProvider {
  const raw = (process.env.STREAM_PROVIDER || "bunny").toLowerCase().trim();
  if (raw === "mux" || raw === "cloudflare" || raw === "bunny") return raw;
  return "bunny";
}

export function streamConfigured(provider = streamProvider()): boolean {
  if (provider === "bunny") {
    return Boolean(process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim());
  }
  if (provider === "mux") return true; // public stream.mux.com needs only playback IDs
  if (provider === "cloudflare") {
    return Boolean(process.env.CF_STREAM_CUSTOMER_SUBDOMAIN?.trim());
  }
  return false;
}

/** Hosts to allowlist in CSP media-src / connect-src. */
export function streamCspHosts(provider = streamProvider()): string[] {
  if (provider === "bunny") {
    const host = process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim();
    const hosts = ["https://*.b-cdn.net", "https://iframe.mediadelivery.net"];
    if (host) {
      const h = host.replace(/^https?:\/\//, "");
      hosts.push(`https://${h}`);
    }
    return hosts;
  }
  if (provider === "mux") {
    return ["https://stream.mux.com", "https://*.mux.com", "https://*.muxed.com"];
  }
  if (provider === "cloudflare") {
    const sub = process.env.CF_STREAM_CUSTOMER_SUBDOMAIN?.trim();
    const hosts = ["https://*.cloudflarestream.com", "https://videodelivery.net"];
    if (sub) {
      const h = sub.replace(/^https?:\/\//, "");
      hosts.push(`https://${h}`);
    }
    return hosts;
  }
  return [];
}

/**
 * Build HLS (+ optional MP4) URLs for a stored playback ID.
 * Returns null when the provider is not configured.
 */
export function buildStreamPlaybackUrls(
  playbackId: string,
  provider: StreamProvider = streamProvider(),
): StreamPlaybackUrls | null {
  const id = playbackId.trim();
  if (!id) return null;

  if (provider === "bunny") {
    const cdn = process.env.BUNNY_STREAM_CDN_HOSTNAME?.trim()?.replace(/^https?:\/\//, "");
    if (!cdn) return null;
    return {
      provider,
      playbackId: id,
      hls: `https://${cdn}/${id}/playlist.m3u8`,
      // Bunny exposes a progressive fallback under the same pull zone.
      mp4: `https://${cdn}/${id}/play_720p.mp4`,
    };
  }

  if (provider === "mux") {
    const domain = (process.env.MUX_PLAYBACK_DOMAIN || "stream.mux.com").replace(/^https?:\/\//, "");
    return {
      provider,
      playbackId: id,
      hls: `https://${domain}/${id}.m3u8`,
      mp4: null,
    };
  }

  if (provider === "cloudflare") {
    const sub = process.env.CF_STREAM_CUSTOMER_SUBDOMAIN?.trim()?.replace(/^https?:\/\//, "");
    if (!sub) return null;
    return {
      provider,
      playbackId: id,
      hls: `https://${sub}/${id}/manifest/video.m3u8`,
      mp4: `https://${sub}/${id}/downloads/default.mp4`,
    };
  }

  return null;
}
