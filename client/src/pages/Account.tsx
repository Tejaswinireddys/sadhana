import { useState, type FormEvent } from "react";
import { Link } from "wouter";
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
import { hasCurrentLegalAck, writeLegalAck } from "@/lib/legal";
import { formatDate } from "@/lib/sadhana";
import { ArrowRight, LogOut, Merge, ShieldCheck, Trash2, UserRound } from "lucide-react";

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive" role="alert">
      {message}
    </p>
  );
}

export default function Account() {
  useDocumentTitle("Account · Sadhana");
  const { toast } = useToast();
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
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [forgotHint, setForgotHint] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [legalOk, setLegalOk] = useState(hasCurrentLegalAck());

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
      setError(authErrorMessage(err, "Could not sign in. Try again."));
    }
  };

  const submitSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!legalOk) {
      setError("Please acknowledge the Privacy Policy and Terms to create an account.");
      return;
    }
    try {
      writeLegalAck();
      const { claimed } = await signUp.mutateAsync({
        email,
        password,
        displayName: displayName.trim() || undefined,
      });
      setPassword("");
      toast({
        title: "Account created",
        description: claimed
          ? "Your practice on this device moved into the account."
          : "You can now sign in from any device.",
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
      const { user: signedIn } = await reset.mutateAsync({
        email,
        token: resetToken.trim(),
        password: resetPassword,
      });
      setPassword("");
      setResetPassword("");
      setResetToken("");
      toast({
        title: "Password updated",
        description: `Signed in as ${signedIn.displayName || signedIn.email}.`,
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

      <Card>
        <CardContent className="p-5">
          <Tabs defaultValue="signin" onValueChange={() => setError(null)}>
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
                    At least 8 characters.
                  </p>
                </div>
                <label className="flex items-start gap-3 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
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
                <form className="space-y-4" onSubmit={submitForgot}>
                  <p className="text-sm text-muted-foreground">
                    Request a one-time reset code for your email. On this open-source build the code
                    appears in server logs (and below in development).
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
                    <p className="text-sm text-muted-foreground" role="status" data-testid="forgot-hint">
                      {forgotHint}
                    </p>
                  )}
                </form>

                <form className="space-y-4 border-t border-border pt-4" onSubmit={submitReset}>
                  <div className="space-y-2">
                    <Label htmlFor="reset-token">Reset code</Label>
                    <Input
                      id="reset-token"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="min-h-11 font-mono text-sm"
                      data-testid="reset-token"
                    />
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
