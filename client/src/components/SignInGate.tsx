/**
 * SignInGate — the moment a visitor is asked to register.
 *
 * Design intent: this replaces the gated section *in place*, sitting directly
 * under the preview the visitor has just watched. It is not a modal and not a
 * full-page interstitial, because both of those interrupt someone who is
 * already interested and give them nothing to weigh the decision against.
 *
 * It names what is behind the gate, keeps the tone of the rest of the app
 * (calm, unpushy), and — importantly — returns the visitor to the exact pose
 * they were reading once they're done. Bouncing someone to the library after
 * signup is how you lose them.
 */
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GATED_FEATURES } from "@/lib/accessPolicy";
import { Check, Lock } from "lucide-react";

export type SignInGateProps = {
  /** Headline — say what they get, not what they're missing. */
  title?: string;
  /** One line of context under the headline. */
  description?: string;
  /** Which unlocks to list. Defaults to the two most relevant. */
  features?: readonly string[];
  /** Where to send them back to after signing in. Defaults to the current URL. */
  returnTo?: string;
  /** `inline` sits inside a section; `panel` stands alone in place of a stage. */
  variant?: "inline" | "panel";
  className?: string;
  "data-testid"?: string;
};

export function SignInGate({
  title = "Create a free account to keep going",
  description = "Sadhana is free. An account is what keeps your practice — and unlocks the full teaching for every pose.",
  features = GATED_FEATURES.slice(0, 3),
  returnTo,
  variant = "inline",
  className,
  "data-testid": testId = "sign-in-gate",
}: SignInGateProps) {
  const [location] = useLocation();
  const back = encodeURIComponent(returnTo ?? location);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-accent/50 via-background to-primary/5 shadow-soft",
        variant === "panel" ? "flex h-full flex-col justify-center p-6 text-center" : "p-5 sm:p-6",
        className,
      )}
      data-testid={testId}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
        aria-hidden
      />

      <div className={cn("relative space-y-4", variant === "panel" && "mx-auto max-w-xs")}>
        <div
          className={cn(
            "flex items-center gap-2",
            variant === "panel" && "justify-center",
          )}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Lock className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="font-serif text-lg leading-tight">{title}</h3>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>

        {features.length > 0 && (
          <ul
            className={cn(
              "space-y-1.5 text-sm",
              variant === "panel" && "text-left",
            )}
            data-testid={`${testId}-features`}
          >
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="text-foreground/85">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className={cn("flex flex-col gap-2 pt-1 sm:flex-row", variant === "panel" && "sm:flex-col")}>
          <Button asChild size="lg" className="min-h-[48px] w-full cursor-pointer sm:w-auto">
            <Link href={`/register?next=${back}`} data-testid={`${testId}-signup`}>
              Create a free account
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="min-h-[44px] w-full cursor-pointer sm:w-auto"
          >
            <Link href={`/register?mode=signin&next=${back}`} data-testid={`${testId}-signin`}>
              I already have one
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Free forever. No card, no ads.
        </p>
      </div>
    </div>
  );
}

/**
 * Fades the tail of a preview so it reads as "continues below" rather than
 * "ends here" — the truncation should feel intentional, not broken.
 */
export function PreviewFade({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-background",
        className,
      )}
      aria-hidden
    />
  );
}
