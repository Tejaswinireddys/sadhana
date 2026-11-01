import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import MuxPlayer, { type MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { ArrowLeft, CheckCircle2, Clock, Lock } from "lucide-react";
import { resumeFrom, type ClassSummary } from "@shared/classLibrary";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { ClassCard } from "@/components/ClassCard";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ClassProgressSaver } from "@/lib/classProgressSaver";
import {
  formatClassMinutes,
  formatTimestamp,
  levelLabel,
  refreshClassProgress,
  saveClassProgress,
  useClassDetail,
} from "@/lib/classesApi";

/**
 * The class player. Progress is saved by `ClassProgressSaver` (every 15s,
 * on pause/end, on exit with keepalive, and complete at 90%) and the video
 * resumes from the saved position.
 *
 * Mux Player's own controls are buttons with labels and keyboard shortcuts;
 * captions on the asset are shown by default (`defaultHiddenCaptions` false).
 * Viewer analytics are off (`disableTracking`) — nothing about who watches
 * what goes to Mux Data, and CSP does not allow its beacon host anyway.
 */
function ClassVideo({ item, onCompleted }: { item: ClassSummary; onCompleted: () => void }) {
  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);
  const [startTime] = useState(() => resumeFrom(item.progress));
  const saverRef = useRef<ClassProgressSaver | null>(null);
  if (!saverRef.current) {
    saverRef.current = new ClassProgressSaver(
      (body, options) => saveClassProgress(item.slug, body, options),
      Date.now,
      !!item.progress?.completed,
    );
  }
  const saver = saverRef.current;
  const reportedComplete = useRef(!!item.progress?.completed);

  const position = () => {
    const el = playerRef.current;
    return { current: el?.currentTime ?? 0, duration: el && Number.isFinite(el.duration) ? el.duration : undefined };
  };
  const afterSave = () => {
    if (saver.isCompleted && !reportedComplete.current) {
      reportedComplete.current = true;
      onCompleted();
    }
  };

  // Exit: route change (unmount), tab hidden, or page unload.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") saver.flush(); };
    const onPageHide = () => saver.flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      saver.flush();
      refreshClassProgress();
    };
  }, [saver]);

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl bg-black" data-testid="class-player">
        <MuxPlayer
          ref={(el) => {
            playerRef.current = el;
            // Cast needs Google's SDK from gstatic.com, which CSP (rightly)
            // blocks; opt the media element out instead of loading it.
            el?.media?.setAttribute("disableremoteplayback", "");
          }}
          playbackId={item.playback!.playbackId}
          streamType="on-demand"
          startTime={startTime}
          title={item.title}
          metadata={{ video_title: item.title }}
          disableTracking
          defaultHiddenCaptions={false}
          accentColor="hsl(var(--primary))"
          style={{ aspectRatio: "16 / 9", width: "100%", display: "block" }}
          onTimeUpdate={() => { const p = position(); saver.tick(p.current, p.duration); afterSave(); }}
          onPause={() => { const p = position(); saver.pause(p.current, p.duration); afterSave(); }}
          onEnded={() => { saver.end(position().duration); afterSave(); }}
          data-testid="class-mux-player"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p data-testid="class-player-resume" data-start={startTime}>
          {startTime > 0 ? `Resuming from ${formatTimestamp(startTime)}.` : "Starting from the beginning."}
          {startTime > 0 && (
            <button
              type="button"
              className="ml-2 min-h-11 cursor-pointer font-medium text-foreground underline underline-offset-2"
              onClick={() => { if (playerRef.current) playerRef.current.currentTime = 0; }}
              data-testid="class-player-restart"
            >
              Start over
            </button>
          )}
        </p>
        <p id="class-player-keys">Keyboard: Space plays or pauses, ← and → skip, C toggles captions, F goes full screen.</p>
      </div>
    </div>
  );
}

