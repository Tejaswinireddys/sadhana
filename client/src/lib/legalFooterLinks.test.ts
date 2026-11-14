import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  chromeLegalFooterLinks,
  plusSeeAlsoLinks,
  withLabeledLinks,
} from "./legalFooterLinks.ts";

describe("legal footer links", () => {
  it("strips links whose label would be an empty accessible name", () => {
    const cleaned = withLabeledLinks([
      { href: "/privacy", label: "Privacy" },
      { href: "/cancel", label: "" },
      { href: "/cancel", label: "   " },
      { href: "/help", label: "Help" },
    ]);
    assert.deepEqual(
      cleaned.map((l) => l.label),
      ["Privacy", "Help"],
    );
  });

  it("plus see-also always has three labelled links (Cancel or Help)", () => {
    const withBilling = plusSeeAlsoLinks(true);
    assert.equal(withBilling.length, 3);
    assert.ok(withBilling.every((l) => l.label.trim().length > 0));
    assert.equal(withBilling[2]?.label, "Cancel");

    const withoutBilling = plusSeeAlsoLinks(false);
    assert.equal(withoutBilling.length, 3);
    assert.ok(withoutBilling.every((l) => l.label.trim().length > 0));
    assert.equal(withoutBilling[2]?.label, "Help");
    assert.equal(withoutBilling[2]?.href, "/help");
  });

  it("chrome footer never leaves a blank Cancel slot when billing is off", () => {
    const off = chromeLegalFooterLinks(false).map((l) => l.label);
    assert.deepEqual(off, ["Privacy", "Terms", "Health", "Help"]);
    const on = chromeLegalFooterLinks(true).map((l) => l.label);
    assert.deepEqual(on, ["Privacy", "Terms", "Cancel", "Health", "Help"]);
  });

  it("Plus and AppLayout render from the labelled-link helpers (no empty Cancel slot)", () => {
    const plus = readFileSync(resolve("client/src/pages/Plus.tsx"), "utf8");
    const layout = readFileSync(resolve("client/src/components/AppLayout.tsx"), "utf8");
    assert.match(plus, /plusSeeAlsoLinks/);
    assert.match(layout, /chromeLegalFooterLinks/);
    // The old pattern left "and ." / "· ·" when BILLING_ENABLED was false.
    assert.doesNotMatch(
      plus,
      /and \{\s*\n?\s*\{BILLING_ENABLED && \(\s*<Link href="\/cancel"/,
    );
  });
});
