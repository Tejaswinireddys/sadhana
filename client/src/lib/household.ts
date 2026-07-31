/**
 * Household profiles — adult / child / senior with optional PIN gates.
 */
import { KEYS, readJson, writeJson } from "./localPrefs";

export type HouseholdRole = "adult" | "child" | "senior" | "prenatal" | "postnatal";

export type HouseholdMember = {
  id: string;
  name: string;
  role: HouseholdRole;
  /** Optional 4-digit PIN (stored locally only) */
  pin?: string;
  consentAt?: string;
};

export type Household = {
  members: HouseholdMember[];
  activeId: string | null;
};

export function readHousehold(): Household {
  return readJson<Household>(KEYS.household, { members: [], activeId: null });
}

export function writeHousehold(h: Household) {
  writeJson(KEYS.household, h);
}

export function addMember(partial: Omit<HouseholdMember, "id">): Household {
  const h = readHousehold();
  const member: HouseholdMember = {
    ...partial,
    id: crypto.randomUUID(),
    consentAt: new Date().toISOString(),
  };
  h.members.push(member);
  if (!h.activeId) h.activeId = member.id;
  writeHousehold(h);
  return h;
}

export function setActiveMember(id: string | null): Household {
  const h = readHousehold();
  h.activeId = id;
  writeHousehold(h);
  return h;
}

export function verifyPin(member: HouseholdMember, pin: string): boolean {
  if (!member.pin) return true;
  return member.pin === pin;
}

export function roleDefaults(role: HouseholdRole): { pathwayHint: string; note: string } {
  switch (role) {
    case "child":
      return { pathwayHint: "/kids", note: "Kids content stays parent-gated." };
    case "senior":
      return {
        pathwayHint: "/pathways/chair-limited-mobility",
        note: "Prefer chair/wall options and longer transitions.",
      };
    case "prenatal":
      return {
        pathwayHint: "/profiles",
        note: "Use the Pregnancy profile and reviewed prenatal poses only.",
      };
    case "postnatal":
      return {
        pathwayHint: "/pathways/foundations-beginner",
        note: "Start gently; obtain clearance from your care provider.",
      };
    default:
      return { pathwayHint: "/", note: "Full adult library." };
  }
}
