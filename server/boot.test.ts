import { test } from "node:test";
import assert from "node:assert/strict";
import { bootServer, type BootOptions } from "./boot";
import { createStartupTracker, safeErrorText } from "./startup";

// Never a real database: boot.ts does not load .env, and this makes sure an
// exported DATABASE_URL cannot point the test at one either.
delete process.env.DATABASE_URL;

/** A promise the test resolves or rejects by hand, standing in for slow work. */
function held() {
  let release!: () => void;
  let fail!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    release = resolve;
    fail = reject;
  });
  return { promise, release, fail };
}

async function boot(options: BootOptions) {
  const server = await bootServer({
    port: 0,
    host: "127.0.0.1",
    schedulers: false,
    mountFrontend: () => undefined,
    ...options,
  });
  const get = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${server.port}${path}`);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  return { server, get };
}

test("the server listens and passes /healthz while an optional warmup is still running", async () => {
  const warmup = held();
  let started = false;
  let finished = false;
  const { server, get } = await boot({
    warmups: [{
      name: "held warmup",
      run: async () => {
        started = true;
        await warmup.promise;
        finished = true;
      },
    }],
  });
  try {
    await server.ready;
    assert.equal(started, true, "the warmup was started");
    assert.equal(finished, false, "and is still running");
    assert.deepEqual(await get("/healthz"), { status: 200, body: { ok: true } });
    assert.equal((await get("/api/auth/me")).status, 200, "the API serves too");

    warmup.release();
    await server.startup.backgroundSettled();
    assert.equal(finished, true);
  } finally {
    warmup.release();
    await server.close();
  }
});

test("a warmup that fails is logged and does not take the server down", async () => {
  const { server, get } = await boot({
    warmups: [{ name: "broken warmup", run: async () => { throw new Error("warmup exploded"); } }],
  });
  try {
    await server.ready;
    await server.startup.backgroundSettled();
    assert.equal(server.startup.state(), "ready");
    assert.equal((await get("/healthz")).status, 200);
  } finally {
    await server.close();
  }
});

test("the port is bound before a critical step finishes, but /healthz and the API say 'not yet'", async () => {
  const schema = held();
  let warmupStarted = false;
  const { server, get } = await boot({
    criticalSteps: [{ name: "held schema", run: () => schema.promise }],
    warmups: [{ name: "after ready", run: () => { warmupStarted = true; } }],
  });
  try {
    assert.deepEqual(await get("/healthz"), { status: 503, body: { ok: false, error: "starting" } });
    assert.deepEqual(await get("/api/auth/me"), { status: 503, body: { error: "Server is starting" } });
    assert.equal(warmupStarted, false, "warmups wait for the critical steps");
    // The keep-alive probe answers as soon as the port is bound: an uptime
    // ping must warm the instance, not fail it, during startup.
    assert.deepEqual(await get("/ping"), { status: 200, body: { ok: true } });

    schema.release();
    await server.ready;
    assert.equal((await get("/healthz")).status, 200);
    assert.deepEqual(await get("/ping"), { status: 200, body: { ok: true } });
    assert.equal(warmupStarted, true);
  } finally {
    schema.release();
    await server.close();
  }
});

test("/healthz keeps failing when a critical step fails", async () => {
  const { server, get } = await boot({
    criticalSteps: [{ name: "schema", run: async () => { throw new Error("relation does not exist"); } }],
  });
  try {
    await assert.rejects(server.ready, /relation does not exist/);
    assert.equal(server.startup.state(), "failed");
    assert.deepEqual(await get("/healthz"), { status: 503, body: { ok: false, error: "startup failed" } });
  } finally {
    await server.close();
  }
});

test("startup logs name each step and its duration, never a connection string", async () => {
  const lines: string[] = [];
  let clock = 0;
  const startup = createStartupTracker({ log: (line) => lines.push(line), now: () => clock });
  await startup.step("ensure schema", () => { clock += 120; });
  await assert.rejects(
    startup.step("connect", () => {
      clock += 30;
      throw Object.assign(new Error("connect failed for postgresql://app:hunter2@db.internal:5432/app"), { code: "ECONNREFUSED" });
    }),
  );
  startup.background("warm", () => { clock += 5; });
  await startup.backgroundSettled();

  assert.deepEqual(lines, [
    "ensure schema: 120ms",
    "connect: FAILED after 30ms — ECONNREFUSED: connect failed for [url]",
    "background warm: 5ms",
  ]);
  assert.doesNotMatch(lines.join("\n"), /hunter2|db\.internal/);
  assert.equal(safeErrorText("postgres://u:p@h/db is down"), "Error: [url] is down");
});
