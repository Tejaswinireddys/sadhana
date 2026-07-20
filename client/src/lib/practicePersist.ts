import type { SessionMeta } from "@/context/PracticeContext";

const KEY = "sadhana.practice.v1";

export type PersistedPose = {
  slug: string;
  holdSeconds?: number;
  sides?: "once" | "each";
};

export type PersistedProgress = {
  mode: "guided" | "practice";
  index: number;
  remaining?: number;
  phase?: string;
  phaseRemaining?: number;
  side?: 1 | 2;
  started: boolean;
  elapsedTotal: number;
  paused?: boolean;
};

export type PersistedPractice = {
  poses: PersistedPose[];
  meta: SessionMeta;
  progress?: PersistedProgress | null;
};

export function loadPersistedPractice(): PersistedPractice | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPractice;
    if (!parsed || !Array.isArray(parsed.poses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePersistedPractice(data: PersistedPractice): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedPractice(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function updatePersistedProgress(progress: PersistedProgress | null): void {
  const current = loadPersistedPractice();
  if (!current || current.poses.length === 0) return;
  savePersistedPractice({ ...current, progress });
}
