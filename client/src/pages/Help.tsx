/**
 * Help — the page error states point at.
 *
 * Written for the questions a first-time guest actually hits: how to get back
 * in when password reset is unavailable, whether an account is needed at all,
 * what the kids gate is for, and how streak credit works.
 */
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FadeIn } from "@/components/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Help() {
  useDocumentTitle("Help · Sadhana");
  // Same source the Account page uses, so Help never contradicts it.
  const { data: mailStatus } = useQuery<{ emailEnabled: boolean }>({
    queryKey: ["/api/auth/mail-status"],
  });
  const emailWorks = mailStatus?.emailEnabled !== false;

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6 pb-16">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Help</h1>
        <p className="text-sm text-muted-foreground">
          Short answers to the things that most often go wrong. Nothing here is medical advice —
          see the{" "}
          <Link href="/health-disclaimer" className="underline underline-offset-2">
            health disclaimer
          </Link>
          .
        </p>
      </header>

      <Card data-testid="help-reset">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            I can&apos;t reset my password
            {!emailWorks ? (
              <Badge variant="outline" data-testid="help-email-status">
                Email is unavailable on this server
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {emailWorks ? (
            <p>
              Open{" "}
              <Link href="/account?tab=reset" className="underline underline-offset-2">
                Account → Reset
              </Link>
              , enter your email, and use the code we send you to set a new password.
            </p>
          ) : (
            <>
              <p>
                This deployment has no transactional email configured, so no reset code can be sent
                to your inbox. Instead, every account created here is given a{" "}
                <strong className="text-foreground">recovery code</strong> at signup — shown once,
                on screen.
              </p>
              <p className="font-medium text-foreground">If you still have your recovery code:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Open{" "}
                  <Link href="/account?tab=reset" className="underline underline-offset-2">
                    Account → Reset
                  </Link>
                  .
                </li>
                <li>Enter your email, the recovery code, and a new password.</li>
                <li>
                  You will be signed in, and issued a fresh recovery code — the old one is used up.
                  Save the new one.
                </li>
              </ol>
              <p className="text-xs">
                Letter case and dashes do not matter, so a code copied by hand still works.
              </p>
              <p className="font-medium text-foreground">If you lost your recovery code:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  The password cannot be reset on this server. That is the trade-off for not
                  depending on email, and we would rather be plain about it.
                </li>
                <li>
                  Your practice is stored on this device even when signed out — keep using Sadhana
                  as a guest and nothing is lost.
                </li>
                <li>
                  For data held under a locked account, email{" "}
                  <a href="mailto:privacy@sadhana.app" className="underline underline-offset-2">
                    privacy@sadhana.app
                  </a>{" "}
                  and ask for an export.
                </li>
                <li>
                  If you run this deployment: set <code className="text-xs">RESEND_API_KEY</code> or{" "}
                  <code className="text-xs">EMAIL_WEBHOOK_URL</code> and redeploy to switch on
                  ordinary email resets.
                </li>
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card data-testid="help-guest">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Do I need an account?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            No. Every practice, the journal and your progress work as a guest, stored in this
            browser on this device.
          </p>
          <p>
            An account exists for one reason: carrying that history to another device. The trade-off
            is that guest data lives only in this browser — clearing site data, or switching
            browsers, starts you fresh.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="help-kids">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Why does Kids ask a maths question?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            It is a grown-up check, so a child cannot wander from the kids section into the adult
            catalog, billing or account settings on their own.
          </p>
          <p>
            Once you pass it, this browser remembers for a short while so you are not re-tested
            every visit. Clearing site data resets it.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="help-streaks">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">How does streak credit work?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            A session counts when you actually practise it. Leaving early, or skipping through the
            poses, does not earn credit — the player tells you before you exit.
          </p>
          <p>
            Missing a day does not delete anything. There is no penalty and no streak shaming; the
            number simply reflects the days you practised.
          </p>
        </CardContent>
      </Card>

      <Card data-testid="help-contact">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Something else is wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Email{" "}
            <a href="mailto:privacy@sadhana.app" className="underline underline-offset-2">
              privacy@sadhana.app
            </a>
            . Include the page you were on and what you expected to happen.
          </p>
          <p>
            See also{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy
            </Link>
            ,{" "}
            <Link href="/terms" className="underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/cancel" className="underline underline-offset-2">
              how to cancel
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
