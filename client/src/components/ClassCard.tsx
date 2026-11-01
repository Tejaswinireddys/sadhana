import { Link } from "wouter";
import { Clock, Lock, PlayCircle } from "lucide-react";
import type { ClassSummary } from "@shared/classLibrary";
import { cn } from "@/lib/utils";
import { formatClassMinutes, levelLabel } from "@/lib/classesApi";

/**
 * One class in the library. A locked Plus class links to /plus instead of the
 * player, and says so in its accessible name — the lock icon alone is not
 * announced. Only colour/border transitions: nothing moves, so there is no
 * motion to reduce.
 */
export function ClassCard({ item, testIdPrefix = "class-card" }: { item: ClassSummary; testIdPrefix?: string }) {
  const href = item.locked ? "/plus" : `/classes/${item.slug}`;
  const progress = item.progress && !item.progress.completed && item.durationMinutes > 0
    ? Math.min(100, Math.round((item.progress.secondsWatched / (item.durationMinutes * 60)) * 100))
    : null;
  const label = [
    item.title,
    `${formatClassMinutes(item.durationMinutes)}, ${levelLabel(item.level)}`,
    item.locked ? "Sadhana Plus class — unlock with Plus" : item.tier === "plus" ? "Sadhana Plus" : null,
    item.progress?.completed ? "Completed" : progress !== null ? `${progress}% watched` : null,
  ].filter(Boolean).join(". ");

  return (
    <Link
      href={href}
      aria-label={label}
      data-testid={`${testIdPrefix}-${item.slug}`}
      data-locked={item.locked ? "true" : "false"}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-card-border bg-card text-card-foreground shadow-soft",
        "transition-colors duration-200 hover:border-primary/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {/* overflow-hidden: a flex child with aspect-ratio otherwise grows to its
          content, and the portrait pose illustrations stretched cards to 3:4. */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt=""
            width={640}
            height={360}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlayCircle className="h-10 w-10" aria-hidden />
          </div>
        )}
        {item.locked && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-xs font-medium text-foreground"
            data-testid={`${testIdPrefix}-lock-${item.slug}`}
            aria-hidden
          >
            <Lock className="h-3.5 w-3.5" /> Plus
          </span>
        )}
        {progress !== null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-background/60" aria-hidden>
            <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="font-medium leading-snug">{item.title}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatClassMinutes(item.durationMinutes)}</span>
          <span>·</span>
          <span>{levelLabel(item.level)}</span>
          {item.progress?.completed && (<><span>·</span><span>Completed</span></>)}
        </p>
      </div>
    </Link>
  );
}
