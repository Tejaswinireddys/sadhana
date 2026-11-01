/**
 * `npm run class:add`: turn a ready Mux asset into a row of the class library.
 *
 * Pure apart from the injected Mux API, so the rules are unit-tested:
 * - A Plus class is always stored `signed`, with a signed playback id that
 *   exists on the asset (one is created when missing). Public ids already on a
 *   Plus asset are reported, and removed only with `--remove-public`, because
 *   deleting a playback id breaks anything else that streams it.
 * - A free class uses a public id (created when missing).
 * - Duration defaults to the asset's own length, rounded up to a minute.
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import {
  CLASS_LEVELS,
  CLASS_TIERS,
  classSlugSchema,
  type ClassPlaybackPolicy,
} from "../shared/classLibrary";
import type { InsertClass } from "../shared/schema";

const idPattern = /^[a-zA-Z0-9_-]+$/;

export const classAddOptionsSchema = z.object({
  asset: z.string().regex(idPattern, "Invalid Mux asset id"),
  title: z.string().trim().min(1, "--title is required").max(200),
  slug: classSlugSchema,
  level: z.enum(CLASS_LEVELS),
  tier: z.enum(CLASS_TIERS),
  duration: z.coerce.number().int().positive().max(600).optional(),
  focus: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(12).default([]),
  description: z.string().max(4000).default(""),
  instructor: z.string().trim().min(1).max(120).default("Sadhana team"),
  thumbnail: z.string().max(2000).optional(),
  draft: z.boolean().default(false),
  removePublic: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});
export type ClassAddOptions = z.infer<typeof classAddOptionsSchema>;

export const CLASS_ADD_USAGE = `Usage: npm run class:add -- --asset <muxAssetId> --title "…" --slug <slug> \\
  --level beginner|intermediate|advanced --tier free|plus --focus "flexibility,back pain" \\
  [--duration <minutes>] [--description "…"] [--instructor "…"] [--thumbnail <url>] \\
  [--draft] [--remove-public] [--dry-run]

Needs DATABASE_URL, MUX_TOKEN_ID and MUX_TOKEN_SECRET. Upserts by slug, so it
also attaches a real video to a placeholder (e.g. --slug steady-strength-flow).`;

export function parseClassAddArgs(argv: string[]): ClassAddOptions {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      asset: { type: "string" }, title: { type: "string" }, slug: { type: "string" },
      level: { type: "string" }, tier: { type: "string" }, duration: { type: "string" },
      focus: { type: "string" }, description: { type: "string" }, instructor: { type: "string" },
      thumbnail: { type: "string" }, draft: { type: "boolean" }, "remove-public": { type: "boolean" },
      "dry-run": { type: "boolean" },
    },
  });
  const parsed = classAddOptionsSchema.safeParse({
    ...values,
    focus: values.focus?.split(",").map((tag) => tag.trim()).filter(Boolean),
    removePublic: values["remove-public"],
    dryRun: values["dry-run"],
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue?.path.join(".") ? `--${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid arguments"}`);
  }
  return parsed.data;
}

export type MuxPlaybackIdRow = { id: string; policy: string };
export type MuxAsset = { id: string; status: string; duration?: number; playback_ids?: MuxPlaybackIdRow[] };

/** The three Mux calls the command needs; `muxApi` implements them over HTTP. */
export type MuxAssetApi = {
  getAsset(assetId: string): Promise<MuxAsset>;
  createPlaybackId(assetId: string, policy: ClassPlaybackPolicy): Promise<MuxPlaybackIdRow>;
  deletePlaybackId(assetId: string, playbackId: string): Promise<void>;
};

