/** Versioned legal copy shown in Privacy / Terms / Health disclaimer. */
export const LEGAL_VERSION = "2026-07-31";
export const POLICY_UPDATED = "July 31, 2026";

export const LEGAL_ACK_KEY = "sadhana.legalAck";

export type LegalAck = {
  version: string;
  acceptedAt: string;
};

export function readLegalAck(): LegalAck | null {
  try {
    const raw = localStorage.getItem(LEGAL_ACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegalAck;
    if (!parsed?.version || !parsed?.acceptedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLegalAck(version = LEGAL_VERSION): LegalAck {
  const ack: LegalAck = { version, acceptedAt: new Date().toISOString() };
  try {
    localStorage.setItem(LEGAL_ACK_KEY, JSON.stringify(ack));
  } catch {
    /* private mode */
  }
  return ack;
}

export function hasCurrentLegalAck(): boolean {
  return readLegalAck()?.version === LEGAL_VERSION;
}

/** Fired the first time the user takes an action that stores wellness data. */
export const WELLNESS_CONSENT_EVENT = "sadhana:wellness-consent";

/**
 * Ask the user to acknowledge the privacy/health notice at the moment they
 * first do something that stores wellness data (a mood check-in, a journal
 * entry, creating a profile) — never on page load. No-op if they've already
 * acknowledged the current legal version. The banner listens for the event.
 */
export function requestWellnessConsent(): void {
  if (typeof window === "undefined") return;
  if (hasCurrentLegalAck()) return;
  window.dispatchEvent(new Event(WELLNESS_CONSENT_EVENT));
}
