export type VideoSourceInput = { videoUrl?: string | null; playbackId?: string | null };

/** Playback IDs are public identifiers; Mux API credentials never reach the browser. */
export function resolveVideoSource({ videoUrl, playbackId }: VideoSourceInput) {
  const url = videoUrl?.trim();
  if (url) {
    try {
      const parsed = new URL(url, "https://local.invalid");
      if (!(url.startsWith("/") && !url.startsWith("//")) && parsed.protocol !== "https:") return null;
      return { url, hls: /\.m3u8$/i.test(parsed.pathname) };
    } catch { return null; }
  }
  if (playbackId && /^[a-zA-Z0-9_-]+$/.test(playbackId)) {
    return { url: `https://stream.mux.com/${playbackId}.m3u8`, hls: true };
  }
  return null;
}
