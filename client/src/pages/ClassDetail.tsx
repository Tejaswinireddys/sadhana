import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import MuxPlayer, { type MuxPlayerRefAttributes } from "@mux/mux-player-react";
import { ArrowLeft, CheckCircle2, Clock, Lock } from "lucide-react";
import { currentChapterIndex, muxChapters, resumeFrom, type ClassPlayback, type ClassSummary } from "@shared/classLibrary";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion";
import { ClassCard } from "@/components/ClassCard";
import { AdSlot } from "@/components/ads/AdSlot";
import { ClassEndScreen } from "@/components/ClassEndScreen";
import { asanaBySlug } from "@/data/content";
import {
  CLASS_SEEK_SECONDS,
  CLASS_SPEEDS,
  classKeyAction,
  parseClassSpeed,
  readClassSpeed,
  watchedAfter,
  writeClassSpeed,
  type ClassSpeed,
} from "@/lib/classPlayer";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ClassProgressSaver } from "@/lib/classProgressSaver";
import { restorePoint, tokenRefreshDelayMs, tokenRefreshDue, tokenRetryDelayMs } from "@/lib/classTokenRefresh";
import {
  fetchClassPlayback,
  formatClassMinutes,
  formatTimestamp,
  levelLabel,
  refreshClassProgress,
  saveAndNoteClassProgress,
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
 *
 * Signed (Plus) classes arrive with 1h tokens. `useSignedPlayback` fetches
 * fresh ones before they lapse; swapping the token reloads the stream, so the
 * position and play state are restored and progress saves are paused until
 * the reload has landed (otherwise its "pause at 0:00" would rewind progress).
 */
function useSignedPlayback(slug: string, initial: ClassPlayback, onSwap: () => void) {
  const [playback, setPlayback] = useState(initial);
  const onSwapRef = useRef(onSwap);
  onSwapRef.current = onSwap;
  useEffect(() => {
    if (playback.policy !== "signed") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const refresh = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      const fresh = await fetchClassPlayback(slug).catch(() => null);
      inFlight = false;
      if (cancelled) return;
      if (fresh?.policy === "signed" && fresh.playbackId === playback.playbackId) {
        onSwapRef.current();
        setPlayback(fresh);
      } else {
        // Offline, or membership ended (then the next load shows the lock).
        timer = setTimeout(refresh, tokenRetryDelayMs(playback.expiresAt, Date.now()));
      }
    };
    timer = setTimeout(refresh, tokenRefreshDelayMs(playback.expiresAt, Date.now()));
    // Timers stall in a sleeping tab; catch up when it is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible" && tokenRefreshDue(playback.expiresAt, Date.now())) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, playback]);
  return playback;
}

/**
 * Tokens go on as the `playback-token` / `thumbnail-token` / `storyboard-token`
 * attributes, not the `tokens` prop: Mux Player's `tokens` setter only stores
 * the object, so a refreshed token set that way never reached the stream.
 * Attribute changes re-render the player with the new token.
 */
function signedTokenAttributes(playback: ClassPlayback): Record<string, string> {
  if (playback.policy !== "signed") return {};
  return {
    playbackToken: playback.tokens.playback,
    thumbnailToken: playback.tokens.thumbnail,
    storyboardToken: playback.tokens.storyboard,
  };
}

/** Show the pose cue again on any pointer or key activity; hide it after this long idle in fullscreen. */
const CUE_IDLE_MS = 3000;

function ClassVideo({ item, next, onCompleted, onPlayingChange }: {
  item: ClassSummary; next: ClassSummary | null; onCompleted: () => void; onPlayingChange: (playing: boolean) => void;
}) {
  const playerRef = useRef<MuxPlayerRefAttributes | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageId = `class-stage-${item.slug}`;
  // `?? []`: a response from a server older than chapters (mid-deploy) has none.
  const chapters = item.chapters ?? [];
  const [chapterIndex, setChapterIndex] = useState(-1);
  const [speed, setSpeed] = useState<ClassSpeed>(readClassSpeed);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [idle, setIdle] = useState(false);
  const watched = useRef<{ watched: number; last: number | null }>({ watched: 0, last: null });
  const setPlayingBoth = (value: boolean) => { setPlaying(value); onPlayingChange(value); };
  const [initialStart] = useState(() => resumeFrom(item.progress));
  const [startTime, setStartTime] = useState(initialStart);
  const restoring = useRef<{ at: number; play: boolean } | null>(null);
  const playback = useSignedPlayback(item.slug, item.playback!, () => {
    const point = restorePoint(playerRef.current);
    restoring.current = point;
    setStartTime(point.at);
  });
  const saverRef = useRef<ClassProgressSaver | null>(null);
  if (!saverRef.current) {
    saverRef.current = new ClassProgressSaver(
      (body, options) => saveAndNoteClassProgress(item, body, options),
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

  /** Apply speed and chapters to the media; re-run after any (re)load. */
  const applyToMedia = () => {
    const el = playerRef.current;
    if (!el) return;
    el.playbackRate = speed;
    if (chapters.length && typeof (el as unknown as { addChapters?: unknown }).addChapters === "function") {
      try {
        (el as unknown as { addChapters: (c: unknown[]) => void }).addChapters(
          muxChapters(chapters, Number.isFinite(el.duration) ? el.duration : undefined));
      } catch { /* chapters on the timeline are a nicety; the list below still works */ }
    }
  };

  const chooseSpeed = (value: ClassSpeed) => {
    setSpeed(value);
    writeClassSpeed(value);
    if (playerRef.current) playerRef.current.playbackRate = value;
  };

  const seekTo = (seconds: number) => {
    const el = playerRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    setChapterIndex(currentChapterIndex(chapters, seconds));
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void stageRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  const toggleCaptions = () => {
    const el = playerRef.current as unknown as { textTracks?: TextTrackList; media?: { textTracks?: TextTrackList } } | null;
    const tracks = el?.textTracks ?? el?.media?.textTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "subtitles" || track.kind === "captions") {
        track.mode = track.mode === "showing" ? "hidden" : "showing";
        return;
      }
    }
  };

  // Page-level shortcuts (the player handles the same keys itself when focused).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (ended) return;
      const action = classKeyAction({ ...event, key: event.key, target: event.target as HTMLElement | null });
      const el = playerRef.current;
      if (!action || !el) return;
      event.preventDefault();
      setIdle(false);
      if (action === "toggle") { if (el.paused) void el.play()?.catch(() => undefined); else el.pause(); }
      else if (action === "back") seekTo((el.currentTime ?? 0) - CLASS_SEEK_SECONDS);
      else if (action === "forward") seekTo((el.currentTime ?? 0) + CLASS_SEEK_SECONDS);
      else if (action === "fullscreen") toggleFullscreen();
      else if (action === "captions") toggleCaptions();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Fullscreen applies to the stage (player + pose cue), so the cue goes with it.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // In fullscreen, the cue hides after a few idle seconds and returns on activity.
  useEffect(() => {
    if (!fullscreen || !playing) { setIdle(false); return; }
    let timer = setTimeout(() => setIdle(true), CUE_IDLE_MS);
    const wake = () => { setIdle(false); clearTimeout(timer); timer = setTimeout(() => setIdle(true), CUE_IDLE_MS); };
    const stage = stageRef.current;
    stage?.addEventListener("pointermove", wake);
    stage?.addEventListener("touchstart", wake);
    return () => { clearTimeout(timer); stage?.removeEventListener("pointermove", wake); stage?.removeEventListener("touchstart", wake); };
  }, [fullscreen, playing]);

  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : undefined;
  const cuePose = chapter?.poseSlug ? asanaBySlug(chapter.poseSlug) : undefined;
  const showCue = playing && !!cuePose && !(fullscreen && idle);

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

  if (ended) {
    return (
      <ClassEndScreen
        item={item}
        next={next}
        watchedSeconds={watched.current.watched}
        onWatchAgain={() => {
          watched.current = { watched: 0, last: null };
          setStartTime(0);
          setEnded(false);
          setChapterIndex(-1);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div ref={stageRef} id={stageId} className="relative overflow-hidden rounded-xl bg-black" data-testid="class-player">
        {showCue && cuePose && (
          <a
            href={`/asanas/${cuePose.slug}`}
            target="_blank"
            rel="noopener"
            className="absolute left-3 top-3 z-10 max-w-[70%] truncate rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={`Current pose: ${cuePose.english} (opens the pose page in a new tab)`}
            data-testid="class-pose-cue"
          >
            {cuePose.english}
          </a>
        )}
        <MuxPlayer
          ref={(el) => {
            playerRef.current = el;
            // Cast needs Google's SDK from gstatic.com, which CSP (rightly)
            // blocks; opt the media element out instead of loading it.
            el?.media?.setAttribute("disableremoteplayback", "");
          }}
          playbackId={playback.playbackId}
          {...signedTokenAttributes(playback)}
          streamType="on-demand"
          startTime={startTime}
          title={item.title}
          metadata={{ video_title: item.title }}
          disableTracking
          defaultHiddenCaptions={false}
          fullscreenElement={stageId}
          forwardSeekOffset={CLASS_SEEK_SECONDS}
          backwardSeekOffset={CLASS_SEEK_SECONDS}
          playbackRates={[...CLASS_SPEEDS]}
          {...(typeof item.thumbnailTimeSec === "number" ? { thumbnailTime: item.thumbnailTimeSec } : {})}
          accentColor="hsl(var(--primary))"
          style={{ aspectRatio: "16 / 9", width: "100%", display: "block" }}
          onLoadedMetadata={() => {
            applyToMedia();
            const point = restoring.current;
            const el = playerRef.current;
            if (!point || !el) return;
            restoring.current = null;
            if (Math.abs((el.currentTime ?? 0) - point.at) > 1) el.currentTime = point.at;
            if (point.play) void el.play()?.catch(() => undefined);
          }}
          onPlay={() => setPlayingBoth(true)}
          onRateChange={() => {
            // The player's own speed menu: keep the buttons and the saved choice in step.
            const rate = playerRef.current?.playbackRate;
            const parsed = parseClassSpeed(String(rate));
            if (rate === parsed && parsed !== speed) { setSpeed(parsed); writeClassSpeed(parsed); }
          }}
          onTimeUpdate={() => {
            if (restoring.current) return;
            const p = position();
            watched.current = watchedAfter(watched.current, p.current);
            const index = currentChapterIndex(chapters, p.current);
            if (index !== chapterIndex) setChapterIndex(index);
            saver.tick(p.current, p.duration);
            afterSave();
          }}
          onPause={() => { setPlayingBoth(false); if (restoring.current) return; const p = position(); saver.pause(p.current, p.duration); afterSave(); }}
          onEnded={() => {
            setPlayingBoth(false);
            if (restoring.current) return;
            saver.end(position().duration);
            afterSave();
            if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
            setEnded(true);
          }}
          data-testid="class-mux-player"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p data-testid="class-player-resume" data-start={initialStart} data-policy={playback.policy}>
          {initialStart > 0 ? `Resuming from ${formatTimestamp(initialStart)}.` : "Starting from the beginning."}
          {initialStart > 0 && (
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
        <p id="class-player-keys">Keyboard: Space plays or pauses, ← and → skip 10 seconds, C toggles captions, F goes full screen.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Playback speed" data-testid="class-speed">
        <span className="text-sm font-medium">Speed</span>
        {CLASS_SPEEDS.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={speed === value ? "default" : "outline"}
            aria-pressed={speed === value}
            className="min-h-11 min-w-14"
            onClick={() => chooseSpeed(value)}
            data-testid={`class-speed-${value}`}
          >
            {value}×
          </Button>
        ))}
      </div>

      {chapters.length > 0 && (
        <nav aria-label="Chapters" data-testid="class-chapters">
          <h2 className="mb-2 font-serif text-lg font-semibold">Chapters</h2>
          <ol className="divide-y divide-border rounded-xl border border-card-border bg-card">
            {chapters.map((c, i) => {
              const pose = c.poseSlug ? asanaBySlug(c.poseSlug) : undefined;
              const current = i === chapterIndex;
              return (
                <li key={`${c.startSec}-${i}`}>
                  <button
                    type="button"
                    className={`flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${current ? "bg-primary/10 font-medium" : ""}`}
                    aria-current={current ? "true" : undefined}
                    aria-label={`${c.title}, at ${formatTimestamp(c.startSec)}${pose ? `, ${pose.english}` : ""}${current ? " (playing now)" : ""}`}
                    onClick={() => {
                      seekTo(c.startSec);
                      if (playerRef.current?.paused) void playerRef.current.play()?.catch(() => undefined);
                    }}
                    data-testid={`class-chapter-${i}`}
                    data-current={current ? "true" : "false"}
                  >
                    <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{formatTimestamp(c.startSec)}</span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {pose && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{pose.english}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}
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

function ClassVideoSection({ item, next, onCompleted, onPlayingChange }: {
  item: ClassSummary; next: ClassSummary | null; onCompleted: () => void; onPlayingChange: (playing: boolean) => void;
}) {
  if (item.locked) return <LockedClass item={item} />;
  if (!item.playback) {
    return (
      <p className="rounded-xl border border-card-border bg-card p-6 text-muted-foreground" data-testid="class-player-unavailable">
        This class&apos;s video isn&apos;t available yet. Please check back soon.
      </p>
    );
  }
  return <ClassVideo item={item} next={next} onCompleted={onCompleted} onPlayingChange={onPlayingChange} />;
}

function ClassDetail({ slug }: { slug: string }) {
  const detail = useClassDetail(slug);
  const item = detail.data?.class;
  const next = detail.data?.next ?? null;
  const [completed, setCompleted] = useState(false);
  const [playing, setPlaying] = useState(false);
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
            <ClassVideoSection item={item} next={next} onCompleted={() => setCompleted(true)} onPlayingChange={setPlaying} />
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

          {/* Below the player and description, free classes only, and never while
              the video plays: it unmounts on play and returns on pause or end. */}
          {item.tier === "free" && !playing && <AdSlot placement="classDetail" />}

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
