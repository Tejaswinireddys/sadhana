/**
 * Lightweight first-run trust notice for privacy / health data acknowledgement.
 */
import { useState } from "react";
import { Link } from "wouter";
import { hasCurrentLegalAck, writeLegalAck } from "@/lib/legal";
import { Button } from "@/components/ui/button";

export function LegalConsentBanner() {
  const [visible, setVisible] = useState(() => !hasCurrentLegalAck());

  if (!visible) return null;

  return (
    <div
      className="relative z-30 border-b border-border bg-muted/95 px-4 py-3 text-sm backdrop-blur"
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
