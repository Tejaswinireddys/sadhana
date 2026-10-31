/**
 * The theme file is the only place color, type, space, radius, and shadow
 * values are defined. Primitives and the three refactored call sites read it.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

describe("theme.css is the token source", () => {
  const theme = read("client/src/theme.css");
  const index = read("client/src/index.css");

  it("is imported by the app stylesheet and not duplicated there", () => {
    assert.match(index, /@import\s+"\.\/theme\.css"/);
    assert.equal(index.includes("--primary:"), false);
    assert.equal(index.includes("--font-sans:"), false);
    assert.equal(index.includes("--radius:"), false);
  });

  it("defines the calm earth palette for both modes", () => {
    for (const name of [
      "--primary:",
      "--secondary:",
      "--background:",
      "--foreground:",
      "--card:",
      "--destructive:",
      "--sage:",
      "--leaf:",
      "--mist:",
      "--sand:",
      "--ink:",
      "--clay:",
      "--overlay:",
    ]) {
      assert.ok(theme.includes(name), `missing ${name}`);
    }
    assert.equal(theme.match(/--primary:/g)?.length, 2);
    assert.match(theme, /--primary:\s*175 72% 26%/);
    assert.match(theme, /--primary:\s*173 48% 48%/);
  });

  it("defines type, space, radius, and shadow scales", () => {
    for (const name of [
      "--text-2xs: 0.625rem",
      "--text-xs: 0.75rem",
      "--text-sm: 0.875rem",
      "--text-base: 1rem",
      "--text-lg: 1.125rem",
      "--text-xl: 1.25rem",
      "--text-2xl: 1.5rem",
      "--text-3xl: 1.875rem",
      "--text-4xl: 2.25rem",
      "--font-weight-regular: 400",
      "--font-weight-medium: 500",
      "--font-weight-semibold: 600",
      "--font-sans:",
      "--font-serif:",
      "--space-1: 0.25rem",
      "--space-4: 1rem",
      "--space-6: 1.5rem",
      "--space-11: 2.75rem",
      "--control-height: var(--space-11)",
      "--control-height-lg: var(--space-12)",
      "--nav-item-min-height: var(--space-14)",
      "--radius: 1.1rem",
      "--radius-sm: 0.55rem",
      "--radius-md:",
      "--radius-lg: 1.5rem",
      "--radius-full: 9999px",
      "--shadow-md: var(--surface-shadow)",
      "--shadow-lg: var(--surface-shadow-lg)",
      "--tracking-display: -0.02em",
    ]) {
      assert.ok(theme.includes(name), `missing ${name}`);
    }
  });
});

describe("Tailwind utilities read the theme", () => {
  const config = read("tailwind.config.ts");

  it("points type, space, radius, and shadow utilities at theme variables", () => {
    assert.match(config, /md: "var\(--radius-md\)"/);
    assert.match(config, /full: "var\(--radius-full\)"/);
    assert.match(config, /sm: \["var\(--text-sm\)"/);
    assert.match(config, /"2xs": \["var\(--text-2xs\)"/);
    assert.match(config, /medium: "var\(--font-weight-medium\)"/);
    assert.match(config, /"4": "var\(--space-4\)"/);
    assert.match(config, /"11": "var\(--control-height\)"/);
    assert.match(config, /"14": "var\(--nav-item-min-height\)"/);
    assert.match(config, /soft: "var\(--shadow-md\)"/);
    assert.match(config, /"soft-lg": "var\(--shadow-lg\)"/);
  });
});

describe("primitives consume the theme", () => {
  it("keeps Button on the control, type, and sage tokens", () => {
    const src = read("client/src/components/ds/Button.tsx");
    assert.match(src, /min-h-11 px-4 py-2/);
    assert.match(src, /rounded-md text-sm font-medium/);
    assert.match(src, /bg-primary text-primary-foreground/);
    assert.match(src, /h-11 w-11 min-h-11 min-w-11/);
    assert.match(read("client/src/components/ui/button.tsx"), /from "@\/components\/ds\/Button"/);
  });

  it("keeps Card on the sand surface, radius, and shadow", () => {
    const src = read("client/src/components/ds/Card.tsx");
    assert.match(src, /rounded-2xl border border-card-border bg-card text-card-foreground shadow-soft/);
    assert.match(src, /p-6/);
    assert.match(src, /text-2xl font-semibold/);
    assert.match(read("client/src/components/ui/card.tsx"), /from "@\/components\/ds\/Card"/);
  });

  it("styles Tag, Tabs, and Modal from the same scale", () => {
    const tag = read("client/src/components/ds/Tag.tsx");
    assert.match(tag, /rounded-full/);
    assert.match(tag, /text-xs font-semibold/);
    assert.match(tag, /bg-primary text-primary-foreground/);

    const tabs = read("client/src/components/ds/Tabs.tsx");
    assert.match(tabs, /min-h-11/);
    assert.match(tabs, /rounded-md bg-muted/);
    assert.match(tabs, /data-\[state=active\]:shadow-soft/);

    const modal = read("client/src/components/ds/Modal.tsx");
    assert.match(modal, /hsl\(var\(--overlay\)\/0\.55\)/);
    assert.match(modal, /rounded-lg/);
    assert.match(modal, /bg-card p-6/);
    assert.match(modal, /shadow-soft-lg/);
    assert.match(modal, /h-11 w-11/);
  });

  it("renders the app bar with BottomNav", () => {
    const nav = read("client/src/components/ds/BottomNav.tsx");
    assert.match(nav, /min-h-14/);
    assert.match(nav, /text-2xs font-medium/);
    assert.match(nav, /border-border bg-background\/95/);
    assert.match(nav, /aria-current=\{item\.active \? "page" : undefined\}/);
    assert.match(nav, /testId = "mobile-bottom-nav"/);
    const layout = read("client/src/components/AppLayout.tsx");
    assert.match(layout, /<BottomNav/);
    assert.match(layout, /testId: `mobile-nav-\$\{item\.label\.toLowerCase\(\)\}`/);
  });
});
