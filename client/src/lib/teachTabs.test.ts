import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { nextTeachTab } from "./teachTabs.ts";

const ids = ["form", "breath", "align", "feel"];

describe("teaching tab keyboard", () => {
  it("moves to Breath with one Right arrow from Form", () => {
    assert.equal(nextTeachTab(ids, "form", "ArrowRight"), "breath");
  });

  it("wraps and honours Home and End", () => {
    assert.equal(nextTeachTab(ids, "feel", "ArrowRight"), "form");
    assert.equal(nextTeachTab(ids, "form", "ArrowLeft"), "feel");
    assert.equal(nextTeachTab(ids, "breath", "Home"), "form");
    assert.equal(nextTeachTab(ids, "breath", "End"), "feel");
  });

  it("ignores keys that are not tab navigation", () => {
    assert.equal(nextTeachTab(ids, "breath", "Enter"), null);
    assert.equal(nextTeachTab([], "breath", "ArrowRight"), null);
  });
});

describe("teaching tab markup", () => {
  const tabs = readFileSync(resolve("client/src/components/TeachTopicTabs.tsx"), "utf8");
  const rail = readFileSync(resolve("client/src/components/PoseExplanation.tsx"), "utf8");
  const tips = readFileSync(resolve("client/src/components/PoseTipsSheet.tsx"), "utf8");

  it("wires aria and selects on pointerdown so the first tap is not lost", () => {
    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /aria-controls=\{panelIdFor\(id\)\}/);
    assert.match(tabs, /aria-labelledby=\{tabId\(tab\)\}/);
    assert.match(tabs, /tabIndex=\{selected \? 0 : -1\}/);
    assert.match(tabs, /onPointerDown/);
    assert.match(tabs, /nextTeachTab/);
  });

  it("is what the pose page and the practice tips sheet render", () => {
    assert.match(rail, /TeachTopicTabs/);
    assert.match(rail, /pose-teach-tab-/);
    assert.match(tips, /TeachTopicTabs/);
    assert.match(tips, /pose-tips-tab-/);
  });
});
