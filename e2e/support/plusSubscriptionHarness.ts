/**
 * Everything the Plus subscription E2E needs around the browser: a throwaway
 * Postgres database, a mail sink, a server process of its own, and the Stripe
 * webhook relay.
 *
 * Nothing here fakes Stripe. The server is given the real test-mode key, the
 * events relayed to its webhook are the ones Stripe itself generated (read
 * back through the Events API), and they are signed the way Stripe signs them.
 * Stripe cannot reach a server on 127.0.0.1, which is the only reason a relay
 * exists at all.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac, createPublicKey, generateKeyPairSync, randomBytes, verify, type KeyObject } from "node:crypto";
import { createServer, type Server } from "node:http";
import net from "node:net";
import path from "node:path";
import pg from "pg";
import type Stripe from "stripe";
import type { PlusE2eConfig } from "./plusSubscriptionPreflight";

export type CapturedEmail = { to: string; subject: string; text: string; kind: string };

export type PlusHarness = {
  baseUrl: string;
  /** Queries against the throwaway database only. */
  db: pg.Pool;
  databaseName: string;
  emails: CapturedEmail[];
  /** Signing secret this server verifies webhooks with. Generated per run. */
  webhookSecret: string;
  /** Public half of the throwaway key the server signs playback tokens with. */
  playbackPublicKey: KeyObject;
  playbackKeyId: string;
  /** Every secret the server was started with; none may reach the browser. */
  serverSecrets: Record<string, string>;
  serverLog: () => string;
  stop(): Promise<void>;
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** A local stand-in for the mail provider, so verification is read from a real "sent" email and nothing leaves the machine. */
async function startMailSink(emails: CapturedEmail[]): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try { emails.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as CapturedEmail); } catch { /* not ours */ }
      res.writeHead(200, { "content-type": "application/json" }).end("{\"ok\":true}");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return { url: `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/email`, server };
}

function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  // initStorage() always asks for SSL; a local Postgres has none, and an
  // explicit sslmode in the URL is what overrides it (see authMeStripe.test.ts).
  if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "disable");
  return url.toString();
}

/**
 * Create the throwaway database, start a server of its own against it, and
 * wait until it reports healthy. `stop()` kills the server and drops the
 * database, whatever happened in between.
 */
