import { createRoot } from "react-dom/client";
import { Router, useLocation } from "wouter";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LegalConsentBanner } from "@/components/LegalConsentBanner";
import Landing from "@/pages/Landing";
import "./index.css";

function WelcomeEntry() {
  const [path] = useLocation();
  if (typeof window !== "undefined" && path !== "/" && path !== "/welcome") {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `sadhana_welcome_seen=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    window.location.replace(`${path}${window.location.search}`);
  }
  return <ThemeProvider><LegalConsentBanner /><Landing /></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary><Router><WelcomeEntry /></Router></ErrorBoundary>,
);
