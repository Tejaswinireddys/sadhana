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
  useSignIn,
  useSignOut,
  useSignUp,
} from "@/lib/auth";
import { formatDate } from "@/lib/sadhana";
import { ArrowRight, LogOut, Merge, ShieldCheck, UserRound } from "lucide-react";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const busy = signIn.isPending || signUp.isPending;

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
    try {
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
      </FadeIn>
    );
  }

  return (
    // A 400px card pinned to the left of a 1050px viewport leaves ~650px of
    // dead space and reads as a layout bug. A single-purpose form centres.
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
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="signin" className="min-h-11 cursor-pointer" data-testid="tab-signin">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="min-h-11 cursor-pointer" data-testid="tab-signup">
                Create account
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
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      data-testid="signin-toggle-password"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    // A reveal toggle is the single highest-value thing you can
                    // add to a sign-in form: most failures are typos.
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
                {/* No reset flow exists yet. Saying so is better than an empty
                    space where every user expects a link — and the export
                    route is the honest recovery path we actually have. */}
                <p className="text-center text-xs text-muted-foreground">
                  Forgotten your password? Password reset isn't available yet — email{" "}
                  <a
                    className="underline underline-offset-2"
                    href="mailto:hello@sadhana.app?subject=Password%20reset"
                    data-testid="signin-forgot-password"
                  >
                    hello@sadhana.app
                  </a>{" "}
                  and we'll sort it out.
                </p>
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
                  <Label htmlFor="signup-password">Password</Label>
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
                <FieldError id="auth-error" message={error} />
                <Button
                  type="submit"
                  className="min-h-11 w-full cursor-pointer"
                  disabled={busy}
                  data-testid="signup-submit"
                >
                  {signUp.isPending ? "Creating…" : "Create account"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </form>
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
