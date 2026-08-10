/**
 * Wellness-data consent notice.
 *
 * Deliberately NOT shown on page load and never overlaying the header. It
 * appears at the bottom of the screen only when the user first attempts an
 * action that stores wellness data (mood check-in, journal entry, profile
 * creation) — see requestWellnessConsent() — and only until acknowledged.
 */
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { hasCurrentLegalAck, writeLegalAck, WELLNESS_CONSENT_EVENT } from "@/lib/legal";
import { Button } from "@/components/ui/button";

export function LegalConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onRequest = () => {
      if (!hasCurrentLegalAck()) setVisible(true);
    };
    window.addEventListener(WELLNESS_CONSENT_EVENT, onRequest);
    return () => window.removeEventListener(WELLNESS_CONSENT_EVENT, onRequest);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-muted/95 px-4 py-3 text-sm shadow-soft-lg backdrop-blur"
      role="region"
      aria-label="Privacy and health notice"
      data-testid="banner-legal-consent"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          Sadhana may store optional wellness data (mood, journal, profiles). It is not medical care.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
          ,{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
          ,{" "}
          <Link href="/health-disclaimer" className="underline underline-offset-2">
            Health disclaimer
          </Link>
          .
        </p>
        <Button
          className="min-h-11 shrink-0"
          onClick={() => {
            writeLegalAck();
            setVisible(false);
          }}
          data-testid="banner-legal-accept"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}
