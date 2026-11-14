/**
 * Legal / support links shown in chrome and on /plus.
 *
 * Cancel is only meaningful while billing can sell a subscription. When it is
 * omitted, callers must not leave a blank separator or an empty <a> — that
 * produced "See Privacy, Terms, and ." and "Privacy · Terms · · Health".
 */

export type LegalFooterLink = {
  href: string;
  label: string;
  testId?: string;
};

/** Drop any entry whose label would render as an empty accessible name. */
export function withLabeledLinks(links: LegalFooterLink[]): LegalFooterLink[] {
  return links.filter((link) => link.label.trim().length > 0);
}

/**
 * Sidebar / chrome footer. Cancel sits between Terms and Health only when
 * billing is on; separators are applied by the caller after this list.
 */
export function chromeLegalFooterLinks(billingEnabled: boolean): LegalFooterLink[] {
  return withLabeledLinks([
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    ...(billingEnabled
      ? [{ href: "/cancel", label: "Cancel", testId: "footer-cancel" } satisfies LegalFooterLink]
      : []),
    { href: "/health-disclaimer", label: "Health" },
    { href: "/help", label: "Help", testId: "footer-help" },
  ]);
}

/**
 * "/plus" closing sentence: Privacy, Terms, and Cancel — or Help when Cancel
 * is not offered, so the third link always has a visible label.
 */
export function plusSeeAlsoLinks(billingEnabled: boolean): LegalFooterLink[] {
  return withLabeledLinks([
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    billingEnabled
      ? { href: "/cancel", label: "Cancel", testId: "plus-see-cancel" }
      : { href: "/help", label: "Help", testId: "plus-see-help" },
  ]);
}
