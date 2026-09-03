/**
 * Tap-target floors (24×24 globally, 44×44 mid-practice) and closed-dialog
 * unmounting so dismissed copy cannot linger in the accessibility tree.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("button primitives meet 44px", () => {
  it("keeps every Button size at min-h-11", () => {
    const src = read("client/src/components/ui/button.tsx");
    assert.match(src, /default: "min-h-11 /);
    assert.match(src, /sm: "min-h-11 /);
    assert.match(src, /icon: "h-11 w-11 min-h-11 min-w-11"/);
  });
});

describe("widget hit targets are at least 24px", () => {
  it("sizes checkbox, radio, switch, and slider thumb to 24px", () => {
    assert.match(read("client/src/components/ui/checkbox.tsx"), /h-6 w-6 min-h-6 min-w-6/);
    assert.match(read("client/src/components/ui/radio-group.tsx"), /h-6 w-6 min-h-6 min-w-6/);
    assert.match(read("client/src/components/ui/switch.tsx"), /min-h-6/);
    assert.match(read("client/src/components/ui/slider.tsx"), /h-6 w-6 min-h-6 min-w-6/);
  });

  it("sizes sheet, toast, and select close/triggers to 44px", () => {
    assert.match(read("client/src/components/ui/sheet.tsx"), /h-11 w-11 min-h-11 min-w-11/);
    assert.match(read("client/src/components/ui/toast.tsx"), /h-11 w-11 min-h-11 min-w-11/);
    assert.match(read("client/src/components/ui/select.tsx"), /min-h-11 w-full/);
  });
});

describe("mid-practice controls are 44×44", () => {
  it("sizes guided exit and does not collapse idle transport to 0 height", () => {
    const src = read("client/src/pages/GuidedSession.tsx");
    assert.match(src, /data-testid="button-exit-guided"/);
    assert.match(src, /data-testid="button-exit-guided-idle"/);
    assert.match(src, /min-h-11 min-w-11/);
    const transport = src.slice(src.indexOf("data-testid=\"guided-transport\""));
    assert.equal(
      /h-0 overflow-hidden/.test(transport.slice(0, 400)),
      false,
      "idle transport still collapses to 0px and fails tap-target audits",
    );
    assert.match(src, /aria-hidden=\{!chromeVisible\}/);
  });

  it("sizes the timer-only exit control", () => {
    const src = read("client/src/pages/Practice.tsx");
    assert.match(src, /data-testid="button-exit-timer"/);
    assert.match(src, /min-h-11 min-w-11/);
  });
});

describe("closed dialogs leave the accessibility tree", () => {
  it("does not keep closed animate-out on dialog overlays (Presence stall)", () => {
    const alert = read("client/src/components/ui/alert-dialog.tsx");
    const dialog = read("client/src/components/ui/dialog.tsx");
    const sheet = read("client/src/components/ui/sheet.tsx");
    assert.equal(alert.includes("data-[state=closed]:animate-out"), false);
    assert.equal(dialog.includes("data-[state=closed]:animate-out"), false);
    assert.equal(sheet.includes("data-[state=closed]:animate-out"), false);
  });

  it("unmounts the leave-session dialog and restores focus to the exit control", () => {
    const src = read("client/src/pages/GuidedSession.tsx");
    assert.match(src, /Leave the session\?/);
    assert.match(src, /\{confirmExit \? \(/);
    assert.match(src, /exitTriggerRef/);
    assert.match(src, /onCloseAutoFocus/);
    assert.match(src, /node\?\.focus\(\)/);
  });

  it("unmounts mood check-in content when closed", () => {
    const src = read("client/src/components/MoodCheckIn.tsx");
    assert.match(src, /\{open \? \(/);
  });

  it("removes dismissed toasts quickly instead of leaving them for ~16 minutes", () => {
    const src = read("client/src/hooks/use-toast.ts");
    assert.match(src, /TOAST_REMOVE_DELAY = 400/);
    assert.equal(src.includes("1000000"), false);
  });
});
