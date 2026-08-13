/**
 * Per-pose streaming playback IDs.
 *
 * Sources (first match wins for reads after merge):
 *   1. Postgres `pose_media` table (when DATABASE_URL is set)
 *   2. In-memory map (always)
 *   3. Seed file `.data/pose-stream-ids.json` + env POSE_STREAM_IDS_JSON
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pool } from "./storage";
import { streamProvider, type StreamProvider } from "./streamConfig";

export type PoseMediaRow = {
  slug: string;
  playbackId: string;
  provider: StreamProvider | null;
  updatedAt: string;
};

const memory = new Map<string, PoseMediaRow>();
let seedLoaded = false;

function seedPath(): string {
  return resolve(process.cwd(), ".data", "pose-stream-ids.json");
}

function loadSeeds() {
  if (seedLoaded) return;
  seedLoaded = true;

  // Env: {"tadasana":"playback-id", ...} or {"tadasana":{"playbackId":"...","provider":"bunny"}}
  const envJson = process.env.POSE_STREAM_IDS_JSON?.trim();
  if (envJson) {
    try {
      mergeSeedObject(JSON.parse(envJson) as Record<string, unknown>);
    } catch (e) {
      console.warn("[stream] POSE_STREAM_IDS_JSON parse failed", e);
    }
  }

  const file = seedPath();
  if (existsSync(file)) {
    try {
      mergeSeedObject(JSON.parse(readFileSync(file, "utf-8")) as Record<string, unknown>);
    } catch (e) {
      console.warn("[stream] pose-stream-ids.json parse failed", e);
    }
  }
}

function mergeSeedObject(obj: Record<string, unknown>) {
  const now = new Date().toISOString();
  for (const [slug, value] of Object.entries(obj)) {
    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) continue;
    let playbackId = "";
    let provider: StreamProvider | null = null;
    if (typeof value === "string") {
      playbackId = value.trim();
    } else if (value && typeof value === "object") {
      const v = value as { playbackId?: string; id?: string; provider?: string };
      playbackId = String(v.playbackId || v.id || "").trim();
      const p = String(v.provider || "").toLowerCase();
      if (p === "bunny" || p === "mux" || p === "cloudflare") provider = p;
    }
    if (!playbackId) continue;
    if (!memory.has(slug)) {
      memory.set(slug, { slug, playbackId, provider, updatedAt: now });
    }
  }
}

async function ensureTable() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pose_media (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      playback_id TEXT NOT NULL,
      provider TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS pose_media_slug_idx ON pose_media (slug);
  `);
}

let tableReady: Promise<void> | null = null;
function ready(): Promise<void> {
  loadSeeds();
  if (!tableReady) {
    tableReady = ensureTable().catch((e) => {
      console.warn("[stream] pose_media table ensure failed", e);
    });
  }
  return tableReady;
}

export async function getPosePlayback(
  slug: string,
): Promise<PoseMediaRow | null> {
  await ready();
  if (pool) {
    try {
      const r = await pool.query<{
        slug: string;
        playback_id: string;
        provider: string | null;
        updated_at: string;
      }>("SELECT slug, playback_id, provider, updated_at FROM pose_media WHERE slug = $1 LIMIT 1", [
        slug,
      ]);
      const row = r.rows[0];
      if (row) {
        const provider =
          row.provider === "bunny" || row.provider === "mux" || row.provider === "cloudflare"
            ? row.provider
            : null;
        return {
          slug: row.slug,
          playbackId: row.playback_id,
          provider,
          updatedAt: row.updated_at,
        };
      }
    } catch {
      /* fall through to memory */
    }
  }
  return memory.get(slug) ?? null;
}

export async function upsertPosePlayback(
  slug: string,
  playbackId: string,
  provider: StreamProvider | null = null,
): Promise<PoseMediaRow> {
  await ready();
  const row: PoseMediaRow = {
    slug,
    playbackId: playbackId.trim(),
    provider,
    updatedAt: new Date().toISOString(),
  };
  memory.set(slug, row);

  if (pool) {
    await pool.query(
      `INSERT INTO pose_media (slug, playback_id, provider, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         playback_id = EXCLUDED.playback_id,
         provider = EXCLUDED.provider,
         updated_at = EXCLUDED.updated_at`,
      [row.slug, row.playbackId, row.provider, row.updatedAt],
    );
  } else {
    // Persist seeds in memory mode so restarts in the same workspace keep IDs.
    try {
      const path = seedPath();
      mkdirSync(dirname(path), { recursive: true });
      const existing = existsSync(path)
        ? (JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>)
        : {};
      existing[slug] = provider
        ? { playbackId: row.playbackId, provider }
        : row.playbackId;
      writeFileSync(path, JSON.stringify(existing, null, 2));
    } catch {
      /* ignore disk errors in ephemeral envs */
    }
  }

  return row;
}

export function defaultProvider(): StreamProvider {
  return streamProvider();
}
