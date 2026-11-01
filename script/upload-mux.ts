import "dotenv/config";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { parseArgs } from "node:util";
import { ASANAS, PATHWAYS } from "../client/src/data/content";
import { uploadToMux } from "../server/muxUpload";
import { initStorage, pool } from "../server/storage";
import { upsertPosePlayback } from "../server/poseStreamStore";

async function main() {
  const { values } = parseArgs({ options: {
    kind: { type: "string" }, slug: { type: "string" }, file: { type: "string" },
    resume: { type: "string" }, captions: { type: "string" },
  } });
  const { kind, slug, file, resume, captions } = values;
  const catalog = kind === "pose" ? ASANAS : kind === "class" ? PATHWAYS : [];
  if (!slug || !catalog.some((row) => row.slug === slug) || (!file && !resume)) {
    throw new Error("Usage: npm run upload:mux -- --kind pose|class --slug <catalog-slug> --file <video> [--captions <English.vtt>] [--resume <upload-id>]");
  }
  if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET are required");
  const info = file && !resume ? await stat(file) : null;
  if (info && (!info.isFile() || info.size === 0)) throw new Error("Choose a nonempty video file");
  if (captions && !/^\uFEFF?WEBVTT(?:\s|$)/.test(await readFile(captions, "utf8"))) throw new Error("Captions must be WebVTT");
  const key = kind === "class" ? `class-${slug}` : slug;
  const records = resolve(".data/mux-uploads");
  await mkdir(records, { recursive: true });
  const recordPath = resolve(records, `${key}.json`);
  const result = await uploadToMux({
    tokenId: process.env.MUX_TOKEN_ID, tokenSecret: process.env.MUX_TOKEN_SECRET,
    ...(info ? { body: Readable.toWeb(createReadStream(file!)) as BodyInit, size: info.size } : {}),
    resumeUploadId: resume,
    onCreated: async (uploadId) => { console.log(`Created Mux upload ${uploadId}; streaming file and waiting for processing.`); await writeFile(recordPath, JSON.stringify({ kind, slug, uploadId, status: "processing" }, null, 2)); },
  });
  let captionsUrl: string | null = null;
  if (captions) {
    const targetDir = resolve("client/public/captions/uploads");
    await mkdir(targetDir, { recursive: true });
    await copyFile(captions, resolve(targetDir, `${key}-${result.playbackId}.vtt`));
    captionsUrl = `/captions/uploads/${key}-${result.playbackId}.vtt`;
  }
  initStorage();
  try {
    await upsertPosePlayback(key, result.playbackId, "mux", captionsUrl);
    await writeFile(recordPath, JSON.stringify({ ...result, kind, slug, captionsUrl, status: "ready" }, null, 2));
  } finally { await pool?.end(); }
  console.log(`Saved ${kind} ${slug}: playbackId=${result.playbackId}. Upload does not publish a reviewed teaching demonstration.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Mux upload failed"); process.exitCode = 1; });
