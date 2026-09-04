import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { FadeIn } from "@/components/motion";
import { LEGAL_VERSION, POLICY_UPDATED } from "@/lib/legal";

export default function Privacy() {
  useDocumentTitle("Privacy Policy · Sadhana");
  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6 py-2">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Version {LEGAL_VERSION} · Updated {POLICY_UPDATED}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-muted-foreground">
          How Sadhana collects, uses, and shares information when you practice.
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-serif text-xl">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Guest practice:</strong> an anonymous device id
            (cookie / header) so sessions, journal entries, favorites, and preferences stay on your
            browser without an account.
          </li>
          <li>
            <strong className="text-foreground">Optional account:</strong> email, password hash,
            display name, and session tokens if you create an account.
          </li>
          <li>
            <strong className="text-foreground">Wellness inputs you choose to provide:</strong>{" "}
            practice history, mood check-ins, journal text, injury/profile preferences, pregnancy
            path selection, mobility check-ins, and children’s sticker progress.
          </li>
          <li>
            <strong className="text-foreground">Technical:</strong> basic request logs (method, path,
            status, duration). Sensitive fields are redacted.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">How we use it</h2>
        <p className="text-muted-foreground">
          To provide practice features, sync optional accounts, personalize recommendations within
          our rule-based trainer, and keep the service reliable and secure. We do not sell personal
          data. We do not use journal or health-related text to train third-party models.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Sensitive / health-related data</h2>
        <p className="text-muted-foreground">
          Mood, injury notes, pregnancy profile, and similar inputs can be sensitive. Provide them
          only if you want Sadhana to adapt practice. See the{" "}
          <Link href="/health-disclaimer" className="underline underline-offset-2">
            health disclaimer
          </Link>
          . You can export or delete practice data anytime in Settings; signed-in users can delete
          their full account from Account.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Children</h2>
        <p className="text-muted-foreground">
          The Kids section is designed for family use with a parent gate. We do not knowingly collect
          contact information from children for marketing. Parents should supervise practice and can
          clear data from Settings. See also our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms of Use
          </Link>
          .
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Retention &amp; your rights</h2>
        <p className="text-muted-foreground">
          Guest data lives with your device identity until you clear it or the store resets. Account
          data remains until you delete the account. You may request export or deletion in-product.
          Where applicable law grants access, correction, or erasure rights, use those in-app
          controls or email privacy@sadhana.app.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Product analytics</h2>
        <p className="text-muted-foreground">
          When an operator configures PostHog (self-hosted or EU/US cloud), Sadhana may send
          anonymous product events such as quiz steps, paywall views, practice session start/complete,
          and subscription lifecycle — never journal text, emails, passwords, or injury notes. In-app
          session analytics respect the Settings opt-in. Acquisition events on{" "}
          <Link href="/start" className="underline underline-offset-2">
            /start
          </Link>{" "}
          may be captured anonymously when PostHog is configured so operators can see per-question
          drop-off. Funnel metrics are reviewed internally; this Privacy page does not link a
          public operator dashboard.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed">
        <h2 className="font-serif text-xl">Processors &amp; hosting</h2>
        <p className="text-muted-foreground">
          Self-hosted or cloud deployments may use a host (for example Render) and optional Postgres
          (for example Supabase). Operators of a deployment are responsible for their subprocessors,
          backups, and regional compliance. Optional analytics may use PostHog (self-hostable; EU
          cloud available).
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        This policy is provided for transparency for an open-source wellness app. It is not legal
        advice. Operators should have counsel review before commercial launch.
      </p>
    </FadeIn>
  );
}