export function muxApi(tokenId: string, tokenSecret: string, fetcher: typeof fetch = fetch): MuxAssetApi {
  const auth = `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetcher(`https://api.mux.com/video/v1/${path}`, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Mux API ${method} ${path.split("/")[0]} returned HTTP ${res.status}`);
    return res.status === 204 ? null : (await res.json()).data;
  };
  return {
    getAsset: (assetId) => call("GET", `assets/${encodeURIComponent(assetId)}`),
    createPlaybackId: (assetId, policy) => call("POST", `assets/${encodeURIComponent(assetId)}/playback-ids`, { policy }),
    deletePlaybackId: async (assetId, playbackId) => {
      await call("DELETE", `assets/${encodeURIComponent(assetId)}/playback-ids/${encodeURIComponent(playbackId)}`);
    },
  };
}

export type ResolvedPlayback = {
  playbackId: string;
  playbackPolicy: ClassPlaybackPolicy;
  durationSeconds: number | null;
  created: boolean;
  /** Public ids left on a Plus asset (never served, but streamable if known). */
  publicIdsOnPlus: string[];
  removedPublicIds: string[];
};

/**
 * Find (or create) the playback id this class should use. In a dry run
 * nothing is created or removed; a missing id is reported as an error.
 */
export async function resolveClassPlayback(api: MuxAssetApi, options: Pick<ClassAddOptions, "asset" | "tier" | "removePublic" | "dryRun">): Promise<ResolvedPlayback> {
  const asset = await api.getAsset(options.asset);
  if (!asset || asset.status !== "ready") throw new Error(`Mux asset ${options.asset} is ${asset?.status ?? "missing"}, not ready`);
  const policy: ClassPlaybackPolicy = options.tier === "plus" ? "signed" : "public";
  const ids = asset.playback_ids ?? [];
  let match = ids.find((row) => row.policy === policy && idPattern.test(row.id));
  let created = false;
  if (!match) {
    if (options.dryRun) throw new Error(`Asset has no ${policy} playback id; run without --dry-run to create one`);
    match = await api.createPlaybackId(options.asset, policy);
    created = true;
    if (!match?.id || !idPattern.test(match.id) || match.policy !== policy) throw new Error(`Mux did not return a valid ${policy} playback id`);
  }
  const publicOnPlus = options.tier === "plus" ? ids.filter((row) => row.policy === "public").map((row) => row.id) : [];
  const removed: string[] = [];
  if (publicOnPlus.length && options.removePublic && !options.dryRun) {
    for (const id of publicOnPlus) {
      await api.deletePlaybackId(options.asset, id);
      removed.push(id);
    }
  }
  return {
    playbackId: match.id,
    playbackPolicy: policy,
    durationSeconds: typeof asset.duration === "number" && asset.duration > 0 ? asset.duration : null,
    created,
    publicIdsOnPlus: publicOnPlus.filter((id) => !removed.includes(id)),
    removedPublicIds: removed,
  };
}

/**
 * The row to upsert. A free class defaults to Mux's thumbnail; a Plus class
 * gets none unless one is given, since a signed thumbnail needs a token the
 * library cards do not carry (and `presentClass` drops thumbnails that embed
 * the id for locked viewers anyway).
 */
export function buildClassRow(options: ClassAddOptions, playback: ResolvedPlayback, now = new Date()): InsertClass {
  const minutes = options.duration ?? (playback.durationSeconds ? Math.max(1, Math.ceil(playback.durationSeconds / 60)) : null);
  if (!minutes) throw new Error("--duration is required: the asset does not report its length");
  const thumbnail = options.thumbnail
    ?? (playback.playbackPolicy === "public" ? `https://image.mux.com/${playback.playbackId}/thumbnail.webp` : null);
  return {
    slug: options.slug,
    title: options.title,
    description: options.description,
    instructorName: options.instructor,
    level: options.level,
    durationMinutes: minutes,
    focusTags: options.focus,
    muxPlaybackId: playback.playbackId,
    playbackPolicy: playback.playbackPolicy,
    thumbnailUrl: thumbnail,
    tier: options.tier,
    published: !options.draft,
    createdAt: now.toISOString(),
  };
}
