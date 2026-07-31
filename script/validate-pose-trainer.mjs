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

  // Wait until idle shows THIS pose (human slug match or ready video).
  const idleOk = await page
    .waitForFunction(
      (s) => {
        const el = document.querySelector(`[data-testid="demo-hero-${s}"]`);
        if (!el) return false;
        const human = el.getAttribute("data-human-slug");
        if (human) return human === s;
        const v = el.querySelector("video");
        return !!(v && v.readyState >= 2 && v.videoWidth > 0);
      },
      slug,
      { timeout: 20000 },
    )
    .then(() => true)
    .catch(() => false);

  const humanSlug = await hero.getAttribute("data-human-slug");
  const mediaMode = await hero.getAttribute("data-media");
  const video = hero.locator(`video[data-testid="pose-demo-video-${slug}"]`);
  const hasVideoEl = (await video.count()) > 0;
  const videoReady =
    hasVideoEl &&
    (await video.evaluate((v) => v.readyState >= 2 && v.videoWidth > 0).catch(() => false));

  await page.screenshot({ path: path.join(OUT, `${slug}-idle.png`), fullPage: false });

  note(idleOk, `${slug}: idle demo is this pose (not another asana)`, {
    detail: `human=${humanSlug} media=${mediaMode} videoReady=${videoReady}`,
  });

  const watchBtn = page.locator(`[data-testid="button-watch-demo-${slug}"]`);
  note(await watchBtn.isVisible(), `${slug}: Start pose training CTA visible`);
  // How-to steps should be visible before training starts (clear lesson, not a bobbing clip).
  note(
    (await page.locator(`[data-testid="demo-step-${slug}-0"]`).count()) > 0,
    `${slug}: how-to steps visible before start`,
  );

  const idleMedia = await hero.getAttribute("data-media");
  const idleMomentum = await hero.getAttribute("data-momentum");
  note(
    idleMedia === "illustrated" || idleMedia === null,
    `${slug}: idle uses illustrated trainer (not Ken Burns bob)`,
    { detail: `media=${idleMedia} momentum=${idleMomentum}` },
  );

  await watchBtn.click();
  await page.waitForTimeout(1200);

  const step0 = page.locator(`[data-testid="demo-step-${slug}-0"]`);
  note(await step0.isVisible(), `${slug}: narration steps appear`);

  const focusLabel = page.locator(
    `[data-testid="pose-human-focus-label-${slug}"], [data-testid="pose-demo-focus-label-${slug}"]`,
  );
  note(
    (await focusLabel.count()) > 0,
    `${slug}: body-region focus cue while training`,
  );

  const caption = page.locator(`[data-testid="pose-human-caption-${slug}"]`);
  const captionText = (await caption.count()) > 0 ? (await caption.innerText()).trim() : "";
  note(captionText.length > 8, `${slug}: live step caption while training`, {
    detail: captionText.slice(0, 90),
  });

  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, `${slug}-playing.png`), fullPage: false });

  note(
    /training|trainer|learn/i.test(label),
    `${slug}: training chrome`,
    { detail: label },
  );

  // Artwork or video frame must render (not empty).
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
  const playingVideoReady =
    (await video.count()) > 0 &&
    (await video.evaluate((v) => v.readyState >= 2 && v.videoWidth > 0).catch(() => false));
  note(
    (imgCount > 0 && broken === 0) || playingVideoReady || !!humanSlug,
    `${slug}: pose visual renders`,
    { detail: `imgs=${imgCount} broken=${broken} videoReady=${playingVideoReady} human=${await hero.getAttribute("data-human-slug")}` },
  );
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
