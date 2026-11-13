/**
 * One audible/visible media owner at a time on a pose (or any) page.
 *
 * Pose detail can host an AI trainer <video>, a Mux/idle preview, the guided
 * pose-lesson <audio>, VoicePlayer, and speechSynthesis. Without coordination
 * they overlap. Claiming media pauses every other HTMLMediaElement and cancels
 * speechSynthesis; listeners pause their own React-driven clocks.
 */

export type PageMediaClaim = { id: string };

type Handler = (claim: PageMediaClaim) => void;

const handlers = new Set<Handler>();

/** Pause every video/audio except the one marked with data-media-owner=keepId. */
export function pauseForeignHtmlMedia(keepId: string | null) {
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLMediaElement>("video, audio").forEach((el) => {
    if (keepId && el.dataset.mediaOwner === keepId) return;
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  });
}

function cancelSpeech() {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Announce that `id` is now the active media. Pauses foreign HTML media and
 * speechSynthesis, then notifies React subscribers so they can stop clocks.
 */
export function claimPageMedia(id: string) {
  pauseForeignHtmlMedia(id);
  cancelSpeech();
  const claim: PageMediaClaim = { id };
  for (const handler of handlers) {
    try {
      handler(claim);
    } catch {
      /* a bad listener must not break others */
    }
  }
}

export function onPageMediaClaim(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
