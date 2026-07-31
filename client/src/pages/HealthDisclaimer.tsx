import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { LEGAL_VERSION, POLICY_UPDATED } from "@/lib/legal";

export default function HealthDisclaimer() {
  useDocumentTitle("Health Disclaimer · Sadhana");
  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6 py-2">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Version {LEGAL_VERSION} · Updated {POLICY_UPDATED}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Health disclaimer</h1>
        <p className="text-muted-foreground">
          Important safety information for yoga, breathing, pregnancy, and children’s practice.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">General</h2>
        <p className="text-muted-foreground">
          Sadhana offers illustrated poses, voice guidance, and rule-based session suggestions. It
          does not diagnose, treat, or prevent disease. Consult a qualified clinician before starting
          a new exercise program, especially if you have injuries, chronic conditions, or recent
          surgery.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Stop signals</h2>
        <p className="text-muted-foreground">
          Stop immediately and seek care if you experience sharp pain, chest pain, severe shortness
          of breath, dizziness, fainting, or any symptom that worries you. Modifications and
          contraindications in the app are educational hints, not a guarantee of safety for your
          body.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Pregnancy &amp; postpartum</h2>
        <p className="text-muted-foreground">
          Pregnancy and postpartum paths are general adaptations. Obtain clearance from your
          maternity care provider. Avoid poses or breath practices they advise against. Trimester
          and recovery needs vary widely.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Children</h2>
        <p className="text-muted-foreground">
          Kids content is for playful, supervised movement. An adult should stay present. The parent
          gate is a soft barrier, not childproofing.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        See also{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>{" "}
        and{" "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
        .
      </p>
    </FadeIn>
  );
}
