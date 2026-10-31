import { lazy, Suspense } from "react";
import { Router, useLocation } from "wouter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { KEYS, readString } from "@/lib/localPrefs";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "@/pages/Landing";
const Workspace = lazy(() => import("./App"));
function Entry() {
  const [path] = useLocation();
  const newHome = path === "/" && !readString(KEYS.welcomeSeen) && !readString(KEYS.onboardingDone);
  if (path === "/welcome" || newHome) return <ThemeProvider><Landing /></ThemeProvider>;
  return <Suspense fallback={<p role="status" className="p-6">Loading your practice…</p>}><Workspace /></Suspense>;
}
export default function LaunchApp() {
  return <Router><ErrorBoundary><Entry /></ErrorBoundary></Router>;
}
