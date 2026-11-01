/**
 * When the class player saves progress. Plain object, no React, so the
 * cadence is unit-tested with a fake clock:
 *
 *  - every 15s of playback (`CLASS_PROGRESS_SAVE_INTERVAL_MS`),
 *  - on pause, on end, and on exit (`flush` — the page sends it with
 *    `keepalive` so it survives navigation/tab close),
 *  - immediately when playback first crosses 90%, marking the class complete.
 *
 * A save that would repeat the last one (same whole second, same completion)
 * is skipped. The server treats saves as idempotent anyway; this just avoids
 * the pause-then-exit double send.
 */
import { CLASS_PROGRESS_SAVE_INTERVAL_MS, isCompleteAt, type ClassProgressBody } from "@shared/classLibrary";

export type SaveProgress = (body: ClassProgressBody, options: { keepalive: boolean }) => void | Promise<unknown>;

export class ClassProgressSaver {
  private lastSavedAt = 0;
  private lastSent: { seconds: number; completed: boolean } | null = null;
  private position = 0;
  private duration: number | undefined;
  private completed: boolean;

  constructor(
    private readonly send: SaveProgress,
    private readonly now: () => number = Date.now,
    alreadyCompleted = false,
  ) {
    this.completed = alreadyCompleted;
    this.lastSavedAt = this.now();
  }

  /** Call on every `timeupdate`. */
  tick(currentTime: number, duration?: number) {
    this.observe(currentTime, duration);
    if (!this.completed && isCompleteAt(this.position, this.duration)) {
      this.completed = true;
      this.save(false);
      return;
    }
    if (this.now() - this.lastSavedAt >= CLASS_PROGRESS_SAVE_INTERVAL_MS) this.save(false);
  }

  pause(currentTime: number, duration?: number) {
    this.observe(currentTime, duration);
    this.save(false);
  }

  end(duration?: number) {
    this.observe(duration ?? this.duration ?? this.position, duration);
    this.completed = true;
    this.save(false);
  }

  /** Leaving the page or hiding the tab. */
  flush() {
    this.save(true);
  }

  get isCompleted() {
    return this.completed;
  }

  private observe(currentTime: number, duration?: number) {
    if (Number.isFinite(currentTime) && currentTime >= 0) this.position = currentTime;
    if (duration !== undefined && Number.isFinite(duration) && duration > 0) this.duration = duration;
  }

  private save(keepalive: boolean) {
    const seconds = Math.floor(this.position);
    if (this.lastSent && this.lastSent.seconds === seconds && this.lastSent.completed === this.completed) return;
    if (!this.lastSent && seconds === 0 && !this.completed) return; // nothing watched yet
    this.lastSent = { seconds, completed: this.completed };
    this.lastSavedAt = this.now();
    const body: ClassProgressBody = { secondsWatched: seconds, ...(this.duration ? { durationSeconds: this.duration } : {}) };
    if (this.completed) body.completed = true;
    void Promise.resolve(this.send(body, { keepalive })).catch(() => undefined);
  }
}
