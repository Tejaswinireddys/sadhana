/**
 * FullScreenOverlay — a screen that genuinely covers the app.
 *
 * `position: fixed; inset: 0` only covers the app *visually*. The sidebar
 * underneath stays laid out, visible to assistive tech, and in the tab order —
 * so a keyboard or screen-reader user part-way through a guided session tabs
 * straight into navigation links they cannot see. That's a WCAG 2.4.3 failure
 * and, mid-practice, a genuinely disorienting one.
 *
 * Two things fix it, and both are needed:
 *   1. Portal the overlay to <body>, so it is not a descendant of the shell.
 *   2. Mark the shell `inert` while it's open — removes it from the tab order,
 *      the accessibility tree, and pointer events in one attribute.
 *
 * `inert` is supported everywhere we target; `aria-hidden` is set alongside it
 * for older assistive tech that hasn't caught up.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";

/** The element wrapping all app chrome. See AppLayout. */
export const APP_SHELL_ID = "app-shell";

/** Marks the app shell inert for as long as `active` is true. */
export function useShellInert(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;
    const shell = document.getElementById(APP_SHELL_ID);
    if (!shell) return;

    // Nested overlays: only the outermost one restores the shell.
    const depth = Number(shell.dataset.inertDepth ?? "0") + 1;
    shell.dataset.inertDepth = String(depth);
    shell.setAttribute("inert", "");
    shell.setAttribute("aria-hidden", "true");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      const next = Number(shell.dataset.inertDepth ?? "1") - 1;
      shell.dataset.inertDepth = String(Math.max(0, next));
      if (next <= 0) {
        shell.removeAttribute("inert");
        shell.removeAttribute("aria-hidden");
        delete shell.dataset.inertDepth;
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [active]);
}

export function FullScreenOverlay({
  children,
  label,
}: {
  children: React.ReactNode;
  /** Accessible name for the overlay region. */
  label: string;
}) {
  useShellInert(true);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>,
    document.body,
  );
}
