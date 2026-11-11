import { lazy, Suspense, useEffect, useState } from "react";
import { Router, useLocation } from "wouter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { KEYS, readString } from "@/lib/localPrefs";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "@/pages/Landing";
import { homeEntry } from "@/lib/welcomeGate";
import { markWelcomeSeen, probeSignedIn } from "@/lib/welcomeSeen";
const Workspace = lazy(() => import("./App"));
const loading = (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[100svh] flex-col items-center justify-center gap-3 text-primary"
    data-testid="app-entry-loading"
  >
    <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden />
    <p className="text-sm">Loading…</p>
  </div>
);

/** `/` is the welcome page for brand-new guests only; account holders get Today. */
function Entry() {
  const [path] = useLocation();
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  const entry = homeEntry(path, {
    welcomeSeen: !!readString(KEYS.welcomeSeen),
    onboardingDone: !!readString(KEYS.onboardingDone),
    signedIn,
  });
  useEffect(() => {
    if (entry !== "checking") return;
    let live = true;
    void probeSignedIn().then((result) => {
      if (!live) return;
      if (result) markWelcomeSeen();
      setSignedIn(result);
    });
    return () => { live = false; };
  }, [entry]);
  if (entry === "checking") return loading;
  if (entry === "landing") return <ThemeProvider><Landing /></ThemeProvider>;
  return <Suspense fallback={loading}><Workspace /></Suspense>;
}
export default function LaunchApp() {
  return <Router><ErrorBoundary><Entry /></ErrorBoundary></Router>;
}
