/**
 * `npm run class:upload`: one command from a local video file to a published
 * class. Pure apart from injected dependencies (Mux, the file system, the
 * store), so the rules are unit-tested with Mux mocked.
 *
 * 1. Direct-upload the file to Mux — signed playback for Plus, public for
 *    free — asking for video_quality "plus" and falling back to "basic".
 * 2. Wait for the asset to be ready (inside `uploadToMux`).
 * 3. Captions: an https .vtt URL becomes a subtitle track; with none, Mux is
 *    asked to auto-generate English subtitles from the audio.
 * 4. Save the class with class:add's own rules (`resolveClassPlayback`,
 *    `buildClassRow`), including chapters and the asset's duration.
 *
 * Logs carry ids only — never tokens, secrets or signed URLs.
 */
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { parseChapters, type ClassChapter } from "../shared/classLibrary";
import type { ClassRow } from "../shared/schema";
import {
  buildClassRow,
  classAddOptionsSchema,
  resolveClassPlayback,
  type MuxAssetApi,
} from "./classAdd";
import type { MuxUploadResult, MuxVideoQuality } from "./muxUpload";

export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".mkv", ".webm"] as const;

export const classUploadOptionsSchema = classAddOptionsSchema
  .omit({ asset: true, removePublic: true })
  .extend({
    file: z.string().trim().min(1, "--file is required"),
    chapters: z.string().trim().min(1).optional(),
    captions: z.string().trim().min(1).optional(),
    thumbnailTime: z.coerce.number().int().min(0).max(24 * 60 * 60).optional(),
  });
export type ClassUploadOptions = z.infer<typeof classUploadOptionsSchema>;

export const CLASS_UPLOAD_USAGE = `Usage: npm run class:upload -- --file ./video.mp4 --title "…" --slug <slug> \\
  --level beginner|intermediate|advanced --tier free|plus --focus "flexibility,back pain" \\
  [--chapters ./chapters.json] [--captions https://…/en.vtt] [--thumbnail-time <sec>] \\
  [--description "…"] [--instructor "…"] [--duration <min>] [--draft] [--dry-run]

Needs MUX_TOKEN_ID and MUX_TOKEN_SECRET (and DATABASE_URL unless --dry-run).
Chapters format: docs/classes.md.`;

