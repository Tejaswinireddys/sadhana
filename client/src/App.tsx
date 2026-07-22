import { useState } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
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
import { Onboarding } from "@/components/Onboarding";
import { KEYS, readString } from "@/lib/localPrefs";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Asanas from "@/pages/Asanas";
import AsanaDetail from "@/pages/AsanaDetail";
import Pathways from "@/pages/Pathways";
import PathwayDetail from "@/pages/PathwayDetail";
import Practice from "@/pages/Practice";
import GuidedSession from "@/pages/GuidedSession";
import Breathing from "@/pages/Breathing";
import Affirmations from "@/pages/Affirmations";
import Journal from "@/pages/Journal";
import Profiles from "@/pages/Profiles";
import Builder from "@/pages/Builder";
import Kids from "@/pages/Kids";
import KidsPose from "@/pages/KidsPose";
import KidsBreath from "@/pages/KidsBreath";
import Trainer from "@/pages/Trainer";
import Search from "@/pages/Search";
import Settings from "@/pages/Settings";

function AppRouter() {
  return (
    <Switch>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showOnboarding, setShowOnboarding] = useState(() => !readString(KEYS.onboardingDone));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <PracticeProvider>
            <KidsGateProvider>
              <RecentSearchesProvider>
                <Toaster />
                <ConnectivityBanner />
                <Onboarding open={showOnboarding} onDone={() => setShowOnboarding(false)} />
                <Router hook={useHashLocation}>
                  <AppLayout>
                    <ErrorBoundary>
                      <AppRouter />
                    </ErrorBoundary>
                  </AppLayout>
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
