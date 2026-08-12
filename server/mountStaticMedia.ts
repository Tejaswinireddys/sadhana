/**
 * Serve narration audio under /audio (and legacy /voice) with real files or
 * JSON 404 — never the SPA HTML shell.
 */
import express, { type Express } from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson404 } from "./json404";

function moduleDir(): string {
  // ESM (tsx/dev) uses import.meta; the production CJS bundle defines __dirname.
  try {
    if (typeof import.meta !== "undefined" && import.meta.dirname) return import.meta.dirname;
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (globalThis as any).__dirname as string | undefined;
    if (typeof d === "string") return d;
  } catch {
    /* ignore */
  }
  return dirname(fileURLToPath(import.meta.url));
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

export function mountStaticMedia(app: Express) {
  const dir = voiceDir();
  if (!dir) {
    // Still register JSON 404s so missing mounts don't fall through to HTML.
    app.use("/audio", (_req, res) => sendJson404(res, "Audio not found"));
    app.use("/voice", (_req, res) => sendJson404(res, "Audio not found"));
    return;
  }

  const staticOpts: Parameters<typeof express.static>[1] = {
    fallthrough: true,
    index: false,
    maxAge: "7d",
  };

  // Canonical audio route + legacy /voice alias (same files on disk).
  app.use("/audio", express.static(dir, staticOpts));
  app.use("/voice", express.static(dir, staticOpts));

  app.use("/audio", (_req, res) => sendJson404(res, "Audio not found"));
  app.use("/voice", (_req, res) => sendJson404(res, "Audio not found"));
}
