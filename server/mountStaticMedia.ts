/**
 * Serve narration audio under /audio (and legacy /voice) with real files or
 * JSON 404 — never the SPA HTML shell.
 *
 * Layout on disk:
 *   client/public/voice/pose-{slug}.mp3          → /audio/pose-{slug}.mp3
 *   client/public/voice/human/pose-{slug}.mp3    → /audio/human/pose-{slug}.mp3
 *   .data/tts-cache/pose-{slug}.mp3              → /audio/tts/pose-{slug}.mp3
 */
import express, { type Express } from "express";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson404 } from "./json404";

function moduleDir(): string {
  // In the CJS production bundle `import.meta` is emptied by esbuild, so
  // both `.dirname` and `.url` can be undefined here. This is only ever a
  // third-choice fallback candidate (the cwd-based paths normally match),
  // so fail soft to cwd instead of crashing the whole process on boot.
  try {
    if (typeof import.meta !== "undefined" && import.meta.dirname) return import.meta.dirname;
    if (typeof import.meta !== "undefined" && import.meta.url) {
      return dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    /* ignore */
  }
  return process.cwd();
}

function voiceDir(): string | null {
  const candidates = [
    resolve(process.cwd(), "client", "public", "voice"),
    resolve(process.cwd(), "dist", "public", "voice"),
    resolve(moduleDir(), "public", "voice"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function ttsCacheDir(): string {
  const dir = resolve(process.cwd(), ".data", "tts-cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function mountStaticMedia(app: Express) {
  const staticOpts: Parameters<typeof express.static>[1] = {
    fallthrough: true,
    index: false,
    maxAge: "7d",
  };

  // Runtime neural TTS cache (before the catch-all JSON 404).
  app.use("/audio/tts", express.static(ttsCacheDir(), staticOpts));
  app.use("/audio/tts", (_req, res) => sendJson404(res, "Audio not found"));

  const dir = voiceDir();
  if (!dir) {
    app.use("/audio", (_req, res) => sendJson404(res, "Audio not found"));
    app.use("/voice", (_req, res) => sendJson404(res, "Audio not found"));
    return;
  }

  app.use("/audio", express.static(dir, staticOpts));
  app.use("/voice", express.static(dir, staticOpts));

  app.use("/audio", (_req, res) => sendJson404(res, "Audio not found"));
  app.use("/voice", (_req, res) => sendJson404(res, "Audio not found"));
}