export function parseClassUploadArgs(argv: string[]): ClassUploadOptions {
  const { values } = parseArgs({
    args: argv,
    allowPositionals: false,
    options: {
      file: { type: "string" }, title: { type: "string" }, slug: { type: "string" },
      level: { type: "string" }, tier: { type: "string" }, focus: { type: "string" },
      duration: { type: "string" }, description: { type: "string" }, instructor: { type: "string" },
      thumbnail: { type: "string" }, chapters: { type: "string" }, captions: { type: "string" },
      "thumbnail-time": { type: "string" }, draft: { type: "boolean" }, "dry-run": { type: "boolean" },
    },
  });
  const parsed = classUploadOptionsSchema.safeParse({
    ...values,
    focus: values.focus?.split(",").map((tag) => tag.trim()).filter(Boolean),
    thumbnailTime: values["thumbnail-time"],
    dryRun: values["dry-run"],
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue?.path.length ? `--${issue.path.join(".")}: ` : ""}${issue?.message ?? "Invalid arguments"}`);
  }
  return parsed.data;
}

export type CaptionsPlan = { kind: "url"; url: string } | { kind: "generate" };

export type PreparedUpload = { size: number; chapters: ClassChapter[]; captions: CaptionsPlan };

export type UploadFs = {
  stat(path: string): Promise<{ isFile(): boolean; size: number }>;
  readFile(path: string): Promise<string>;
};

/**
 * Everything checked before a byte is uploaded (and all a --dry-run does):
 * the video file, the chapters JSON, and the captions source.
 */
export async function prepareClassUpload(
  options: ClassUploadOptions,
  fs: UploadFs,
  knownPose: (slug: string) => boolean,
): Promise<PreparedUpload> {
  const errors: string[] = [];
  let size = 0;
  if (!VIDEO_EXTENSIONS.includes(extname(options.file).toLowerCase() as (typeof VIDEO_EXTENSIONS)[number])) {
    errors.push(`--file must be a video (${VIDEO_EXTENSIONS.join(", ")})`);
  }
  try {
    const info = await fs.stat(options.file);
    if (!info.isFile() || info.size === 0) errors.push("--file is empty or not a file");
    size = info.size;
  } catch { errors.push(`--file not found: ${options.file}`); }

  let chapters: ClassChapter[] = [];
  if (options.chapters) {
    let json: unknown;
    try { json = JSON.parse(await fs.readFile(options.chapters)); }
    catch (error) { errors.push(`--chapters: ${error instanceof SyntaxError ? `invalid JSON (${error.message})` : `cannot read ${options.chapters}`}`); }
    if (json !== undefined) {
      const parsed = parseChapters(json, { knownPose });
      if (parsed.ok) chapters = parsed.chapters;
      else errors.push(...parsed.errors.map((message) => `--chapters: ${message}`));
    }
  }

  let captions: CaptionsPlan = { kind: "generate" };
  if (options.captions) {
    if (/^https:\/\//i.test(options.captions)) {
      try { captions = { kind: "url", url: new URL(options.captions).toString() }; }
      catch { errors.push("--captions is not a valid URL"); }
    } else {
      // Mux ingests caption tracks only by fetching a public https URL.
      let header = "";
      try { header = (await fs.readFile(options.captions)).slice(0, 16); }
      catch { errors.push(`--captions not found: ${options.captions}`); }
      if (header && !/^﻿?WEBVTT(?:\s|$)/.test(header)) errors.push("--captions must be a WebVTT file");
      else if (header) errors.push("--captions: Mux only accepts captions from a public https URL. Host the .vtt and pass its URL, or omit --captions for auto-generated English captions.");
    }
  }

  if (errors.length) throw new Error(errors.join("\n"));
  return { size, chapters, captions };
}

export type UploadDeps = {
  upload(options: { isPlus: boolean; videoQuality: MuxVideoQuality }): Promise<MuxUploadResult>;
  api: MuxAssetApi;
  save(row: ReturnType<typeof buildClassRow>): Promise<ClassRow>;
  log(message: string): void;
  now?: () => Date;
};

/** Default poster: a tenth of the way in (past any black lead-in), capped at 30s. */
export function defaultThumbnailTime(durationSec: number | null): number | null {
  if (!durationSec || durationSec <= 0) return null;
  return Math.min(30, Math.floor(durationSec / 10));
}

export async function runClassUpload(options: ClassUploadOptions, prepared: PreparedUpload, deps: UploadDeps): Promise<ClassRow> {
  const isPlus = options.tier === "plus";
  const uploaded = await deps.upload({ isPlus, videoQuality: "plus" });
  deps.log(`Asset ${uploaded.assetId} ready (${uploaded.playbackPolicy}, video_quality ${uploaded.videoQuality})`);

  const asset = await deps.api.getAsset(uploaded.assetId);
  const durationSec = typeof asset.duration === "number" && asset.duration > 0 ? asset.duration : null;

  if (prepared.chapters.length && durationSec) {
    const checked = parseChapters(prepared.chapters, { durationSec });
    if (!checked.ok) {
      throw new Error(`Chapters do not fit the ${Math.floor(durationSec)}s video (asset ${uploaded.assetId} is uploaded; fix chapters.json and run class:add -- --asset ${uploaded.assetId}):\n${checked.errors.join("\n")}`);
    }
  }

  if (prepared.captions.kind === "url") {
    const track = await deps.api.addCaptionsTrack?.(uploaded.assetId, prepared.captions.url);
    deps.log(`Captions track ${track?.id ?? "(pending)"} added from the given URL`);
  } else {
    const audio = asset.tracks?.find((track) => track.type === "audio");
    if (audio && deps.api.generateSubtitles) {
      await deps.api.generateSubtitles(uploaded.assetId, audio.id);
      deps.log("Requested auto-generated English captions");
    } else {
      deps.log("Warning: no audio track found, so no captions were requested");
    }
  }

  const playback = await resolveClassPlayback(deps.api, { asset: uploaded.assetId, tier: options.tier, removePublic: false, dryRun: false });
  const thumbnailTimeSec = options.thumbnailTime ?? defaultThumbnailTime(durationSec);
  const row = buildClassRow(
    { ...options, asset: uploaded.assetId, removePublic: false },
    playback,
    deps.now?.() ?? new Date(),
    { chapters: prepared.chapters, thumbnailTimeSec },
  );
  const saved = await deps.save(row);
  deps.log(`Saved /classes/${saved.slug} (${saved.tier}, ${saved.playbackPolicy}, playback id ${saved.muxPlaybackId}, ${prepared.chapters.length} chapters)`);
  return saved;
}
