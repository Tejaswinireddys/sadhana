/**
 * Startup bookkeeping: what the server is doing before and just after it binds
 * its port, how long each step took, and whether it may serve yet.
 *
 * A Render deploy timed out with a green build because everything — schema,
 * class queries, the Sentry SDK import — ran *before* `listen()`. One slow or
 * hung step meant no port, no `/healthz`, and nothing in the log to say which
 * step it was. The split here is:
 *
 * - `step`       critical. Awaited, timed, and a failure marks startup failed.
 * - `background` optional warmups. Never awaited, never fatal, still timed.
 *
 * `/healthz` reads `state()`: it only passes once every critical step is done.
 */
export type StartupState = "starting" | "ready" | "failed";

export type StartupTracker = {
  /** Run a critical step. Logs its duration; rethrows after logging a failure. */
  step<T>(name: string, run: () => T | Promise<T>): Promise<T>;
  /** Start an optional warmup without waiting for it. A failure is logged, never thrown. */
  background(name: string, run: () => unknown | Promise<unknown>): void;
  markReady(): void;
  markFailed(error: unknown): void;
  state(): StartupState;
  /** Milliseconds since this tracker (i.e. the boot sequence) started. */
  elapsedMs(): number;
  /** Resolves when every warmup started so far has finished or failed. */
  backgroundSettled(): Promise<void>;
};

/**
 * An error reduced to something safe to print at boot: its code or name plus
 * the message, with anything URL-shaped removed — a connection string carries
 * the database password, and driver errors like to quote it back.
 */
export function safeErrorText(error: unknown): string {
  const e = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  const label = typeof e?.code === "string" ? e.code : typeof e?.name === "string" ? e.name : "Error";
  const message = typeof e?.message === "string" ? e.message : String(error);
  const scrubbed = message.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]").slice(0, 300);
  return `${label}: ${scrubbed}`;
}

export function createStartupTracker(
  opts: { log?: (message: string) => void; now?: () => number } = {},
): StartupTracker {
  const log = opts.log ?? ((message: string) => console.log(`[startup] ${message}`));
  const now = opts.now ?? (() => performance.now());
  const startedAt = now();
  const ms = (from: number) => Math.round(now() - from);
  const pending = new Set<Promise<void>>();
  let state: StartupState = "starting";

  return {
    async step(name, run) {
      const from = now();
      try {
        const result = await run();
        log(`${name}: ${ms(from)}ms`);
        return result;
      } catch (error) {
        log(`${name}: FAILED after ${ms(from)}ms — ${safeErrorText(error)}`);
        throw error;
      }
    },
    background(name, run) {
      const from = now();
      const task = (async () => {
        try {
          await run();
          log(`background ${name}: ${ms(from)}ms`);
        } catch (error) {
          log(`background ${name}: failed after ${ms(from)}ms (continuing) — ${safeErrorText(error)}`);
        }
      })();
      pending.add(task);
      void task.finally(() => pending.delete(task));
    },
    markReady() {
      if (state === "starting") state = "ready";
    },
    markFailed(error) {
      state = "failed";
      log(`cannot serve — ${safeErrorText(error)}`);
    },
    state: () => state,
    elapsedMs: () => ms(startedAt),
    async backgroundSettled() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}
