import { BILLING_ENABLED } from "@/lib/publicConfig";
import { lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import {
  PRACTICE_DATA_QUERY_KEYS,
  subscribePracticeDataChanged,
} from "./lib/practiceDataSync";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PracticeProvider } from "@/context/PracticeContext";
import { KidsGateProvider } from "@/context/KidsGateContext";
import { RecentSearchesProvider } from "@/context/RecentSearchesContext";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectivityBanner } from "@/components/ConnectivityBanner";
import { LegalConsentBanner } from "@/components/LegalConsentBanner";
import { KEYS, readString, writeString } from "@/lib/localPrefs";
import { welcomeRedirectTarget } from "@/lib/welcomeGate";
import { Skeleton } from "@/components/ui/skeleton";
import { PageFade } from "@/components/motion";

/** Eager: first paint + marketing / registration entry. Everything else is route-split. */
const Home = lazy(() => import("@/pages/Home"));
const Landing = lazy(() => import("@/pages/Landing"));
const Register = lazy(() => import("@/pages/Register"));

const MARKETING_PATHS = new Set([
  "/welcome",
  "/register",
  "/start",
  "/verify",
  "/cancel",
  "/privacy",
  "/terms",
  "/health-disclaimer",
]);

function lazyPage<T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) {
  return lazy(loader);
}

const NotFound = lazyPage(() => import("@/pages/not-found"));
const Asanas = lazyPage(() => import("@/pages/Asanas"));
const AsanaDetail = lazyPage(() => import("@/pages/AsanaDetail"));
const Pathways = lazyPage(() => import("@/pages/Pathways"));
const PathwayDetail = lazyPage(() => import("@/pages/PathwayDetail"));
const Practice = lazyPage(() => import("@/pages/Practice"));
const GuidedSession = lazyPage(() => import("@/pages/GuidedSession"));
const Breathing = lazyPage(() => import("@/pages/Breathing"));
const Affirmations = lazyPage(() => import("@/pages/Affirmations"));
const Journal = lazyPage(() => import("@/pages/Journal"));
const Profiles = lazyPage(() => import("@/pages/Profiles"));
const Builder = lazyPage(() => import("@/pages/Builder"));
const Kids = lazyPage(() => import("@/pages/Kids"));
const KidsPose = lazyPage(() => import("@/pages/KidsPose"));
const KidsBreath = lazyPage(() => import("@/pages/KidsBreath"));
const Trainer = lazyPage(() => import("@/pages/Trainer"));
const Search = lazyPage(() => import("@/pages/Search"));
const DesignSystem = lazyPage(() => import("@/pages/DesignSystem"));
const Settings = lazyPage(() => import("@/pages/Settings"));
const Account = lazyPage(() => import("@/pages/Account"));
const VerifyEmail = lazyPage(() => import("@/pages/VerifyEmail"));
const Privacy = lazyPage(() => import("@/pages/Privacy"));
const Terms = lazyPage(() => import("@/pages/Terms"));
const HealthDisclaimer = lazyPage(() => import("@/pages/HealthDisclaimer"));
const Help = lazyPage(() => import("@/pages/Help"));
const Plus = lazyPage(() => import("@/pages/Plus"));
const Challenges = lazyPage(() => import("@/pages/Challenges"));
const AdaptivePlan = lazyPage(() => import("@/pages/AdaptivePlan"));
const PoseCoach = lazyPage(() => import("@/pages/PoseCoach"));
const InstructorSession = lazyPage(() => import("@/pages/InstructorSession"));
const Instructors = lazyPage(() => import("@/pages/Instructors"));
const Household = lazyPage(() => import("@/pages/Household"));
const Corporate = lazyPage(() => import("@/pages/Corporate"));
const StartQuiz = lazyPage(() => import("@/pages/StartQuiz"));
const FunnelDashboard = lazyPage(() => import("@/pages/FunnelDashboard"));
const Cancel = lazyPage(() => import("@/pages/Cancel"));
const CancelConfirm = lazyPage(() => import("@/pages/CancelConfirm"));

