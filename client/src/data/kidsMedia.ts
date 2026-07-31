/**
 * Kids pose demo videos — Ken Burns loops from kids illustrations.
 *
 * Convention:
 *   client/public/videos/kids/{slug}.webm
 *   client/public/videos/kids/{slug}.mp4
 * Poster: client/public/kids/{image}.png from kids.ts
 *
 * Regenerate with: npx tsx script/gen-kids-pose-videos.ts
 */
import { KIDS_VIDEOS_READY_LIST } from "./kidsVideosReady.generated";
import { kidsPoseBySlug } from "./kids";

export const KIDS_VIDEOS_READY = new Set<string>(KIDS_VIDEOS_READY_LIST);

export function kidsPoseHasVideo(slug: string): boolean {
  return KIDS_VIDEOS_READY.has(slug);
}

export function kidsPoseMediaFor(slug: string): {
  webm: string;
  mp4: string;
  poster: string;
} {
  const pose = kidsPoseBySlug(slug);
  const base = (() => {
    try {
      const b = import.meta.env.BASE_URL;
      if (typeof b === "string" && b.length > 0) return b;
    } catch {
      /* tests */
    }
    return "/";
  })();
  return {
    webm: `${base}videos/kids/${slug}.webm`,
    mp4: `${base}videos/kids/${slug}.mp4`,
    poster: `${base}kids/${pose?.image ?? `kids_${slug}`}.png`,
  };
}
