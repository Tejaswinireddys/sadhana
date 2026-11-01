import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/use-toast";
import {
  authErrorMessage,
  useAuth,
  useResendVerification,
  verifyEmailAndSignIn,
} from "@/lib/auth";
import { classifyVerifyError, forgetVerifyAttempt, verifyOnce, type VerifyPhase } from "@/lib/verifyEmailFlow";
import { ArrowRight, CircleCheck, MailCheck } from "lucide-react";

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert" data-testid="verify-error">
      {message}
    </p>
  );
}

function readQuery() {
  return new URLSearchParams(window.location.search);
}

const INVALID_FALLBACK = "This verification link is invalid or has expired. Send yourself a new one below.";
const RETRY_MESSAGE = "We couldn't reach the server to verify your email. Check your connection and try again.";

export default function VerifyEmail() {
  useDocumentTitle("Verify email · Sadhana");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const resend = useResendVerification();

  const [initial] = useState(() => readQuery());
  const linkToken = initial.get("token") ?? "";
  const [email, setEmail] = useState(initial.get("email") ?? "");
  const [token, setToken] = useState(linkToken);
  const [phase, setPhase] = useState<VerifyPhase>(linkToken ? "verifying" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  /** The token of the request whose outcome is on screen. */
  const activeToken = useRef<string | null>(null);

  const run = useCallback((rawToken: string, rawEmail: string) => {
    const t = rawToken.trim();
    activeToken.current = t;
    setError(null);
    setPhase("verifying");
    // verifyOnce shares one request per token, so a double effect or remount
    // cannot send an already-consumed token and turn a success into a failure.
    verifyOnce(t, () => verifyEmailAndSignIn({ token: t, email: rawEmail.trim() || undefined }))
      .then(({ user: signedIn }) => {
        if (activeToken.current !== t) return;
        setDisplayName(signedIn.displayName ?? null);
        setPhase("success");
      })
      .catch((err: unknown) => {
        if (activeToken.current !== t) return;
        const kind = classifyVerifyError(err);
        setPhase(kind);
        setError(kind === "invalid" ? authErrorMessage(err, INVALID_FALLBACK) : RETRY_MESSAGE);
      });
  }, []);

  // A bare /verify visit by someone already verified has nothing to do here.
  useEffect(() => {
    if (!linkToken && phase === "idle" && user?.emailVerified) navigate("/account");
  }, [linkToken, phase, user, navigate]);

  // Auto-verify from the emailed link once auth has loaded.
  useEffect(() => {
    if (!linkToken || isLoading || activeToken.current !== null) return;
    // Reopening a used link (e.g. a reload after success) would only get
    // "expired" back for a token already consumed; the account says it's done.
    if (user?.emailVerified) {
      activeToken.current = linkToken;
      setDisplayName(user.displayName ?? null);
      setPhase("success");
      return;
    }
    run(linkToken, initial.get("email") ?? "");
  }, [linkToken, isLoading, user, initial, run]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    run(token, email);
  };

  const retry = () => {
    const t = activeToken.current ?? token;
    forgetVerifyAttempt(t);
    run(t, email);
  };

  const submitResend = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter the email you used to register.");
      return;
    }
    try {
      const result = await resend.mutateAsync({ email: email.trim() });
      if (result.verifyToken) {
        setToken(result.verifyToken);
        toast({
          title: "New code ready",
          description: "A verification code was filled in below (development / self-host).",
        });
      } else {
        toast({ title: "Check your inbox", description: result.message });
      }
    } catch (err) {
      setError(authErrorMessage(err, "Could not resend verification."));
    }
  };

  if (phase === "success") {
    return (
      <FadeIn className="mx-auto w-full max-w-md space-y-6" data-testid="verify-success">
        <header className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleCheck className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Email verified</h1>
          <p className="text-muted-foreground">
            Welcome{displayName ? `, ${displayName}` : ""}. Your account is ready and you&apos;re signed in.
          </p>
        </header>
        <Button asChild className="min-h-11 w-full cursor-pointer" data-testid="verify-continue">
          <Link href="/account">
            Continue to your account
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </FadeIn>
    );
  }

  if (phase === "verifying" && token.trim() === linkToken) {
    return (
      <div className="py-10 text-center text-muted-foreground" role="status" data-testid="verify-pending">
        Verifying your email…
      </div>
    );
  }

  if (isLoading && phase === "idle") {
    return <div className="py-10 text-muted-foreground">Loading…</div>;
  }

  return (
    <FadeIn className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Verify your email</h1>
        <p className="text-muted-foreground">
          Open the link we sent, or paste the verification code here to finish creating your
          account.
        </p>
      </header>

      {phase === "retry" && (
        <Card className="border-destructive/40" data-testid="verify-network-error">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm" role="alert">{RETRY_MESSAGE}</p>
            <Button type="button" className="min-h-11 w-full cursor-pointer" onClick={retry} data-testid="verify-retry">
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "invalid" && (
        <Card className="border-destructive/40" data-testid="verify-invalid">
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">This link didn&apos;t work</p>
            <p className="text-sm text-muted-foreground" role="alert">{error}</p>
            <Button
              type="button"
              className="min-h-11 w-full cursor-pointer"
              disabled={resend.isPending}
              onClick={() => void submitResend()}
              data-testid="verify-invalid-resend"
            >
              {resend.isPending ? "Sending…" : "Resend verification email"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="verify-email">Email</Label>
              <Input
                id="verify-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11"
                data-testid="verify-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-token">Verification code</Label>
              <Input
                id="verify-token"
                autoComplete="one-time-code"
                required
                minLength={16}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="min-h-11 font-mono text-sm"
                data-testid="verify-token"
              />
            </div>
            {phase !== "invalid" && phase !== "retry" && <FieldError id="verify-error" message={error} />}
            <Button
              type="submit"
              className="min-h-11 w-full cursor-pointer"
              disabled={phase === "verifying"}
              data-testid="verify-submit"
            >
              {phase === "verifying" ? "Verifying…" : "Verify and continue"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          <div className="border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full cursor-pointer"
              disabled={resend.isPending}
              onClick={() => void submitResend()}
              data-testid="verify-resend"
            >
              {resend.isPending ? "Sending…" : "Resend verification email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already verified?{" "}
        <Link href="/account" className="underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </FadeIn>
  );
}
