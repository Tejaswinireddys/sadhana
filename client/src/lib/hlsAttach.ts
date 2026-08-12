/**
 * Attach an HLS source to a <video> element.
 * Uses native HLS on Safari; hls.js elsewhere. Progressive MP4 remains a fallback.
 */
import Hls from "hls.js";

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

  if (Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      // Favor start time over quality on slow networks — ABR will climb.
      startLevel: -1,
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (!destroyed) opts?.onManifestParsed?.();
    });
    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data?.fatal || destroyed) return;
      // Try a one-shot recover; then give up to illustration fallback.
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
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
    return {
      destroy() {
        destroyed = true;
        hls?.destroy();
        hls = null;
      },
    };
  }

  // No HLS support — signal failure so caller can show illustration.
  fail();
  return {
    destroy() {
      destroyed = true;
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
