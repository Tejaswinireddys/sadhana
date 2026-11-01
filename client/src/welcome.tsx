import { useEffect } from "react";
import { KEYS, readString } from "@/lib/localPrefs";
import { welcomeEntryTarget } from "@/lib/welcomeGate";
import { createRoot } from "react-dom/client";
import { Router, useLocation } from "wouter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LegalConsentBanner } from "@/components/LegalConsentBanner";
import Landing from "@/pages/Landing";
import "./index.css";

function WelcomeEntry() {
  const [path] = useLocation();
  const target = welcomeEntryTarget({ pathname: path, search: window.location.search, hash: window.location.hash }, {
    welcomeSeen: !!readString(KEYS.welcomeSeen),
    onboardingDone: !!readString(KEYS.onboardingDone),
  });
  useEffect(() => {
    if (target === null) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `sadhana_welcome_seen=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.replace(target);
  }, [target]);
  if (target !== null) return <p role="status">Opening your practice…</p>;
  return <ThemeProvider><LegalConsentBanner /><Landing /></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary><Router><WelcomeEntry /></Router></ErrorBoundary>,
);
