import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { readString, writeString, KEYS } from "@/lib/localPrefs";

/**
 * "system" tracks the OS setting live; "light"/"dark" are explicit overrides.
 * The choice is persisted — a theme that resets on every reload is not a theme.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const ThemeContext = createContext<{
  /** The theme actually on screen right now. */
  theme: ResolvedTheme;
  /** What the user chose, which may be "system". */
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
}>({
  theme: "light",
  preference: "system",
  setPreference: () => {},
  toggle: () => {},
});

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readPreference(): ThemePreference {
  const saved = readString(KEYS.theme);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

/** Kept in sync with the pre-paint script in index.html. */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemValue, setSystemValue] = useState<ResolvedTheme>(systemTheme);

  const theme: ResolvedTheme = preference === "system" ? systemValue : preference;

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemValue(mq.matches ? "dark" : "light");
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    writeString(KEYS.theme, p);
  }, []);

  // Toggling from "system" commits to the opposite of what's on screen, which
  // is what someone pressing the button actually means.
  const toggle = useCallback(() => {
    setPreference(theme === "dark" ? "light" : "dark");
  }, [theme, setPreference]);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
