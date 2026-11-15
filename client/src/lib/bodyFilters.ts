/**
 * Limits the practitioner sets once and every generator has to honour.
 *
 * These are not medical advice. They drop poses whose own catalog text says
 * to avoid the situation, plus inversions and jumps when those limits are on.
 */
import type { Asana } from "@/data/content";
import { readJson, writeJson } from "@/lib/localPrefs";

export const BODY_FILTERS = [
  { id: "wrists", label: "Sensitive wrists" },
  { id: "knees", label: "Sensitive knees" },
  { id: "lower-back", label: "Sensitive lower back" },
  { id: "pregnancy", label: "Pregnancy" },
  { id: "no-inversions", label: "High blood pressure — no inversions" },
  { id: "no-jumping", label: "No jumping" },
] as const;

export type BodyFilterId = (typeof BODY_FILTERS)[number]["id"];

const KEY = "sadhana.body.limits";

export type BodyLimits = {
  filters: BodyFilterId[];
  hidden: string[];
  liked: string[];
};

const EMPTY: BodyLimits = { filters: [], hidden: [], liked: [] };

function isFilter(id: string): id is BodyFilterId {
  return BODY_FILTERS.some((f) => f.id === id);
}

export function readBodyLimits(): BodyLimits {
  const raw = readJson<Partial<BodyLimits>>(KEY, EMPTY);
  return {
    filters: (raw.filters ?? []).filter(isFilter),
    hidden: (raw.hidden ?? []).filter((s) => typeof s === "string"),
    liked: (raw.liked ?? []).filter((s) => typeof s === "string"),
  };
}

export function writeBodyLimits(next: BodyLimits): void {
  writeJson(KEY, next);
}

export function toggleBodyFilter(id: BodyFilterId): BodyLimits {
  const current = readBodyLimits();
  const filters = current.filters.includes(id)
    ? current.filters.filter((f) => f !== id)
    : [...current.filters, id];
  const next = { ...current, filters };
  writeBodyLimits(next);
  return next;
}

export function setPosePreference(slug: string, pref: "like" | "hide" | "none"): BodyLimits {
  const current = readBodyLimits();
  const hidden = current.hidden.filter((s) => s !== slug);
  const liked = current.liked.filter((s) => s !== slug);
  if (pref === "hide") hidden.push(slug);
  if (pref === "like") liked.push(slug);
  const next = { ...current, hidden, liked };
  writeBodyLimits(next);
  return next;
}

function isInversion(asana: Asana): boolean {
  if (asana.category === "Inversions") return true;
  return /inversion/.test(`${asana.english} ${asana.summary}`.toLowerCase());
}

/** Catalog cautions only. Step cues mention knees and wrists even when the pose is gentle. */
function cautionText(asana: Asana): string {
  return [...asana.contraindications, ...asana.avoidIf.map((row) => row.condition)].join(" ").toLowerCase();
}

/** Why this pose is out, or null if it may be practised under these limits. */
export function poseBlockedReason(asana: Asana, filters: readonly BodyFilterId[]): string | null {
  if (filters.length === 0) return null;
  const caution = cautionText(asana);
  const steps = asana.steps.map((step) => step.text).join(" ").toLowerCase();
  if (filters.includes("wrists") && (/wrist|carpal/.test(caution) || /plank|chaturanga/.test(asana.slug))) {
    return "wrists";
  }
  if (filters.includes("knees") && /\bknee/.test(caution)) return "knees";
  if (filters.includes("lower-back") && /lower back|lumbar|disc/.test(caution)) return "lower back";
  if (filters.includes("pregnancy") && (/pregnan/.test(caution) || isInversion(asana))) {
    return "pregnancy";
  }
  if (filters.includes("no-inversions") && (isInversion(asana) || /high blood pressure|hypertension/.test(caution))) {
    return "no inversions";
  }
  if (filters.includes("no-jumping") && /\bjump/.test(steps)) return "no jumping";
  return null;
}

export function poseIsHidden(slug: string, hidden: readonly string[]): boolean {
  return hidden.includes(slug);
}
