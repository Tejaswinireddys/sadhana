import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { accountAuthTab, readUrlParam } from "@/lib/hashQuery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useToast } from "@/hooks/use-toast";
import {
  authErrorMessage,
  useAuth,
  useClaimDevice,
  useDeleteAccount,
  useForgotPassword,
  useResetPassword,
  useSignIn,
  useSignOut,
  useSignUp,
} from "@/lib/auth";
import { writeLegalAck } from "@/lib/legal";
import { formatDate } from "@/lib/sadhana";
import { credentialsSchema } from "@shared/schema";
import { ArrowRight, LogOut, MailCheck, Merge, ShieldCheck, Trash2, UserRound } from "lucide-react";

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

function validateSignup(input: {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  legalOk: boolean;
}): string | null {
  if (!input.legalOk) {
    return "Please acknowledge the Privacy Policy and Terms to create an account.";
  }
  if (input.password !== input.confirmPassword) {
    return "Passwords do not match.";
  }
  const parsed = credentialsSchema.safeParse({
    email: input.email,
    password: input.password,
    displayName: input.displayName.trim() || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check your details and try again.";
  }
  return null;
}

/**
 * Shown once, right after the code is issued.
 *
 * On a deployment with no mail transport this is the only credential that can
 * recover the account, so it is deliberately loud and cannot be re-displayed.
 */
function RecoveryCodePanel({
  code,
  copied,
  onCopy,
  onDismiss,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="border-primary bg-primary/5" data-testid="recovery-code-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> Save your recovery code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This server cannot send email, so there is no reset link. This code is the only way to
          set a new password if you forget it. Write it down or put it in a password manager — it
          is shown once and never again.
        </p>
        <p
          className="select-all rounded-lg border border-primary/40 bg-background px-3 py-3 text-center font-mono text-lg tracking-widest"
          data-testid="recovery-code-value"
        >
          {code}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 cursor-pointer"
            onClick={onCopy}
            data-testid="recovery-code-copy"
          >
            {copied ? "Copied" : "Copy code"}
          </Button>
          <Button
            type="button"
            className="min-h-11 cursor-pointer"
            onClick={onDismiss}
            data-testid="recovery-code-done"
          >
            I&apos;ve saved it
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lost it? See{" "}
          <Link href="/help" className="underline underline-offset-2">
            Help
          </Link>{" "}
          for what can and cannot be recovered.
        </p>
      </CardContent>
    </Card>
  );
}

export default function Account() {
  useDocumentTitle("Account · Sadhana");
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { user, deviceRows, isLoading } = useAuth();

  const signIn = useSignIn();
  const signUp = useSignUp();
  const signOut = useSignOut();
  const claimDevice = useClaimDevice();
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const deleteAccount = useDeleteAccount();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  /**
   * Shown once, never stored. On a deployment with no mail transport this is
   * the only credential that can recover the account.
   */
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [forgotHint, setForgotHint] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  // Always start unchecked: creating an account is a separate legal moment
  // from any earlier site-wide banner dismissal, and "I have read" should
  // reflect an explicit tick made right here, not be inherited from a
  // different, less specific acknowledgment made elsewhere.
  const [legalOk, setLegalOk] = useState(false);
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState(() => accountAuthTab(readUrlParam("tab")));
  const { data: mailStatus } = useQuery<{ emailEnabled: boolean }>({
    queryKey: ["/api/auth/mail-status"],
  });
  const emailEnabled = mailStatus?.emailEnabled === true;

  const busy = signIn.isPending || signUp.isPending || reset.isPending;

  const submitSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { user: signedIn, deviceRows: pending } = await signIn.mutateAsync({ email, password });
      setPassword("");
      toast({
        title: `Welcome back, ${signedIn.displayName || signedIn.email}`,
        description: pending
          ? "This device still has guest practice you can merge below."
          : "Your practice is synced to this account.",
      });
    } catch (err) {
      const message = authErrorMessage(err, "Could not sign in. Try again.");
      setError(message);
      if (message.toLowerCase().includes("verify your email")) {
        setPendingVerifyEmail(email.trim().toLowerCase());
      }
    }
  };

  const submitSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const validationError = validateSignup({
      email,
      password,
      confirmPassword,
      displayName,
      legalOk,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      writeLegalAck();
      const result = await signUp.mutateAsync({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });
      setPassword("");
      setConfirmPassword("");
      if ("needsVerification" in result && result.needsVerification) {
        setPendingVerifyEmail(result.email);
        const q = new URLSearchParams({ email: result.email });
        if ("verifyToken" in result && result.verifyToken) q.set("token", result.verifyToken);
        toast({
          title: "Check your inbox",
          description: result.message,
        });
        navigate(`/verify?${q.toString()}`);
        return;
      }
      // This server cannot send mail, so the recovery code is the only way
      // back into the account. Show it instead of navigating away.
      if ("recoveryCode" in result && result.recoveryCode) {
        setRecoveryCode(result.recoveryCode);
        toast({
          title: "Save your recovery code",
          description: "It is shown once. Without it a forgotten password cannot be reset.",
        });
        return;
      }
      toast({
        title: "Account created",
        description: "You can now sign in from any device.",
      });
    } catch (err) {
      setError(authErrorMessage(err, "Could not create the account. Try again."));
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotHint(null);
    try {
      const result = await forgot.mutateAsync({ email });
      setForgotHint(result.message);
      if (result.resetToken) {
        setResetToken(result.resetToken);
        setForgotHint(
          `${result.message} A reset code was filled in below (development / self-host).`,
        );
      }
      toast({ title: "Check for a reset code", description: result.message });
    } catch (err) {
      setError(authErrorMessage(err, "Could not start password reset."));
    }
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const { user: signedIn, recoveryCode: nextCode } = await reset.mutateAsync({
        email,
        token: resetToken.trim(),
        password: resetPassword,
      });
      setPassword("");
      setResetPassword("");
      setResetToken("");
      // Using a recovery code consumes it; the replacement is shown once.
      if (nextCode) setRecoveryCode(nextCode);
      toast({
        title: "Password updated",
        description: nextCode
          ? "Signed in. Save the new recovery code below — the old one is now used up."
          : `Signed in as ${signedIn.displayName || signedIn.email}.`,
      });
    } catch (err) {
      setError(authErrorMessage(err, "Could not reset password."));
    }
  };

  if (isLoading) {
    return <div className="py-10 text-muted-foreground">Loading your account…</div>;
  }

  if (user) {
    return (
      <FadeIn className="space-y-6">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Your account</h1>
          <p className="max-w-xl text-muted-foreground">
            Practice saved here follows you to any browser you sign in from.
          </p>
        </header>

      {recoveryCode ? <RecoveryCodePanel
        code={recoveryCode}
        copied={recoveryCopied}
        onCopy={() => {
          void navigator.clipboard
            ?.writeText(recoveryCode)
            .then(() => setRecoveryCopied(true))
            .catch(() => setRecoveryCopied(false));
        }}
        onDismiss={() => {
          setRecoveryCode(null);
          setRecoveryCopied(false);
        }}
      /> : null}

        <Card data-testid="account-signed-in">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-medium" data-testid="account-email">
                  {user.displayName ? `${user.displayName} · ${user.email}` : user.email}
                </p>
                <p className="text-sm text-muted-foreground">
                  Member since {formatDate(user.createdAt.slice(0, 10))}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11 cursor-pointer"
                onClick={() => {
                  void signOut.mutateAsync().then(() =>
                    toast({
                      title: "Signed out",
                      description: "This browser is back to guest practice.",
                    }),
                  );
                }}
                disabled={signOut.isPending}
                data-testid="account-sign-out"
              >
                <LogOut className="mr-1.5 h-4 w-4" /> Sign out
              </Button>
              <Button variant="ghost" className="min-h-11 cursor-pointer" asChild>
                <Link href="/settings">Backup, reminders & data</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {deviceRows > 0 && (
          <Card className="border-primary/30 bg-accent/30" data-testid="account-merge">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-xl">
                <Merge className="h-5 w-5 text-primary" aria-hidden /> Guest practice on this device
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {deviceRows} {deviceRows === 1 ? "record" : "records"} were saved here before you
                signed in — sessions, journal entries, favourites. Move them into your account?
              </p>
              <Button
                className="min-h-11 cursor-pointer"
                onClick={() => {
                  void claimDevice.mutateAsync().then(({ claimed }) =>
                    toast({
                      title: "Merged",
                      description: `${claimed} ${claimed === 1 ? "record" : "records"} moved into your account.`,
                    }),
                  );
                }}
                disabled={claimDevice.isPending}
                data-testid="account-merge-confirm"
              >
                {claimDevice.isPending ? "Merging…" : "Merge into my account"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-destructive/30" data-testid="account-delete">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-serif text-xl text-destructive">
              <Trash2 className="h-5 w-5" aria-hidden /> Delete account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently deletes your account, sessions, journal, and synced practice. Export a
              backup from Settings first if you might want it later.
            </p>
            <div className="space-y-2">
              <Label htmlFor="delete-password">Confirm with your password</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="min-h-11"
                data-testid="delete-password"
              />
            </div>
            <Button
              variant="destructive"
              className="min-h-11 cursor-pointer"
              disabled={deleteAccount.isPending || deletePassword.length < 1}
              onClick={() => {
                void deleteAccount
                  .mutateAsync({ password: deletePassword })
                  .then(() => {
                    setDeletePassword("");
                    toast({
                      title: "Account deleted",
                      description: "Your account and synced practice were removed.",
                    });
                  })
                  .catch((err) => {
                    toast({
                      title: "Could not delete account",
                      description: authErrorMessage(err, "Try again."),
                      variant: "destructive",
                    });
                  });
              }}
              data-testid="account-delete-confirm"
            >
              {deleteAccount.isPending ? "Deleting…" : "Delete my account"}
            </Button>
          </CardContent>
        </Card>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="mx-auto w-full max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Sign in to Sadhana</h1>
        <p className="text-muted-foreground">
          An account is optional. It keeps your streaks, journal, and saved sequences when you
          switch browsers or clear this one.
        </p>
      </header>

      {recoveryCode ? (
        <RecoveryCodePanel
          code={recoveryCode}
          copied={recoveryCopied}
          onCopy={() => {
            void navigator.clipboard
              ?.writeText(recoveryCode)
              .then(() => setRecoveryCopied(true))
              .catch(() => setRecoveryCopied(false));
          }}
          onDismiss={() => {
            setRecoveryCode(null);
            setRecoveryCopied(false);
          }}
        />
      ) : null}

      {pendingVerifyEmail ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">Verify {pendingVerifyEmail}</p>
                <p className="text-muted-foreground">
                  We sent a link to finish registration. Open it, or enter the code on the verify
                  page.
                </p>
              </div>
            </div>
            <Button asChild className="min-h-11 cursor-pointer shrink-0">
              <Link href={`/verify?email=${encodeURIComponent(pendingVerifyEmail)}`}>
                Open verify page
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-5">
          <Tabs
            value={authTab}
            onValueChange={(value) => {
              setAuthTab(accountAuthTab(value));
              setError(null);
            }}
          >
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="signin" className="min-h-11 cursor-pointer" data-testid="tab-signin">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="min-h-11 cursor-pointer" data-testid="tab-signup">
                Create
              </TabsTrigger>
              <TabsTrigger value="reset" className="min-h-11 cursor-pointer" data-testid="tab-reset">
                Reset
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="space-y-4" onSubmit={submitSignIn}>
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-11"
                    data-testid="signin-email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      aria-pressed={showPassword}
                      aria-controls="signin-password"
                      data-testid="signin-toggle-password"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-11"
                    aria-describedby={error ? "auth-error" : undefined}
                    data-testid="signin-password"
                  />
                </div>
                <FieldError id="auth-error" message={error} />
                <Button
                  type="submit"
                  className="min-h-11 w-full cursor-pointer"
                  disabled={busy}
                  data-testid="signin-submit"
                >
                  {signIn.isPending ? "Signing in…" : "Sign in"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-4" onSubmit={submitSignUp}>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Your name (optional)</Label>
                  <Input
                    id="signup-name"
                    autoComplete="name"
                    maxLength={48}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should we greet you?"
                    className="min-h-11"
                    data-testid="signup-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="min-h-11"
                    data-testid="signup-email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      aria-pressed={showPassword}
                      aria-controls="signup-password"
                      data-testid="signup-toggle-password"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="min-h-11"
                    aria-describedby={error ? "auth-error" : "signup-password-hint"}
                    data-testid="signup-password"
                  />
                  <p id="signup-password-hint" className="text-xs text-muted-foreground">
                    At least 8 characters, with a letter and a number.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <Input
                    id="signup-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="min-h-11"
                    data-testid="signup-confirm"
                  />
                </div>
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                        className="mt-0.5 h-6 w-6 min-h-6 min-w-6"
                    checked={legalOk}
                    onChange={(e) => setLegalOk(e.target.checked)}
                    data-testid="signup-legal-ack"
                  />
                  <span>
                    I have read the{" "}
                    <Link href="/privacy" className="underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    ,{" "}
                    <Link href="/terms" className="underline underline-offset-2">
                      Terms
                    </Link>
                    , and{" "}
                    <Link href="/health-disclaimer" className="underline underline-offset-2">
                      Health disclaimer
                    </Link>
                    .
                  </span>
                </label>
                <FieldError id="auth-error" message={error} />
                <Button
                  type="submit"
                  className="min-h-11 w-full cursor-pointer"
                  disabled={busy}
                  aria-busy={signUp.isPending}
                  data-testid="signup-submit"
                >
                  {signUp.isPending ? "Creating account (up to ~25s)…" : "Create account"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="reset">
              <div className="space-y-6">
                {/*
                  When email delivery is off, the recovery-code form is the
                  primary path — a disabled email CTA must not be the main story. When email is on (or still loading),
                  keep request-code first, then complete the password change.
                */}
                {mailStatus != null && !emailEnabled ? (
                  <>
                    <div
                      className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                      data-testid="reset-delivery-copy"
                    >
                      {/*
                        Lead with the path that works. The previous wording
                        opened on "email delivery is not configured", which read
                        as a dead end even though a working recovery form sits
                        directly beneath it.
                      */}
                      <strong className="font-medium text-foreground">
                        Reset your password with the recovery code
                      </strong>{" "}
                      you saved when you created the account — it is below, and it
                      works right now. This server cannot send email, so there is
                      no code to wait for in your inbox.{" "}
                      <Link
                        className="underline underline-offset-2"
                        href="/help"
                        data-testid="reset-help-link"
                      >
                        See how to get back in
                      </Link>
                      {import.meta.env.DEV
                        ? " In development you can still request a logged code below."
                        : ""}
                    </div>

                    <form className="space-y-4" onSubmit={submitReset}>
                      <div className="space-y-2">
                        <Label htmlFor="reset-email-recovery">Email</Label>
                        <Input
                          id="reset-email-recovery"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="min-h-11"
                          data-testid="forgot-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reset-token">Recovery code</Label>
                        <Input
                          id="reset-token"
                          required
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          className="min-h-11 font-mono text-sm"
                          placeholder="ABCDE-FGHJK-MNPQR-STVWX"
                          autoCapitalize="characters"
                          spellCheck={false}
                          data-testid="reset-token"
                        />
                        <p className="text-xs text-muted-foreground" data-testid="reset-token-hint">
                          Enter the recovery code you saved when you created the
                          account. Dashes and letter case do not matter.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reset-password">New password</Label>
                        <Input
                          id="reset-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          minLength={8}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          className="min-h-11"
                          data-testid="reset-password"
                        />
                      </div>
                      <FieldError id="auth-error" message={error} />
                      <Button
                        type="submit"
                        className="min-h-11 w-full cursor-pointer"
                        disabled={busy}
                        data-testid="reset-submit"
                      >
                        {reset.isPending ? "Updating…" : "Set new password"}
                      </Button>
                    </form>

                    {import.meta.env.DEV ? (
                      <form
                        className="space-y-4 border-t border-border pt-4"
                        onSubmit={submitForgot}
                      >
                        <p className="text-xs text-muted-foreground">
                          Development only: request a logged reset code when the
                          mail transport is off.
                        </p>
                        <Button
                          type="submit"
                          variant="outline"
                          className="min-h-11 w-full cursor-pointer"
                          disabled={forgot.isPending}
                          data-testid="forgot-submit"
                        >
                          {forgot.isPending ? "Sending…" : "Request a reset code"}
                        </Button>
                        {forgotHint && (
                          <p
                            className="text-sm text-muted-foreground"
                            role="status"
                            data-testid="forgot-hint"
                          >
                            {forgotHint}
                          </p>
                        )}
                      </form>
                    ) : null}
                  </>
                ) : (
                  <>
                    <form className="space-y-4" onSubmit={submitForgot}>
                      <p className="text-sm text-muted-foreground" data-testid="reset-delivery-copy">
                        We&apos;ll email a one-time reset code if this address has an
                        account. It expires in 60 minutes — check spam if it
                        doesn&apos;t arrive. If you still can&apos;t get in,{" "}
                        <Link
                          className="underline underline-offset-2"
                          href="/help"
                          data-testid="reset-help-link"
                        >
                          see how to get back in
                        </Link>{" "}
                        or email{" "}
                        <a
                          className="underline underline-offset-2"
                          href="mailto:privacy@sadhana.app"
                        >
                          privacy@sadhana.app
                        </a>
                        .
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="min-h-11"
                          data-testid="forgot-email"
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="outline"
                        className="min-h-11 w-full cursor-pointer"
                        disabled={forgot.isPending}
                        data-testid="forgot-submit"
                      >
                        {forgot.isPending ? "Sending…" : "Email me a reset code"}
                      </Button>
                      {forgotHint && (
                        <p
                          className="text-sm text-muted-foreground"
                          role="status"
                          data-testid="forgot-hint"
                        >
                          {forgotHint}
                        </p>
                      )}
                    </form>

                    <form className="space-y-4 border-t border-border pt-4" onSubmit={submitReset}>
                      <div className="space-y-2">
                        <Label htmlFor="reset-token">Reset code or recovery code</Label>
                        <Input
                          id="reset-token"
                          required
                          value={resetToken}
                          onChange={(e) => setResetToken(e.target.value)}
                          className="min-h-11 font-mono text-sm"
                          autoCapitalize="characters"
                          spellCheck={false}
                          data-testid="reset-token"
                        />
                        <p className="text-xs text-muted-foreground" data-testid="reset-token-hint">
                          Paste the code from your email, or the recovery code you
                          saved when you created the account.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reset-password">New password</Label>
                        <Input
                          id="reset-password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          minLength={8}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          className="min-h-11"
                          data-testid="reset-password"
                        />
                      </div>
                      <FieldError id="auth-error" message={error} />
                      <Button
                        type="submit"
                        className="min-h-11 w-full cursor-pointer"
                        disabled={busy}
                        data-testid="reset-submit"
                      >
                        {reset.isPending ? "Updating…" : "Set new password"}
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="surface-inset">
        <CardContent className="flex items-start gap-3 p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Practising as a guest is still fine</p>
            <p>
              Without an account your practice stays on this device. Creating one moves that history
              across automatically — nothing is lost.
            </p>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
