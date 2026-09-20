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

/** Fired when an immersive player opens or closes. */
export const IMMERSIVE_PLAYER_EVENT = "sadhana:immersive-player";

let immersivePlayerActive = false;

/**
 * Guided practice is a full-screen, timed experience with its own fixed
 * controls. A consent notice that appears over it interrupts the practice and
 * puts its "Got it" button underneath the player's own control bar — which is
 * how the notice became undismissable until the user left the session.
 *
 * Players declare themselves active here; the banner waits for them.
 */
export function setImmersivePlayerActive(active: boolean): void {
  if (typeof window === "undefined") return;
  if (immersivePlayerActive === active) return;
  immersivePlayerActive = active;
  window.dispatchEvent(new Event(IMMERSIVE_PLAYER_EVENT));
}

export function isImmersivePlayerActive(): boolean {
  return immersivePlayerActive;
}
