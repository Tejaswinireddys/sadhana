/**
 * Client access to the video class library (`server/classLibrary.ts`).
 * Query keys are URL paths, as everywhere else; the default queryFn fetches
 * them with device headers and credentials.
 */
import { useQuery } from "@tanstack/react-query";
import type { ClassLevel, ClassProgressBody, ClassSummary, ClassDurationRangeId, ViewerPlan } from "@shared/classLibrary";
import { durationRange } from "@shared/classLibrary";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type ClassListResponse = {
  items: ClassSummary[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  hasMore: boolean;
  viewerPlan: ViewerPlan;
};
export type ClassDetailResponse = { class: ClassSummary; next: ClassSummary | null; viewerPlan: ViewerPlan };

export const CLASS_PROGRESS_KEY = ["/api/class-progress"];

export type LibraryFilters = { level?: ClassLevel; duration?: ClassDurationRangeId; focus?: string };

/** `/api/classes?…` for the chosen chips (one page holds the whole library). */
export function classListUrl(filters: LibraryFilters): string {
  const params = new URLSearchParams();
  if (filters.level) params.set("level", filters.level);
  if (filters.focus) params.set("focus", filters.focus);
  const { minMinutes, maxMinutes } = durationRange(filters.duration);
  if (minMinutes !== undefined) params.set("minMinutes", String(minMinutes));
  if (maxMinutes !== undefined) params.set("maxMinutes", String(maxMinutes));
  params.set("pageSize", "50");
  return `/api/classes?${params.toString()}`;
}

export function useClassList(filters: LibraryFilters) {
  return useQuery<ClassListResponse>({ queryKey: [classListUrl(filters)], staleTime: 30_000 });
}

/** Started, unfinished classes; always refetched so Today and the row are current. */
export function useContinueWatching() {
  return useQuery<{ items: ClassSummary[] }>({ queryKey: CLASS_PROGRESS_KEY, staleTime: 0, refetchOnMount: "always" });
}

export function useClassDetail(slug: string) {
  return useQuery<ClassDetailResponse>({
    queryKey: [`/api/classes/${encodeURIComponent(slug)}`],
    // Plan or progress may have changed since the list was loaded.
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/**
 * Fresh playback for one class (new signed tokens), without touching the
 * cached detail: the player swaps tokens itself so the page does not re-render.
 */
export async function fetchClassPlayback(slug: string): Promise<ClassSummary["playback"]> {
  const res = await apiRequest("GET", `/api/classes/${encodeURIComponent(slug)}`, undefined, { timeoutMs: 15_000 });
  const body = (await res.json()) as ClassDetailResponse;
  return body.class.playback;
}

export async function saveClassProgress(slug: string, body: ClassProgressBody, options: { keepalive: boolean }) {
  await apiRequest("POST", `/api/classes/${encodeURIComponent(slug)}/progress`, body, { keepalive: options.keepalive, timeoutMs: 10_000 });
}

/** After leaving a class, Today and "Continue watching" should reflect it. */
export function refreshClassProgress() {
  void queryClient.invalidateQueries({ queryKey: CLASS_PROGRESS_KEY });
  void queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/classes") });
}

export function formatClassMinutes(minutes: number): string {
  return `${minutes} min`;
}

export function levelLabel(level: ClassLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

/** "2:05" / "1:02:05" for resume labels. */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
