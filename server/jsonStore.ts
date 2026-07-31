/**
 * Tiny file-backed Map store for push/billing/buddy when Postgres isn't required.
 * Survives process restarts on the same disk; Render ephemeral disks still reset.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = resolve(process.cwd(), ".data");

function pathFor(name: string) {
  return resolve(DIR, `${name}.json`);
}

export function loadMap<T>(name: string): Map<string, T> {
  try {
    const p = pathFor(name);
    if (!existsSync(p)) return new Map();
    const obj = JSON.parse(readFileSync(p, "utf8")) as Record<string, T>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function saveMap<T>(name: string, map: Map<string, T>) {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(pathFor(name), JSON.stringify(Object.fromEntries(map)));
  } catch (e) {
    console.warn(`[jsonStore] failed to persist ${name}:`, (e as Error).message);
  }
}
