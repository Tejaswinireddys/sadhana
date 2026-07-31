// ParentGate — a simple math-question modal shown when a kid (or anyone) first
// enters the Kids section in a session. Prevents young children from navigating
// to adult content. On a correct answer, sets a transient session flag via the
// KidsGate context (NOT localStorage), so it re-appears next session.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useKidsGate } from "@/context/KidsGateContext";
import { useLocation } from "wouter";
import { Lock } from "lucide-react";
import { HOLD_MS, makeParentGateQuestion } from "@/lib/parentGate";

export function ParentGate() {
  const { unlocked, unlock } = useKidsGate();
  const [, navigate] = useLocation();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState(false);

  // Two-digit multiplication, not single-digit addition. "What is 4 + 8?" is
  // solved by exactly the age group this gate exists to stop. Two-digit
  // multiplication plus a press-and-hold is the standard pattern (YouTube Kids
  // uses the same shape): still not a lock, but well past the range that tries.
  const { a, b } = useMemo(() => makeParentGateQuestion(), []);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimer = useRef<number | null>(null);

  const startHold = () => {
    if (holdTimer.current !== null) return;
    const started = Date.now();
    holdTimer.current = window.setInterval(() => {
      const pct = Math.min(1, (Date.now() - started) / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        stopHold();
        attempt();
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdTimer.current !== null) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldProgress(0);
  };

  // Keyboard/switch users can't fire pointer events, which would lock them out
  // of the whole Kids section. Enter/Space hold the button the same way a press
  // does; key auto-repeat is harmless because startHold ignores re-entry.
  const isHoldKey = (key: string) => key === "Enter" || key === " " || key === "Spacebar";
  const startHoldKey = (e: React.KeyboardEvent) => {
    if (!isHoldKey(e.key)) return;
    e.preventDefault();
    startHold();
  };
  const stopHoldKey = (e: React.KeyboardEvent) => {
    if (!isHoldKey(e.key)) return;
    e.preventDefault();
    stopHold();
  };

  useEffect(() => stopHold, []);

  const attempt = () => {
    if (parseInt(answer, 10) === a * b) {
      unlock();
    } else {
      setError(true);
      setAnswer("");
    }
  };

  if (unlocked) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter alone doesn't open the gate — the hold is part of the check.
    setError(true);
  };

  return (
    <Dialog open={!unlocked} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="parent-gate"
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl">
            <Lock className="h-5 w-5 text-primary" aria-hidden /> Grown-ups only
          </DialogTitle>
          <DialogDescription>
            Ask a grown-up to solve this so we know it's okay to start the yoga adventure.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-center font-serif text-3xl" data-testid="text-parent-gate-question">
            What is {a} × {b}?
          </p>
          <div className="space-y-2">
            <label htmlFor="parent-gate-answer" className="sr-only">
              Answer to {a} times {b}
            </label>
            <Input
              id="parent-gate-answer"
              type="number"
              inputMode="numeric"
              autoFocus
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setError(false);
              }}
              placeholder="Type the answer"
              className="min-h-11 text-center text-lg"
              aria-invalid={error || undefined}
              aria-describedby={error ? "parent-gate-error" : undefined}
              data-testid="input-parent-gate"
            />
          </div>
          {error && (
            <p
              id="parent-gate-error"
              className="text-center text-sm text-destructive"
              role="alert"
              data-testid="text-parent-gate-error"
            >
              Not quite — try again.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => navigate("/")}
              data-testid="button-parent-gate-exit"
            >
              Go back
            </Button>
            {/* Press and hold: adds a deliberate second action a child racing
                through taps won't complete by accident. */}
            <Button
              type="button"
              className="relative min-h-11 flex-1 overflow-hidden"
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
              onKeyDown={startHoldKey}
              onKeyUp={stopHoldKey}
              disabled={answer.trim() === ""}
              aria-label="Press and hold to enter the kids section"
              data-testid="button-parent-gate-submit"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-primary-foreground/25 transition-[width] duration-75"
                style={{ width: `${holdProgress * 100}%` }}
              />
              <span className="relative">
                {holdProgress > 0 ? "Keep holding…" : "Press and hold to enter"}
              </span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
