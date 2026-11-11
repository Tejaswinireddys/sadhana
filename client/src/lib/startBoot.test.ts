import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the app shell shows a spinner before React replaces the root", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /id="boot-splash"/);
  assert.match(html, /role="status"/);
  assert.match(html, /Loading…/);
});

test("the quiz entrance does not fade in from invisible", () => {
  const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
  const block = css.match(/@keyframes funnel-step-in \{[^}]+\}/);
  assert.ok(block);
  assert.doesNotMatch(block[0], /opacity:\s*0/);
});
