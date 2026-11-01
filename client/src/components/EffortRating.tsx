import { Button } from "@/components/ui/button";

/** The scale guided practice records in `sessions.rpe` and adaptive recovery reads. */
export const EFFORT_MIN = 1;
export const EFFORT_MAX = 10;

/**
 * Rate of perceived exertion, 1 (easy) – 10 (maximal): one row of buttons
 * shared by the guided player and the class end screen, so both store the
 * same scale. Each button announces whether it is the chosen value.
 */
export function EffortRating({ value, onChange, testIdPrefix = "rpe" }: {
  value: number | null;
  onChange: (value: number) => void;
  testIdPrefix?: string;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Effort, 1 easy to 10 maximal">
      {Array.from({ length: EFFORT_MAX - EFFORT_MIN + 1 }, (_, i) => i + EFFORT_MIN).map((n) => (
        <Button
          key={n}
          type="button"
          className="min-h-11 min-w-11"
          variant={value === n ? "default" : "outline"}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          data-testid={`${testIdPrefix}-${n}`}
        >
          {n}
        </Button>
      ))}
    </div>
  );
}
