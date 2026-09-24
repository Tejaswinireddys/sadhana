/**
 * The facts about a session, the same on every card: length (including
 * guidance), level, intensity, pose count, props and teaching format. All
 * derived from the queue by `buildSessionPreflight` — nothing authored.
 */
import type { SessionPreflight } from "@/lib/sessionPreflight";
import { durationPhrase, propsPhrase } from "@/lib/sessionPreflight";
import { countOf } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { Clock, Package } from "lucide-react";

export function SessionSpec({
  preflight,
  className,
  testId,
  showFormat = true,
}: {
  preflight: SessionPreflight;
  className?: string;
  testId?: string;
  showFormat?: boolean;
}) {
  return (
    <div className={cn("space-y-1 text-xs text-muted-foreground", className)} data-testid={testId}>
      <p className="flex flex-wrap items-center gap-y-0.5 whitespace-pre-wrap">
        <Clock className="mr-1.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span data-spec="duration">{durationPhrase(preflight)}</span>
        <span> · </span>
        <span data-spec="level">{preflight.difficulty.level}</span>
        <span> · </span>
        <span data-spec="intensity">{preflight.intensity.level}</span>
        <span> · </span>
        <span data-spec="poses">{countOf(preflight.poseCount, "pose")}</span>
      </p>
      <p className="flex items-center whitespace-pre-wrap">
        <Package className="mr-1.5 h-3.5 w-3.5 shrink-0 self-start mt-0.5" aria-hidden />
        <span className="min-w-0 flex-1">
          <span data-spec="props">{propsPhrase(preflight)}</span>
          {showFormat && (
            <>
              <span> · </span>
              <span data-spec="format">{preflight.modeLabel}, with captions</span>
            </>
          )}
        </span>
      </p>
    </div>
  );
}
