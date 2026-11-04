/**
 * `npm run class:remove` — delete one class by slug. The pure parts (argument
 * parsing, the plan, its wording, the run order) live here so they are tested
 * against MemoryStorage; `script/class-remove.ts` only wires env, the database
 * and a terminal prompt to them.
 *
 * Order matters: the database rows go first, in one transaction, and the Mux
 * asset only afterwards. A failed Mux delete then leaves an orphaned asset
 * (printed, removable by hand) rather than a live class pointing at a video
 * that no longer exists.
 */
import { parseArgs } from "node:util";
import { z } from "zod";
import { classSlugSchema, storedChapters } from "../shared/classLibrary";
import type { IStorage } from "./storage";
import { MUX_PUBLIC_TEST_PLAYBACK_ID } from "./classSeed";

export const CLASS_REMOVE_USAGE = `Usage: npm run class:remove -- --slug <slug> [--delete-mux-asset] [--yes] [--dry-run]

Deletes the class row (its chapters are stored on it) and every viewer's
progress row for it, in one transaction. Practice sessions viewers logged
after finishing the class, and the effort ratings on them, are their own
history and are kept.

  --delete-mux-asset  also delete the Mux asset behind the playback id
                      (needs MUX_TOKEN_ID and MUX_TOKEN_SECRET)
  --yes               skip the confirmation prompt
  --dry-run           print the plan and change nothing

Needs DATABASE_URL.`;

export const classRemoveOptionsSchema = z.object({
  slug: classSlugSchema,
  deleteMuxAsset: z.boolean(),
  yes: z.boolean(),
  dryRun: z.boolean(),
});
export type ClassRemoveOptions = z.infer<typeof classRemoveOptionsSchema>;

export function parseClassRemoveArgs(argv: string[]): ClassRemoveOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      slug: { type: "string" },
      "delete-mux-asset": { type: "boolean" },
      yes: { type: "boolean" },
      "dry-run": { type: "boolean" },
    },
    strict: true,
  });
  const parsed = classRemoveOptionsSchema.safeParse({
    slug: values.slug,
    deleteMuxAsset: values["delete-mux-asset"] ?? false,
    yes: values.yes ?? false,
    dryRun: values["dry-run"] ?? false,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(issue?.path[0] === "slug" && values.slug === undefined ? "--slug is required" : `--${String(issue?.path[0] ?? "slug")}: ${issue?.message}`);
  }
  return parsed.data;
}

/** What the Mux lookup found for the class's playback id. */
export type MuxAssetLookup =
  | { kind: "none" } // the class has no playback id
  | { kind: "placeholder" } // Mux's public demo clip: not ours to delete
  | { kind: "not-checked"; reason: string }
  | { kind: "found"; assetId: string }
  | { kind: "failed"; reason: string };

export type ClassRemovalPlan = {
  classId: number;
  slug: string;
  title: string;
  tier: string;
  published: boolean;
  chapters: number;
  progressRows: number;
  playbackId: string | null;
  /** Other classes on the same playback id: deleting the asset would break them. */
  sharedWith: string[];
  asset: MuxAssetLookup;
};

export type ClassRemoveDeps = {
  store: IStorage;
  /** Playback id → asset id, or null when Mux credentials are not set. */
  lookupAsset: ((playbackId: string) => Promise<string>) | null;
  deleteAsset: ((assetId: string) => Promise<void>) | null;
  confirm: (question: string) => Promise<boolean>;
  log: (message: string) => void;
};

export async function planClassRemoval(slug: string, deps: Pick<ClassRemoveDeps, "store" | "lookupAsset">): Promise<ClassRemovalPlan> {
  const row = await deps.store.getClassBySlug(slug);
  if (!row) throw new Error(`No class with slug "${slug}"`);
  const playbackId = row.muxPlaybackId?.trim() || null;
  const sharedWith = playbackId
    ? (await deps.store.listClasses()).filter((other) => other.id !== row.id && other.muxPlaybackId?.trim() === playbackId).map((other) => other.slug)
    : [];
  let asset: MuxAssetLookup;
  if (!playbackId) asset = { kind: "none" };
  else if (playbackId === MUX_PUBLIC_TEST_PLAYBACK_ID) asset = { kind: "placeholder" };
  else if (!deps.lookupAsset) asset = { kind: "not-checked", reason: "MUX_TOKEN_ID / MUX_TOKEN_SECRET not set" };
  else {
    try { asset = { kind: "found", assetId: await deps.lookupAsset(playbackId) }; }
    catch (error) { asset = { kind: "failed", reason: error instanceof Error ? error.message : "lookup failed" }; }
  }
  return {
    classId: row.id,
    slug: row.slug,
    title: row.title,
    tier: row.tier,
    published: row.published,
    chapters: storedChapters(row.chapters).length,
    progressRows: await deps.store.countClassProgressForClass(row.id),
    playbackId,
    sharedWith,
    asset,
  };
}

/**
 * Why the asset cannot be deleted, or null when it can. Checked before any
 * row is touched, so `--delete-mux-asset` never half-runs.
 */
