import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PracticeProvider } from "@/context/PracticeContext";
import { KidsGateProvider } from "@/context/KidsGateContext";
import { AppLayout } from "@/components/AppLayout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Asanas from "@/pages/Asanas";
import AsanaDetail from "@/pages/AsanaDetail";
import Pathways from "@/pages/Pathways";
import PathwayDetail from "@/pages/PathwayDetail";
import Practice from "@/pages/Practice";
import Breathing from "@/pages/Breathing";
import Affirmations from "@/pages/Affirmations";
import Journal from "@/pages/Journal";
import Profiles from "@/pages/Profiles";
import Kids from "@/pages/Kids";
import KidsPose from "@/pages/KidsPose";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/asanas" component={Asanas} />
      <Route path="/asanas/:slug" component={AsanaDetail} />
      <Route path="/pathways" component={Pathways} />
      <Route path="/pathways/:slug" component={PathwayDetail} />
      <Route path="/practice" component={Practice} />
      <Route path="/breathing" component={Breathing} />
      <Route path="/affirmations" component={Affirmations} />
      <Route path="/journal" component={Journal} />
      <Route path="/profiles" component={Profiles} />
      <Route path="/kids" component={Kids} />
      <Route path="/kids/:slug" component={KidsPose} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <PracticeProvider>
            <KidsGateProvider>
              <Toaster />
              <Router hook={useHashLocation}>
                <AppLayout>
                  <AppRouter />
                </AppLayout>
              </Router>
            </KidsGateProvider>
          </PracticeProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
