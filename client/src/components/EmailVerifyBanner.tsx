import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useResendVerification, authErrorMessage } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type MailStatus = {
  emailEnabled?: boolean;
  deliverable?: boolean;
  requireVerification?: boolean;
};

/** Gentle remind-to-verify strip for signed-in unverified accounts. */
export function EmailVerifyBanner({ className }: { className?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const resend = useResendVerification();
  const { data: mailStatus } = useQuery<MailStatus>({
    queryKey: ["/api/auth/mail-status"],
  });

  if (!user || user.emailVerified) return null;

  const canResend = mailStatus?.deliverable === true || mailStatus?.emailEnabled === true;

  return (
    <div
      className={
        className ??
        "flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
      data-testid="email-verify-banner"
      role="status"
    >
      <div className="flex gap-3 text-sm">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">Confirm {user.email}</p>
          <p className="text-muted-foreground">
            {canResend
              ? "Your account works now — confirm your email when you can so password reset stays available."
              : "Your account works on this device. Add working email delivery later to enable password reset."}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row">
        {canResend ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11 cursor-pointer"
            disabled={resend.isPending}
            onClick={() => {
              void resend
                .mutateAsync({ email: user.email })
                .then((result) => {
                  toast({ title: "Verification email", description: result.message });
                })
                .catch((err) => {
                  toast({
                    title: "Could not resend",
                    description: authErrorMessage(err, "Try again shortly."),
                    variant: "destructive",
                  });
                });
            }}
            data-testid="email-verify-banner-resend"
          >
            {resend.isPending ? "Sending…" : "Resend email"}
          </Button>
        ) : null}
        <Button asChild variant="outline" size="sm" className="min-h-11 cursor-pointer">
          <Link href={`/verify?email=${encodeURIComponent(user.email)}`} data-testid="email-verify-banner-open">
            Verify page
          </Link>
        </Button>
      </div>
    </div>
  );
}