function RouteFallback() {
  return (
    <div className="space-y-4 py-6" role="status" aria-live="polite" aria-label="Loading page">
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-48 w-full" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function WelcomeRedirect() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (readString(KEYS.welcomeSeen)) return;
    // Existing users who already finished onboarding skip the marketing page.
    if (readString(KEYS.onboardingDone)) {
      writeString(KEYS.welcomeSeen, "1");
      return;
    }
    // Only the bare home page introduces the product; a deep link renders as asked.
    // `replace` so Back from /welcome does not land on `/` and redirect again.
    const target = welcomeRedirectTarget(location, window.location.search, {
      welcomeSeen: !!readString(KEYS.welcomeSeen),
      onboardingDone: !!readString(KEYS.onboardingDone),
    });
    if (target) navigate(target, { replace: true });
  }, [location, navigate]);
  return null;
}

function AppRouter() {
  const [location] = useLocation();
  return (
    <PageFade routeKey={location.split("?")[0] || "/"}>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route path="/register" component={Register} />
          <Route path="/welcome" component={Landing} />
          <Route path="/start" component={StartQuiz} />
          {import.meta.env.DEV && <Route path="/analytics/funnel" component={FunnelDashboard} />}
          <Route path="/" component={Home} />
          <Route path="/asanas" component={Asanas} />
          <Route path="/asanas/:slug" component={AsanaDetail} />
          <Route path="/pathways" component={Pathways} />
          <Route path="/pathways/:slug" component={PathwayDetail} />
          <Route path="/practice" component={Practice} />
          <Route path="/guided" component={GuidedSession} />
          <Route path="/trainer" component={Trainer} />
          <Route path="/breathing" component={Breathing} />
          <Route path="/affirmations" component={Affirmations} />
          <Route path="/journal" component={Journal} />
          <Route path="/profiles" component={Profiles} />
          <Route path="/builder" component={Builder} />
          <Route path="/kids" component={Kids} />
          <Route path="/kids/breath/:slug" component={KidsBreath} />
          <Route path="/kids/:slug" component={KidsPose} />
          <Route path="/search" component={Search} />
          <Route path="/settings" component={Settings} />
          <Route path="/account" component={Account} />
          <Route path="/verify" component={VerifyEmail} />
          <Route path="/privacy" component={Privacy} />
          <Route path="/terms" component={Terms} />
          <Route path="/health-disclaimer" component={HealthDisclaimer} />
          <Route path="/help" component={Help} />
          <Route path="/plus" component={Plus} />
          {BILLING_ENABLED && <Route path="/cancel/confirm" component={CancelConfirm} />}
          {BILLING_ENABLED && <Route path="/cancel" component={Cancel} />}
          <Route path="/challenges" component={Challenges} />
          <Route path="/adaptive" component={AdaptivePlan} />
          <Route path="/pose-coach" component={PoseCoach} />
          <Route path="/instructor" component={InstructorSession} />
          <Route path="/instructors" component={Instructors} />
          <Route path="/teachers" component={Instructors} />
          <Route path="/household" component={Household} />
          <Route path="/corporate" component={Corporate} />
          {import.meta.env.DEV && <Route path="/design-system" component={DesignSystem} />}
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </PageFade>
  );
}

function AppShell() {
  const [location] = useLocation();
  useEffect(() => {
    return subscribePracticeDataChanged(() => {
      for (const key of PRACTICE_DATA_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [...key] });
      }
    });
  }, []);

  return (
    <>
      <WelcomeRedirect />

      <AppLayout>
        {/* Key by route so a page crash does not trap every subsequent nav click. */}
        <ErrorBoundary key={location.split("?")[0] || "/"}>
          <AppRouter />
        </ErrorBoundary>
      </AppLayout>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <PracticeProvider>
            <KidsGateProvider>
              <RecentSearchesProvider>
                <Toaster />
                <ConnectivityBanner />
                <LegalConsentBanner />
                <Router>
                  <AppShell />
                </Router>
              </RecentSearchesProvider>
            </KidsGateProvider>
          </PracticeProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
