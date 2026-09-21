/**
 * The screen between choosing a practice and doing it.
 *
 * Shows only what is derived from the queue itself — length for the teaching
 * mode you will actually get, level, effort, the props you need in the room,
 * the poses in order, and the catalog's own modification lines. Nothing here
 * is authored per session, so nothing here can promise something the player
 * does not deliver.
 */
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PoseImage } from "@/components/PoseImage";
import { STATIC_REFERENCE_LABEL } from "@/data/poseDemoAvailability";
import { formatDuration } from "@/lib/formatDuration";
import type { SessionPreflight } from "@/lib/sessionPreflight";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Package, ShieldCheck } from "lucide-react";

export function SessionPreflightCard({
  title,
  preflight,
  poses,
  onSwapEquipment,
  className,
}: {
  title: string | null;
  preflight: SessionPreflight;
  poses: Array<{ slug: string; english: string; holdSeconds: number; sides?: "once" | "each" }>;
  /** Swap one prop-dependent pose for its reviewed prop-free pair. */
  onSwapEquipment?: (fromSlug: string, toSlug: string) => void;
  className?: string;
}) {
  const fit = preflight.fit;
  return (
    <section
      className={cn(
        "w-full max-w-lg space-y-4 rounded-3xl border border-border bg-card p-5 text-left shadow-soft",
        className,
      )}
      aria-label="Before you start"
      data-testid="session-preflight"
    >
      <div className="space-y-1">
        {title && <h2 className="font-serif text-2xl leading-tight">{title}</h2>}
        <p className="text-sm text-muted-foreground" data-testid="preflight-spec">
          {preflight.timeLabel} · {preflight.difficulty.level} · {preflight.intensity.level} ·{" "}
          {preflight.poseCount} {preflight.poseCount === 1 ? "pose" : "poses"}
        </p>
        <p className="text-xs text-muted-foreground">{preflight.intensity.reason}</p>
      </div>

      {fit && !fit.fits && fit.explanation && (
        <p
          className="flex gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm"
          data-testid="preflight-fit-warning"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>{fit.explanation}</span>
        </p>
      )}

      {/* Equipment — the reason this screen exists. */}
      <div className="space-y-2" data-testid="preflight-equipment">
        <p className="flex items-center gap-2 text-sm font-medium" data-testid="preflight-required">
          <Package className="h-4 w-4 text-primary" aria-hidden />
          {preflight.equipmentSentence
            ? `You'll need ${preflight.equipmentSentence}.`
            : "No props needed."}
        </p>
        {preflight.optionalEquipmentSentence && (
          <p className="text-xs text-muted-foreground">
            Nice to have: {preflight.optionalEquipmentSentence}.
          </p>
        )}
        {preflight.equipmentAlternatives.length > 0 && onSwapEquipment && (
          <ul className="space-y-2" data-testid="preflight-equipment-alternatives">
            {preflight.equipmentAlternatives.map((alt) => (
              <li
                key={alt.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/50 px-3 py-2"
              >
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{alt.english}</span> — {alt.note}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => onSwapEquipment(alt.slug, alt.swapToSlug)}
                  data-testid={`preflight-swap-${alt.slug}`}
                >
                  Practise without it
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* How it is taught. */}
      <p className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="preflight-mode">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          <Badge variant="secondary" className="mr-1.5 align-middle">
            {preflight.modeLabel}
          </Badge>
          {preflight.modeDescription}
          {preflight.usesStaticReference && ` ${STATIC_REFERENCE_LABEL}.`}
        </span>
      </p>

      {/* Pose preview — collapsed on small screens so Begin stays reachable. */}
      <details className="group" data-testid="preflight-poses">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span>Preview the {preflight.poseCount} poses</span>
          <span className="text-xs text-primary group-open:hidden">Show</span>
          <span className="hidden text-xs text-primary group-open:inline">Hide</span>
        </summary>
        <ol className="mt-3 space-y-2">
          {poses.map((p, i) => (
            <li key={`${p.slug}-${i}`} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <PoseImage
                slug={p.slug}
                thumb
                breath={false}
                shadow={false}
                rounded="rounded-lg"
                aspect="aspect-square"
                className="h-10 w-10 shrink-0"
                sizes="40px"
              />
              <span className="min-w-0 flex-1 truncate text-sm">{p.english}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDuration(p.holdSeconds)}
                {p.sides === "each" ? " each side" : ""}
              </span>
            </li>
          ))}
        </ol>
      </details>

      {/* Modifications, straight from the catalog entries. */}
      {preflight.modifications.length > 0 && (
        <details className="group" data-testid="preflight-modifications">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Ways to make this easier
            </span>
            <span className="text-xs text-primary group-open:hidden">Show</span>
            <span className="hidden text-xs text-primary group-open:inline">Hide</span>
          </summary>
          <dl className="mt-3 space-y-2 text-sm">
            {preflight.modifications.map((m) => (
              <Fragment key={m.slug}>
                <dt className="font-medium">{m.english}</dt>
                <dd className="text-muted-foreground">{m.text}</dd>
              </Fragment>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