function LockedClass({ item }: { item: ClassSummary }) {
  return (
    <div className="space-y-4 rounded-xl border border-card-border bg-card p-6 text-center shadow-soft" data-testid="class-player-locked">
      {item.thumbnailUrl && (
        <div className="relative mx-auto aspect-video w-full max-w-md overflow-hidden rounded-lg bg-muted">
          <img src={item.thumbnailUrl} alt="" width={640} height={360} loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
        </div>
      )}
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Lock className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="font-serif text-xl font-semibold">This is a Sadhana Plus class</h2>
      <p className="text-muted-foreground">Plus members can watch every class. Free classes stay free.</p>
      <Button asChild className="min-h-11">
        <Link href="/plus" data-testid="class-player-unlock">Unlock with Sadhana Plus</Link>
      </Button>
    </div>
  );
}

/** Keyed by slug so moving to "Next class" starts with fresh player state. */
export default function ClassDetailRoute() {
  const [, params] = useRoute("/classes/:slug");
  const slug = params?.slug ?? "";
  return <ClassDetail key={slug} slug={slug} />;
}

function ClassVideoSection({ item, onCompleted }: { item: ClassSummary; onCompleted: () => void }) {
  if (item.locked) return <LockedClass item={item} />;
  if (!item.playback) return <p className="text-muted-foreground">This class has no video yet.</p>;
  return <ClassVideo item={item} onCompleted={onCompleted} />;
}

function ClassDetail({ slug }: { slug: string }) {
  const detail = useClassDetail(slug);
  const item = detail.data?.class;
  const next = detail.data?.next ?? null;
  const [completed, setCompleted] = useState(false);
  useDocumentTitle(item ? `${item.title} · Sadhana` : "Class · Sadhana");

  const notFound = detail.isError && /^404:/.test(detail.error instanceof Error ? detail.error.message : "");
  const isDone = completed || !!item?.progress?.completed;

  return (
    <FadeIn className="mx-auto max-w-4xl space-y-6 py-2">
      <Link href="/classes" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-2 hover:underline" data-testid="class-player-back">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All classes
      </Link>

      {detail.isLoading && <p className="text-muted-foreground" role="status">Loading class…</p>}

      {notFound && (
        <div className="space-y-2" data-testid="class-player-not-found">
          <h1 className="font-serif text-2xl font-semibold">Class not found</h1>
          <p className="text-muted-foreground">It may have been moved or unpublished.</p>
        </div>
      )}

      {detail.isError && !notFound && (
        <div className="space-y-2" role="alert">
          <p>This class couldn&apos;t load. Check your connection and try again.</p>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void detail.refetch()}>Try again</Button>
        </div>
      )}

      {item && (
        <>
          <header className="space-y-2">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{item.title}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden />{formatClassMinutes(item.durationMinutes)}</span>
              <span aria-hidden>·</span>
              <span>{levelLabel(item.level)}</span>
              <span aria-hidden>·</span>
              <span>{item.instructorName}</span>
              {item.tier === "plus" && (<><span aria-hidden>·</span><span>Sadhana Plus</span></>)}
            </p>
          </header>

          <section aria-label={`${item.title} video`} aria-describedby={item.locked ? undefined : "class-player-keys"}>
            <ClassVideoSection item={item} onCompleted={() => setCompleted(true)} />
          </section>

          {isDone && (
            <p className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium" role="status" data-testid="class-player-complete">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden /> Class complete
            </p>
          )}

          <section className="space-y-3" aria-labelledby="class-about">
            <h2 id="class-about" className="font-serif text-xl font-semibold">About this class</h2>
            <p className="text-muted-foreground" data-testid="class-player-description">{item.description}</p>
            {item.focusTags.length > 0 && (
              <div>
                <h3 className="sr-only">Focus</h3>
                <ul className="flex flex-wrap gap-2" aria-label="Focus" data-testid="class-player-focus">
                  {item.focusTags.map((tag) => (
                    <li key={tag} className="rounded-full border border-border px-3 py-1 text-sm capitalize">{tag}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {next && (
            <section className="space-y-3" aria-labelledby="class-next" data-testid="class-player-next">
              <h2 id="class-next" className="font-serif text-xl font-semibold">Next class</h2>
              <div className="max-w-sm"><ClassCard item={next} testIdPrefix="class-next" /></div>
            </section>
          )}
        </>
      )}
    </FadeIn>
  );
}
