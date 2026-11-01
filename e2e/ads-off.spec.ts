import { test, expect } from "@playwright/test";
import { LEGAL_VERSION } from "../client/src/lib/legal";

/** The default server runs with ADS_ENABLED unset: nobody sees anything ad-related. */
test("with ads off, no slot, script, notice or empty box renders anywhere", async ({ page }) => {
  await page.addInitScript((version) => {
    localStorage.setItem("sadhana.legalAck", JSON.stringify({ version, acceptedAt: new Date().toISOString() }));
    localStorage.setItem("sadhana.welcome.seen", "1");
    const w = window as unknown as { __adSeen: boolean };
    w.__adSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid^="ad-"], ins.adsbygoogle, script[src*="googlesyndication"]')) w.__adSeen = true;
    }).observe(document, { childList: true, subtree: true });
  }, LEGAL_VERSION);
  await page.route(/^https:\/\/([a-z0-9-]+\.)*(mux\.com|litix\.io)\//, (route) => route.abort());
  const thirdParty: string[] = [];
  page.on("request", (req) => { if (/googlesyndication|doubleclick|adtrafficquality/.test(req.url())) thirdParty.push(req.url()); });

  for (const path of ["/", "/classes", "/classes/desk-back-relief"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(await page.evaluate(() => (window as unknown as { __adSeen: boolean }).__adSeen)).toBe(false);
  expect(thirdParty).toEqual([]);
  const config = await page.evaluate(() => JSON.parse(document.getElementById("public-config")?.textContent || "{}"));
  expect(config.ads).toEqual({ enabled: false, provider: "house", adsenseClientId: null, slots: {} });
});
