/**
 * Manual verification: guided session pose video should track the spoken
 * step, using the freshly generated timing windows.
 */
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:5000";
const SLUG = process.argv[3] || "tadasana";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
page.on("console", (msg) => {
  if (msg.text().includes("[verify]")) console.log(msg.text());
});

// Skip the welcome/legal onboarding gates so the deep link renders directly.
await page.addInitScript(() => {
  localStorage.setItem(
    "sadhana.legalAck",
    JSON.stringify({ version: "2026-07-31", acceptedAt: new Date().toISOString() }),
  );
  localStorage.setItem("sadhana.welcome.seen", "1");
  localStorage.setItem("sadhana.onboarding.done", "1");
});

// Build a solo practice session with just this one pose via the app's own
// routes isn't trivial without UI flow, so drive AsanaDetail's "Start
// pose training" (PoseExplanation) which uses the *same* video-scrub logic
// (PoseTrainerStage + videoTimeForNarration) fed by the same timing file.
await page.goto(`${BASE}/asanas/${SLUG}`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector(`[data-testid="demo-hero-${SLUG}"]`, { timeout: 20000 });

const watchBtn = page.locator(`[data-testid="button-watch-demo-${SLUG}"]`);
await watchBtn.waitFor({ state: "visible", timeout: 15000 });
await watchBtn.click();
await page.waitForTimeout(500);

// Unmute + play the audio element that drives narration timing, and sample
// (audio.currentTime, active step index/caption, video.currentTime) a few
// times across playback.
const samples = await page.evaluate(async (slug) => {
  const audio = document.querySelector("audio");
  const video = document.querySelector(`video[data-testid="pose-demo-video-${slug}"]`);
  if (!audio) return { error: "no audio element found" };
  audio.muted = false;
  try {
    await audio.play();
  } catch (e) {
    return { error: `audio.play() failed: ${e}` };
  }
  const out = [];
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const stepEl = document.querySelector(`[data-testid^="demo-step-${slug}-"].active, [data-testid^="demo-step-${slug}-"][data-active="true"]`);
    out.push({
      t: +audio.currentTime.toFixed(2),
      videoT: video ? +video.currentTime.toFixed(2) : null,
      paused: audio.paused,
      duration: +audio.duration.toFixed(2),
    });
  }
  return { out };
}, SLUG);

console.log(JSON.stringify(samples, null, 2));
await browser.close();
