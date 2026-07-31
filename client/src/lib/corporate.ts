/**
 * Corporate wellness tenant scaffolding — aggregate reporting only.
 */
import { readJson, writeJson } from "./localPrefs";

const TENANT_KEY = "sadhana.corporate.tenant";

export type CorporateTenant = {
  name: string;
  seats: number;
  ssoProvider: "none" | "okta" | "azure" | "google";
  programs: string[];
  /** Aggregate-only metrics — never individual health */
  aggregates: {
    weeklyActive: number;
    sessionsCompleted: number;
    avgMinutes: number;
  };
};

export const DEFAULT_TENANT: CorporateTenant = {
  name: "",
  seats: 50,
  ssoProvider: "none",
  programs: ["desk-break", "stress-release-week", "chair-limited-mobility"],
  aggregates: { weeklyActive: 0, sessionsCompleted: 0, avgMinutes: 0 },
};

export function readTenant(): CorporateTenant {
  return { ...DEFAULT_TENANT, ...readJson<Partial<CorporateTenant>>(TENANT_KEY, {}) };
}

export function writeTenant(t: CorporateTenant) {
  writeJson(TENANT_KEY, t);
}

/** Simulate aggregate bump after anonymous practice (no user identity stored). */
export function bumpCorporateAggregate(minutes: number) {
  const t = readTenant();
  if (!t.name) return;
  t.aggregates.sessionsCompleted += 1;
  t.aggregates.weeklyActive = Math.min(t.seats, t.aggregates.weeklyActive + 1);
  const n = t.aggregates.sessionsCompleted;
  t.aggregates.avgMinutes = Math.round(
    (t.aggregates.avgMinutes * (n - 1) + minutes) / n,
  );
  writeTenant(t);
}