export async function startPlusHarness(config: PlusE2eConfig): Promise<PlusHarness> {
  const databaseName = `plus_e2e_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const admin = new pg.Client({ connectionString: databaseUrl(config.adminDatabaseUrl, new URL(config.adminDatabaseUrl).pathname.slice(1) || "postgres") });
  await admin.connect();
  // The name is generated above from [a-z0-9_] only; identifiers cannot be parameters.
  await admin.query(`CREATE DATABASE ${databaseName}`);
  await admin.end();
  const testDatabaseUrl = databaseUrl(config.adminDatabaseUrl, databaseName);

  const emails: CapturedEmail[] = [];
  const sink = await startMailSink(emails);
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  // A throwaway RSA key: the server signs playback tokens with it exactly as
  // it would with a Mux signing key, and the test verifies them with the
  // public half. It is not a Mux key, so Mux itself would not stream for it.
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const playbackKeyId = `plus-e2e-${randomBytes(4).toString("hex")}`;
  const webhookSecret = `whsec_${randomBytes(24).toString("hex")}`;
  const deviceSecret = randomBytes(32).toString("hex");

  const serverSecrets: Record<string, string> = {
    STRIPE_TEST_SECRET_KEY: config.stripeSecretKey,
    STRIPE_TEST_WEBHOOK_SECRET: webhookSecret,
    MUX_SIGNING_KEY_PRIVATE: Buffer.from(privatePem).toString("base64"),
    DEVICE_ID_SECRET: deviceSecret,
  };

  // An explicit environment, not the developer's: no .env (it names a hosted
  // database), no STRIPE_LIVE_*, no real mail or Mux credentials.
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    // node-postgres falls back to these when the test URL names no user.
    ...(process.env.USER ? { USER: process.env.USER } : {}),
    ...(process.env.PGUSER ? { PGUSER: process.env.PGUSER } : {}),
    NODE_ENV: "development",
    DOTENV_CONFIG_PATH: path.join(process.cwd(), ".env.plus-e2e-does-not-exist"),
    PORT: String(port),
    PUBLIC_APP_URL: baseUrl,
    DATABASE_URL: testDatabaseUrl,
    SEED_PLACEHOLDER_CLASSES: "true",
    BILLING_ENABLED: "true",
    STRIPE_MODE: "test",
    STRIPE_TEST_PRICE_MONTHLY: config.priceMonthly,
    STRIPE_TEST_PRICE_YEARLY: config.priceYearly,
    ...(config.stripePublishableKey ? { STRIPE_TEST_PUBLISHABLE_KEY: config.stripePublishableKey } : {}),
    EMAIL_WEBHOOK_URL: sink.url,
    MUX_SIGNING_KEY_ID: playbackKeyId,
    ...serverSecrets,
  };

  let log = "";
  const child: ChildProcess = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { cwd: process.cwd(), env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (chunk: Buffer) => { log += chunk.toString(); });
  child.stderr?.on("data", (chunk: Buffer) => { log += chunk.toString(); });

  const db = new pg.Pool({ connectionString: testDatabaseUrl, max: 2 });
  const stop = async () => {
    await db.end().catch(() => undefined);
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => { child.once("exit", () => resolve()); setTimeout(resolve, 5_000); });
    }
    await new Promise<void>((resolve) => sink.server.close(() => resolve()));
    const cleanup = new pg.Client({ connectionString: databaseUrl(config.adminDatabaseUrl, new URL(config.adminDatabaseUrl).pathname.slice(1) || "postgres") });
    await cleanup.connect();
    await cleanup.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
    await cleanup.end();
  };

  try {
    const deadline = Date.now() + 120_000;
    for (;;) {
      if (child.exitCode !== null) throw new Error(`The test server exited (code ${child.exitCode}) before it was ready:\n${log.slice(-2000)}`);
      const res = await fetch(`${baseUrl}/healthz`).catch(() => null);
      if (res?.ok) break;
      if (Date.now() > deadline) throw new Error(`The test server did not become healthy in 120s:\n${log.slice(-2000)}`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    await stop().catch(() => undefined);
    throw error;
  }

  return { baseUrl, db, databaseName, emails, webhookSecret, playbackPublicKey: createPublicKey(publicKey.export({ type: "spki", format: "pem" })), playbackKeyId, serverSecrets, serverLog: () => log, stop };
}

/** The verification link from the email the server "sent" to `to`. */
export async function verificationLinkFor(harness: PlusHarness, to: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const email = harness.emails.find((e) => e.kind === "verify" && e.to === to);
    const link = email && /https?:\/\/\S+\/verify\?token=\S+/.exec(email.text)?.[0];
    if (link) return link;
    if (Date.now() > deadline) throw new Error(`No verification email arrived for ${to}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/**
 * Point a seeded Plus class at a playback id so a member has something signed
 * to play. Placeholder Plus classes are seeded with none (see classSeed.ts).
 * The seed runs as a background warmup, so wait for the row to exist.
 */
export async function attachSignedPlayback(harness: PlusHarness, slug: string, playbackId: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const updated = await harness.db.query(
      "UPDATE classes SET mux_playback_id = $1, playback_policy = 'signed' WHERE slug = $2 AND tier = 'plus' AND published",
      [playbackId, slug],
    );
    if (updated.rowCount === 1) return;
    if (Date.now() > deadline) throw new Error(`The Plus class "${slug}" was never seeded in the test database`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

/** Verify an RS256 JWT with the harness's public key and return its claims; throws if the signature is not ours. */
export function verifiedPlaybackClaims(harness: PlusHarness, token: string): Record<string, unknown> {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Not a JWT");
  const head = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as { alg?: string; kid?: string };
  if (head.alg !== "RS256" || head.kid !== harness.playbackKeyId) throw new Error(`Unexpected token header: ${JSON.stringify(head)}`);
  const good = verify("RSA-SHA256", Buffer.from(`${header}.${payload}`), harness.playbackPublicKey, Buffer.from(signature, "base64url"));
  if (!good) throw new Error("Playback token signature does not verify");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** Stripe's `Stripe-Signature` header for `payload`: `t=<unix>,v1=HMAC-SHA256(secret, "<t>.<payload>")`. */
export function stripeSignature(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;
}

export type WebhookResult = { status: number; body: { received?: boolean; duplicate?: boolean; error?: string } | string };

/** POST a raw payload to the server's webhook endpoint with the given signature header (or none). */
export async function postWebhook(harness: PlusHarness, payload: string, signature: string | null): Promise<WebhookResult> {
  const res = await fetch(`${harness.baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(signature ? { "stripe-signature": signature } : {}) },
    body: payload,
  });
  const text = await res.text();
  try { return { status: res.status, body: JSON.parse(text) as WebhookResult["body"] }; } catch { return { status: res.status, body: text }; }
}

function eventCustomer(event: Stripe.Event): string | null {
  const object = event.data.object as { object?: string; id?: string; customer?: string | { id: string } | null };
  if (object.object === "customer") return object.id ?? null;
  return typeof object.customer === "string" ? object.customer : object.customer?.id ?? null;
}

/**
 * The events Stripe has generated for one customer since `sinceUnix`, oldest
 * first. These are Stripe's own event objects, unmodified.
 */
export async function stripeEventsForCustomer(stripe: Stripe, customerId: string, sinceUnix: number): Promise<Stripe.Event[]> {
  const events: Stripe.Event[] = [];
  for await (const event of stripe.events.list({ created: { gte: sinceUnix }, limit: 100 })) {
    if (!event.livemode && eventCustomer(event) === customerId) events.push(event);
  }
  return events.sort((a, b) => a.created - b.created || a.id.localeCompare(b.id));
}

/** Poll Stripe until an event of each wanted type exists for the customer. */
export async function waitForStripeEvents(
  stripe: Stripe, customerId: string, sinceUnix: number, wanted: string[], timeoutMs = 90_000,
): Promise<Stripe.Event[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const events = await stripeEventsForCustomer(stripe, customerId, sinceUnix);
    const types = new Set(events.map((e) => e.type));
    if (wanted.every((type) => types.has(type))) return events;
    if (Date.now() > deadline) {
      throw new Error(`Stripe did not produce ${wanted.filter((t) => !types.has(t)).join(", ")} for ${customerId} within ${timeoutMs / 1000}s (saw: ${[...types].join(", ") || "nothing"})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}
