export type VideoSourceInput = { videoUrl?: string | null; playbackId?: string | null; playbackPolicy?: "public" | "signed" };

/** Signed IDs must use the authorized server URL; never synthesize an unsigned fallback. */
export function resolveVideoSource({ videoUrl, playbackId, playbackPolicy }: VideoSourceInput) {
  const url = videoUrl?.trim();
  if (url) {
    try {
      const parsed = new URL(url, "https://local.invalid");
      if (!(url.startsWith("/") && !url.startsWith("//")) && parsed.protocol !== "https:") return null;
      return { url, hls: /\.m3u8$/i.test(parsed.pathname) };
    } catch { return null; }
  }
  if (playbackPolicy === "signed") return null;
  if (playbackId && /^[a-zA-Z0-9_-]+$/.test(playbackId)) {
    return { url: `https://stream.mux.com/${playbackId}.m3u8`, hls: true };
  }
  return null;
}
