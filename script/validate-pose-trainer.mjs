/**
 * Validate pose trainer demos — human figure giving training.
 * Usage: node script/validate-pose-trainer.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:5000";
const OUT = "/opt/cursor/artifacts/pose-trainer-validation";
mkdirSync(OUT, { recursive: true });

const findings = [];

function note(ok, msg, extra = {}) {
  findings.push({ ok, msg, ...extra });
  console.log(`${ok ? "OK" : "FAIL"}  ${msg}${extra.detail ? ` — ${extra.detail}` : ""}`);
}

async function validatePose(page, slug) {
  // App uses hash routing (see App.tsx useAppHashLocation).
  const url = `${BASE}/#/asanas/${slug}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector(`[data-testid="demo-mode-${slug}"]`, { timeout: 20000 });

  const label = await page.locator(`[data-testid="demo-mode-${slug}"]`).locator("span").first().innerText();
  const hero = page.locator(`[data-testid="demo-hero-${slug}"]`);
  await hero.waitFor({ state: "visible", timeout: 15000 });

  const humanSlug = await hero.getAttribute("data-human-slug");
  const momentum = await hero.getAttribute("data-momentum");
  const badge = await hero.locator("span").last().innerText().catch(() => "");

  await page.screenshot({ path: path.join(OUT, `${slug}-idle.png`), fullPage: false });

  const watchBtn = page.locator(`[data-testid="button-watch-demo-${slug}"]`);
  note(await watchBtn.isVisible(), `${slug}: Watch trainer demo CTA visible`);
  await watchBtn.click();
  await page.waitForTimeout(1200);

  const step0 = page.locator(`[data-testid="demo-step-${slug}-0"]`);
  note(await step0.isVisible(), `${slug}: narration steps appear`);

  await page.waitForTimeout(3500);
  const afterMomentum = await hero.getAttribute("data-momentum");
  const afterHuman = await hero.getAttribute("data-human-slug");
  await page.screenshot({ path: path.join(OUT, `${slug}-playing.png`), fullPage: false });

  note(
    label.toLowerCase().includes("human trainer") || label.toLowerCase().includes("trainer"),
    `${slug}: human trainer chrome`,
    { detail: label },
  );
  note(!!(afterHuman || humanSlug), `${slug}: human illustration stage`, {
    detail: `human=${afterHuman || humanSlug}`,
  });
  note(
    !!(afterMomentum || momentum)?.includes("figure-momentum"),
    `${slug}: trainer body momentum`,
    { detail: afterMomentum || momentum },
  );
  note(/trainer demo/i.test(badge), `${slug}: Trainer demo badge`, { detail: badge });

  const imgs = hero.locator("img");
  const imgCount = await imgs.count();
  let broken = 0;
  for (let i = 0; i < imgCount; i++) {
    const nat = await imgs.nth(i).evaluate((el) => ({
      w: el.naturalWidth,
      complete: el.complete,
    }));
    if (!nat.complete || nat.w === 0) broken++;
  }
  note(imgCount > 0 && broken === 0, `${slug}: human artwork renders`, {
    detail: `imgs=${imgCount} broken=${broken}`,
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(`${BASE}/healthz`, { waitUntil: "domcontentloaded", timeout: 60000 });
  note((await page.textContent("body"))?.includes("ok"), "healthz ok");

  // Skip marketing / onboarding gates so pose pages render for validation.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem("sadhana.welcome.seen", "1");
    localStorage.setItem("sadhana.onboarding.done", "1");
  });

  // Nested path + absolute asset base: JS must load (not HTML MIME error).
  await page.goto(`${BASE}/asanas/tadasana`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(500);
  const mimeBroken = await page.evaluate(() => document.querySelectorAll("[data-testid]").length === 0);
  note(!mimeBroken, "nested path /asanas/tadasana boots SPA (asset base path)");

  for (const slug of ["tadasana", "vrksasana", "virabhadrasana-ii", "balasana"]) {
    await validatePose(page, slug);
  }

  // Guided uses the same PoseTrainerStage; smoke-navigate and screenshot the gate.
  try {
    await page.goto(`${BASE}/#/asanas/tadasana`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector('[data-testid="button-practice-now"]', { timeout: 15000 });
    await page.locator('[data-testid="button-practice-now"]').click({ timeout: 15000 });
    await page.waitForFunction(() => location.hash.includes("/guided"), { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, "guided-tadasana.png"), fullPage: false });
    note(
      (await page.locator('[data-testid="button-begin-guided"]').count()) > 0 ||
        (await page.locator('[data-testid="guided-hero"]').count()) > 0,
      "guided session route reachable from Practice now",
    );
  } catch (err) {
    note(false, "guided session route reachable from Practice now", {
      detail: err instanceof Error ? err.message.split("\n")[0] : String(err),
    });
  }

  const failed = findings.filter((f) => !f.ok);
  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ base: BASE, failed: failed.length, findings }, null, 2));
  if (failed.length) process.exitCode = 1;
} finally {
  await browser.close();
}
