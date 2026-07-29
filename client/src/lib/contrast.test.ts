import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AA_NORMAL, contrastRatio } from "./contrast";

/**
 * Reads the real tokens out of index.css, so the palette can't drift back below
 * AA without a test failing. The Search page alone had 24 AA failures because
 * brand colours doubled as text colours and nothing checked them.
 */
function readTokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const css = readFileSync(path.resolve("client/src/index.css"), "utf8");
  const darkStart = css.indexOf(".dark");
  const parse = (block: string) => {
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/--([\w-]+):\s*([\d.]+\s+[\d.]+%\s+[\d.]+%)\s*;/g)) {
      out[m[1]] = m[2];
    }
    return out;
  };
  return {
    light: parse(css.slice(0, darkStart)),
    dark: parse(css.slice(darkStart)),
  };
}

const { light, dark } = readTokens();

/** Foreground token → the surfaces it is actually painted on. */
const TEXT_PAIRS: [string, string[]][] = [
  ["foreground", ["background", "card", "popover", "muted"]],
  ["muted-foreground", ["background", "card", "popover", "muted", "sidebar"]],
  ["card-foreground", ["card"]],
  ["popover-foreground", ["popover"]],
  ["sidebar-foreground", ["sidebar"]],
  ["accent-foreground", ["accent"]],
  // Brand colours used as text: badges ("Beginner"), captions ("Best for ·"), links.
  ["primary", ["background", "card", "popover", "sidebar"]],
  ["secondary", ["background", "card", "popover", "sidebar"]],
  ["destructive", ["background", "card"]],
  // Labels sitting on a filled brand button.
  ["primary-foreground", ["primary"]],
  ["secondary-foreground", ["secondary"]],
  ["destructive-foreground", ["destructive"]],
  ["sidebar-primary-foreground", ["sidebar-primary"]],
];

for (const [mode, tokens] of [["light", light], ["dark", dark]] as const) {
  describe(`palette contrast — ${mode} mode`, () => {
    for (const [fg, backgrounds] of TEXT_PAIRS) {
      for (const bg of backgrounds) {
        it(`${fg} on ${bg} meets AA (${AA_NORMAL}:1)`, () => {
          const fgValue = tokens[fg];
          const bgValue = tokens[bg];
          assert.ok(fgValue, `missing --${fg} in ${mode}`);
          assert.ok(bgValue, `missing --${bg} in ${mode}`);
          const ratio = contrastRatio(fgValue, bgValue);
          assert.ok(
            ratio >= AA_NORMAL,
            `--${fg} on --${bg} is ${ratio.toFixed(2)}:1, needs ${AA_NORMAL}:1`,
          );
        });
      }
    }
  });
}
