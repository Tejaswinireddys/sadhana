import { useEffect, useState, type FormEvent } from "react";
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
  useVerifyEmail,
} from "@/lib/auth";
import { ArrowRight, MailCheck } from "lucide-react";

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function readQuery() {
  return new URLSearchParams(window.location.search);
}

export default function VerifyEmail() {
  useDocumentTitle("Verify email · Sadhana");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const verify = useVerifyEmail();
  const resend = useResendVerification();

  const initial = readQuery();
  const [email, setEmail] = useState(initial.get("email") ?? "");
  const [token, setToken] = useState(initial.get("token") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [autoTried, setAutoTried] = useState(false);

  useEffect(() => {
    if (user) navigate("/account");
  }, [user, navigate]);

  useEffect(() => {
    const params = readQuery();
    const qToken = params.get("token");
    const qEmail = params.get("email");
    if (!qToken || autoTried || verify.isPending || user) return;
    setAutoTried(true);
    void verify
      .mutateAsync({ token: qToken, email: qEmail || undefined })
      .then(({ user: signedIn }) => {
        toast({
          title: "Email verified",
          description: `Welcome${signedIn.displayName ? `, ${signedIn.displayName}` : ""}. Your account is ready.`,
        });
        navigate("/account");
      })
      .catch((err) => {
        setError(authErrorMessage(err, "Could not verify that link. Paste the code below."));
      });
  }, [autoTried, verify, user, toast, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { user: signedIn } = await verify.mutateAsync({
        token: token.trim(),
        email: email.trim() || undefined,
      });
      toast({
        title: "Email verified",
        description: `Welcome${signedIn.displayName ? `, ${signedIn.displayName}` : ""}. Your account is ready.`,
      });
      navigate("/account");
    } catch (err) {
      setError(authErrorMessage(err, "Could not verify. Check the code and try again."));
    }
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

  if (isLoading) {
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
            <FieldError id="verify-error" message={error} />
            <Button
              type="submit"
              className="min-h-11 w-full cursor-pointer"
              disabled={verify.isPending}
              data-testid="verify-submit"
            >
              {verify.isPending ? "Verifying…" : "Verify and continue"}
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