export function assetDeleteBlocker(plan: ClassRemovalPlan): string | null {
  switch (plan.asset.kind) {
    case "none": return "the class has no playback id, so there is no Mux asset to delete";
    case "placeholder": return "the playback id is Mux's public test clip, which is not our asset";
    case "not-checked": return `the asset could not be looked up (${plan.asset.reason})`;
    case "failed": return `the asset lookup failed (${plan.asset.reason})`;
    case "found":
      return plan.sharedWith.length ? `the same playback id is used by ${plan.sharedWith.join(", ")}` : null;
  }
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function assetLine(plan: ClassRemovalPlan): string {
  switch (plan.asset.kind) {
    case "none": return "none (no playback id)";
    case "placeholder": return "none (Mux public test clip)";
    case "not-checked": return `unknown — ${plan.asset.reason}`;
    case "failed": return `unknown — ${plan.asset.reason}`;
    case "found": return plan.asset.assetId;
  }
}

/** The plan as printed. Ids only, never tokens or secrets. */
export function formatClassRemovalPlan(plan: ClassRemovalPlan, options: Pick<ClassRemoveOptions, "deleteMuxAsset">): string[] {
  const lines = [
    `Class "${plan.title}" (/classes/${plan.slug}, id ${plan.classId}, ${plan.tier}, ${plan.published ? "published" : "draft"})`,
    `  Delete: class row, with ${plural(plan.chapters, "chapter")} stored on it`,
    `  Delete: ${plural(plan.progressRows, "progress row")} (viewers' watch position for this class)`,
    "  Ratings: none are stored per class. Effort ratings sit on viewers' own practice sessions, which are kept.",
    `  Playback id: ${plan.playbackId ?? "none"}`,
    `  Mux asset: ${assetLine(plan)}`,
  ];
  if (plan.sharedWith.length) lines.push(`  Note: the same playback id is also used by ${plan.sharedWith.join(", ")}`);
  const blocker = assetDeleteBlocker(plan);
  if (!options.deleteMuxAsset) lines.push("  Mux asset will be kept (pass --delete-mux-asset to delete it).");
  else if (!blocker && plan.asset.kind === "found") lines.push(`  Delete: Mux asset ${plan.asset.assetId} (after the database rows)`);
  return lines;
}

export type ClassRemoveResult =
  | { status: "dry-run"; plan: ClassRemovalPlan }
  | { status: "aborted"; plan: ClassRemovalPlan }
  | { status: "removed"; plan: ClassRemovalPlan; classRows: number; progressRows: number; deletedAssetId: string | null };

export async function runClassRemove(options: ClassRemoveOptions, deps: ClassRemoveDeps): Promise<ClassRemoveResult> {
  const plan = await planClassRemoval(options.slug, deps);
  for (const line of formatClassRemovalPlan(plan, options)) deps.log(line);

  if (options.deleteMuxAsset) {
    const blocker = assetDeleteBlocker(plan);
    if (blocker) throw new Error(`--delete-mux-asset: ${blocker}. Nothing was deleted.`);
    if (!deps.deleteAsset) throw new Error("--delete-mux-asset needs MUX_TOKEN_ID and MUX_TOKEN_SECRET. Nothing was deleted.");
  }
  if (options.dryRun) {
    deps.log("Dry run: nothing deleted.");
    return { status: "dry-run", plan };
  }
  if (!options.yes && !(await deps.confirm(`Delete /classes/${plan.slug}? Type "yes" to continue: `))) {
    deps.log("Aborted: nothing deleted.");
    return { status: "aborted", plan };
  }

  let removed: { classRows: number; progressRows: number };
  try {
    removed = await deps.store.deleteClassWithProgress(plan.classId);
  } catch (error) {
    // Drizzle's own message is the SQL text; the database's reason is on `cause`.
    const cause = error instanceof Error ? ((error.cause as Error | undefined)?.message ?? error.message) : "unknown error";
    throw new Error(`Deleting /classes/${plan.slug} failed and was rolled back; nothing was deleted (${cause}).`);
  }
  if (!removed.classRows) throw new Error(`/classes/${plan.slug} was already gone; nothing deleted.`);
  deps.log(`Deleted /classes/${plan.slug}: 1 class row, ${plural(removed.progressRows, "progress row")}.`);

  let deletedAssetId: string | null = null;
  if (options.deleteMuxAsset && plan.asset.kind === "found") {
    try {
      await deps.deleteAsset!(plan.asset.assetId);
      deletedAssetId = plan.asset.assetId;
      deps.log(`Deleted Mux asset ${plan.asset.assetId}.`);
    } catch (error) {
      throw new Error(`The class is deleted, but deleting Mux asset ${plan.asset.assetId} failed (${
        error instanceof Error ? error.message : "unknown error"}). Delete it in the Mux dashboard.`);
    }
  }
  return { status: "removed", plan, ...removed, deletedAssetId };
}

/** Answers that count as consent at the prompt: only an explicit yes. */
export function isConfirmation(answer: string): boolean {
  return /^(y|yes)$/i.test(answer.trim());
}

/** The two Mux calls `class:remove` needs, with the same auth and errors as `muxApi`. */
export function muxAssetRemoval(tokenId: string, tokenSecret: string, fetcher: typeof fetch = fetch) {
  const auth = `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
  const call = async (method: string, path: string) => {
    const res = await fetcher(`https://api.mux.com/video/v1/${path}`, {
      method,
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Mux API ${method} ${path.split("/")[0]} returned HTTP ${res.status}`);
    return res.status === 204 ? null : (await res.json()).data;
  };
  return {
    /** `GET /playback-ids/:id` names the asset a playback id belongs to. */
    lookupAsset: async (playbackId: string) => {
      const data = await call("GET", `playback-ids/${encodeURIComponent(playbackId)}`) as { object?: { type?: string; id?: string } } | null;
      const id = data?.object?.type === "asset" ? data.object.id : undefined;
      if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("playback id does not belong to an asset");
      return id;
    },
    deleteAsset: async (assetId: string) => { await call("DELETE", `assets/${encodeURIComponent(assetId)}`); },
  };
}
