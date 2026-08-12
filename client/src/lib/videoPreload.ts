/**
 * Prefetch the next pose clip in a guided session so pose transitions
 * never wait on a cold HLS start.
 */
import { fetchPoseMedia } from "@/lib/poseMediaApi";
import { warmHls, type HlsAttachHandle } from "@/lib/hlsAttach";

let warmSlug: string | null = null;
let warmHandle: HlsAttachHandle | null = null;

function saveDataOn(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !!conn?.saveData;
}

/** Prefetch HLS (preferred) or progressive MP4 for `slug`. */
export async function preloadPoseVideo(slug: string | undefined | null): Promise<void> {
  if (!slug || saveDataOn()) return;
  if (warmSlug === slug) return;
  warmHandle?.destroy();
  warmHandle = null;
  warmSlug = slug;

  try {
    const manifest = await fetchPoseMedia(slug);
    const hls = manifest.video?.hls;
    const mp4 = manifest.video?.mp4;
    if (hls) {
      warmHandle = warmHls(hls);
      return;
    }
    if (mp4 && typeof document !== "undefined") {
      // Progressive warm: metadata only.
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.src = mp4;
      v.load();
      warmHandle = {
        destroy() {
          v.removeAttribute("src");
          try {
            v.load();
          } catch {
            /* ignore */
          }
        },
      };
    }
  } catch {
    warmSlug = null;
  }
}

export function clearPreloadedPoseVideo() {
  warmHandle?.destroy();
  warmHandle = null;
  warmSlug = null;
}
