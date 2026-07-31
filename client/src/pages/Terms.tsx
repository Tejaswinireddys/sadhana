import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { LEGAL_VERSION, POLICY_UPDATED } from "@/lib/legal";

export default function Terms() {
  useDocumentTitle("Terms of Use · Sadhana");
  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6 py-2">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Version {LEGAL_VERSION} · Updated {POLICY_UPDATED}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Terms of Use</h1>
        <p className="text-muted-foreground">
          The rules for using Sadhana’s guided yoga and wellness tools.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Not medical care</h2>
        <p className="text-muted-foreground">
          Sadhana is an educational practice companion, not a doctor, physiotherapist, or emergency
          service. Read the{" "}
          <Link href="/health-disclaimer" className="underline underline-offset-2">
            health disclaimer
          </Link>{" "}
          before practicing. Stop if you feel pain, dizziness, or unusual discomfort.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Accounts &amp; guest mode</h2>
        <p className="text-muted-foreground">
          You may practice as a guest or create an optional account. You are responsible for keeping
          credentials confidential and for activity under your account. Password reset uses a
          one-time token. We may rate-limit abuse.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Acceptable use</h2>
        <p className="text-muted-foreground">
          Do not attempt to break authentication, scrape in a way that harms the service, upload
          unlawful content, or use Kids features to collect children’s data for advertising. We may
          suspend access that threatens security or other users.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Content &amp; open source</h2>
        <p className="text-muted-foreground">
          Pose descriptions, safety notes, and media are provided “as is.” The software is MIT
          licensed where published on GitHub; content accuracy is not guaranteed. Contraindications
          and modifications are authored guidance, not clinical clearance.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Privacy</h2>
        <p className="text-muted-foreground">
          Our{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          explains data practices. Creating an account or continuing to use wellness features after
          being shown the policy constitutes acknowledgement of that notice.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Limitation of liability</h2>
        <p className="text-muted-foreground">
          To the fullest extent permitted by law, Sadhana and its contributors are not liable for
          injuries, data loss, or damages arising from practice or use of the software. Some
          jurisdictions do not allow certain limitations; those limits apply only as allowed.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Contact: support@sadhana.app. These terms may be updated; the version above is the current
        one shown in the app.
      </p>
    </FadeIn>
  );
}
