/**
 * Attach an HLS source to a <video> element.
 * Uses native HLS on Safari; hls.js elsewhere. Progressive MP4 remains a fallback.
 *
 * hls.js is ~590 kB and is imported **on demand**, the first time a stream
 * actually has to be attached without native support. A static import here put
 * it in the download for the pose library, search, the Trainer and every other
 * page that merely *can* show a stream — almost none of which ever do, because
 * pose media falls back to local progressive files without stream ids.
 */
import type Hls from "hls.js";

let hlsModule: Promise<typeof Hls> | null = null;
/** One shared download; a failed one is forgotten so the next attach can retry. */
function loadHls(): Promise<typeof Hls> {
  hlsModule ??= import("hls.js").then((m) => m.default).catch((error) => {
    hlsModule = null;
    throw error;
  });
  return hlsModule;
}

export type HlsAttachHandle = {
  destroy: () => void;
};

export function canPlayHlsNatively(video: HTMLVideoElement): boolean {
  return (
    video.canPlayType("application/vnd.apple.mpegurl") !== "" ||
    video.canPlayType("application/x-mpegURL") !== ""
  );
}

/**
 * Load `hlsUrl` into `video`. Calls onError when the stream cannot start.
 * Returns a destroy handle — always call it on unmount / source change.
 */
export function attachHls(
  video: HTMLVideoElement,
  hlsUrl: string,
  opts?: {
    onError?: () => void;
    onManifestParsed?: () => void;
  },
): HlsAttachHandle {
  let destroyed = false;
  let hls: Hls | null = null;

  const fail = () => {
    if (!destroyed) opts?.onError?.();
  };

  if (canPlayHlsNatively(video)) {
    video.src = hlsUrl;
    const onErr = () => fail();
    video.addEventListener("error", onErr);
    return {
      destroy() {
        destroyed = true;
        video.removeEventListener("error", onErr);
        video.removeAttribute("src");
        try {
          video.load();
        } catch {
          /* ignore */
        }
      },
    };
  }

  // The library arrives asynchronously, so every step re-checks `destroyed`:
  // a card that scrolled away before the chunk landed must not start a stream.
  void loadHls().then((HlsLib) => {
    if (destroyed) return;
    if (!HlsLib.isSupported()) {
      // No HLS support — signal failure so caller can show illustration.
      fail();
      return;
    }
    const instance = new HlsLib({
      enableWorker: true,
      lowLatencyMode: false,
      // Favor start time over quality on slow networks — ABR will climb.
      startLevel: -1,
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
    });
    hls = instance;
    instance.loadSource(hlsUrl);
    instance.attachMedia(video);
    instance.on(HlsLib.Events.MANIFEST_PARSED, () => {
      if (!destroyed) opts?.onManifestParsed?.();
    });
    instance.on(HlsLib.Events.ERROR, (_evt, data) => {
      if (!data?.fatal || destroyed) return;
      // Try a one-shot recover; then give up to illustration fallback.
      if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR) {
        try {
          hls?.startLoad();
        } catch {
          fail();
        }
        // Second fatal network error → fail (handled by timeout / next error).
        window.setTimeout(() => {
          if (!destroyed && video.readyState < 2) fail();
        }, 4000);
        return;
      }
      fail();
    });
  }, () => {
    // The chunk itself failed to load (offline, deploy in progress): same
    // outcome as a stream that cannot start — the caller shows the illustration.
    fail();
  });

  return {
    destroy() {
      destroyed = true;
      hls?.destroy();
      hls = null;
    },
  };
}

/**
 * Warm the next clip's HLS playlist/segments without showing UI.
 * Destroy the previous warm handle when the session advances.
 */
export function warmHls(hlsUrl: string): HlsAttachHandle {
  if (typeof document === "undefined") {
    return { destroy() {} };
  }
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.setAttribute("aria-hidden", "true");
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px";
  document.body.appendChild(video);
  const handle = attachHls(video, hlsUrl);
  return {
    destroy() {
      handle.destroy();
      video.remove();
    },
  };
}
