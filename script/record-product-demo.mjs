/**
 * Record the "See it in practice" product montage from the real running app.
 *
 * Covers the shipped evaluation walkthrough: Today → Adaptive → guided player →
 * programs → pose coach → teachers → household → settings/trust → Plus →
 * challenges → legal → dark mode. Scene boundaries land in scenes.json so the
 * encoder can place matching captions.
 *
 * Usage:
 *   npm run dev                          # in another terminal (port 5000)
 *   node script/record-product-demo.mjs
 *   node script/record-product-demo.mjs --base http://localhost:5000 --out /tmp/demo
 *
 * Then encode with: node script/encode-product-demo.mjs --in /tmp/demo
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf("--base", "http://localhost:5000");
const OUT = argOf("--out", "/tmp/demo");
const WIDTH = 1280;
const HEIGHT = 720;

mkdirSync(OUT, { recursive: true });

/** Draws a soft pointer dot that follows real mouse moves, so clicks are legible on video. */
const cursorScript = () => {
  const install = () => {
    if (document.getElementById("__demo_cursor")) return;
    const dot = document.createElement("div");
    dot.id = "__demo_cursor";
    dot.style.cssText = [
      "position:fixed",
      "left:0",
      "top:0",
      "width:22px",
      "height:22px",
      "margin:-11px 0 0 -11px",
      "border-radius:9999px",
      "background:rgba(255,255,255,0.55)",
      "border:2px solid rgba(30,30,30,0.55)",
      "box-shadow:0 2px 10px rgba(0,0,0,0.25)",
      "pointer-events:none",
      "z-index:2147483647",
      "transition:transform 90ms ease-out",
      "opacity:0",
    ].join(";");
    document.body.appendChild(dot);
    let shown = false;
    window.addEventListener(
      "mousemove",
      (e) => {
        if (!shown) {
          dot.style.opacity = "1";
          shown = true;
        }
        dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      },
      { passive: true },
    );
    window.addEventListener(
      "mousedown",
      () => {
        dot.style.background = "rgba(255,255,255,0.9)";
        dot.style.transform += " scale(0.75)";
      },
      { passive: true },
    );
    window.addEventListener(
      "mouseup",
      () => {
        dot.style.background = "rgba(255,255,255,0.55)";
      },
      { passive: true },
    );
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
};

const browser = await chromium.launch({
  args: ["--force-color-profile=srgb", "--font-render-hinting=none"],
});
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  recordVideo: { dir: OUT, size: { width: WIDTH, height: HEIGHT } },
  reducedMotion: "no-preference",
});
await ctx.addInitScript(() => {
  localStorage.setItem("sadhana.welcome.seen", "1");
  localStorage.setItem("sadhana.onboarding.done", "1");
  localStorage.setItem("sadhana.practitioner.name", "Maya");
  // Acknowledge current legal version so the consent banner does not cover the demo.
  localStorage.setItem(
    "sadhana.legalAck",
    JSON.stringify({ version: "2026-07-31", acceptedAt: new Date().toISOString() }),
  );
});
await ctx.addInitScript(cursorScript);

const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);

// Playwright starts the video with the first frame, so t0 begins at first paint.
let t0 = 0;
const scenes = [];

/** Runs one labelled scene and records its span for caption placement. */
async function scene(caption, fn) {
  const start = (Date.now() - t0) / 1000;
  try {
    await fn();
  } catch (err) {
    console.warn(`· partial "${caption}": ${err.message.split("\n")[0]}`);
  }
  const end = (Date.now() - t0) / 1000;
  scenes.push({ caption, start, end });
  console.log(`· ${caption}  ${start.toFixed(1)}s → ${end.toFixed(1)}s`);
}

/** Glide the pointer so movement reads as human, then click. */
async function humanClick(locator, { steps = 18, settle = 450 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new Error("no box for click target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await wait(200);
  await page.mouse.down();
  await wait(80);
  await page.mouse.up();
  await wait(settle);
}

async function smoothScroll(to, duration = 1100) {
  await page.evaluate(
    ([target, dur]) => {
      const scroller =
        document.scrollingElement && document.scrollingElement.scrollHeight > window.innerHeight
          ? document.scrollingElement
          : document.querySelector("main")?.parentElement || document.scrollingElement;
      if (!scroller) return;
      const start = scroller.scrollTop;
      const delta = target - start;
      const t = performance.now();
      const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      const step = (now) => {
        const p = Math.min(1, (now - t) / dur);
        scroller.scrollTop = start + delta * ease(p);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    },
    [to, duration],
  );
  await wait(duration + 180);
}

async function goto(route) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await wait(700);
}

console.log("recording…");

await goto("/");
t0 = Date.now();

await scene("Today — practice that meets you where you are", async () => {
  await wait(1400);
  await smoothScroll(380, 1200);
  await wait(700);
  await smoothScroll(0, 800);
});

await scene("Adaptive plan from how hard you worked", async () => {
  await goto("/adaptive");
  await page.getByTestId("adaptive-start").waitFor({ timeout: 10000 });
  await wait(900);
  await smoothScroll(320, 1000);
  await wait(900);
  const mins = page.getByRole("button", { name: "15 min" });
  if (await mins.isVisible().catch(() => false)) {
    await humanClick(mins, { settle: 700 });
  }
  await wait(800);
});

await scene("Guided player — pace, captions, and cues", async () => {
  await humanClick(page.getByTestId("adaptive-start"), { settle: 1200 });
  const preMood = page.getByTestId("premood-mood-calm");
  if (await preMood.isVisible().catch(() => false)) {
    await humanClick(preMood, { settle: 900 });
  }
  const begin = page.getByTestId("button-begin-guided");
  if (await begin.isVisible().catch(() => false)) {
    await humanClick(begin, { settle: 1000 });
  }
  await page.getByTestId("guided-session").waitFor({ timeout: 20000 });
  await wait(2200);
  const pace = page.getByTestId("button-pace-guided");
  if (await pace.isVisible().catch(() => false)) {
    await humanClick(pace, { settle: 700 });
  }
  const captions = page.getByTestId("button-captions-guided");
  if (await captions.isVisible().catch(() => false)) {
    await humanClick(captions, { settle: 700 });
  }
  await wait(2800);
  const exit = page.getByTestId("button-exit-guided");
  if (await exit.isVisible().catch(() => false)) {
    await humanClick(exit, { settle: 700 });
    const confirm = page.getByTestId("button-exit-confirm");
    if (await confirm.isVisible().catch(() => false)) {
      await humanClick(confirm, { settle: 700 });
    }
  }
});

await scene("Programs for stress, sleep, chair, and foundations", async () => {
  await goto("/pathways");
  await wait(900);
  await smoothScroll(420, 1200);
  const foundations = page.getByTestId("card-pathway-foundations-beginner");
  if (await foundations.isVisible().catch(() => false)) {
    await foundations.scrollIntoViewIfNeeded();
    await wait(900);
  } else {
    await smoothScroll(900, 1200);
  }
  await wait(1000);
});

await scene("On-device pose coach — private confidence cues", async () => {
  await goto("/pose-coach");
  await wait(800);
  const consent = page.getByTestId("pose-coach-consent");
  if (await consent.isVisible().catch(() => false)) {
    await humanClick(consent, { settle: 900 });
  }
  await wait(700);
  const tree = page.getByRole("button", { name: "Tree" });
  if (await tree.isVisible().catch(() => false)) {
    await humanClick(tree, { settle: 700 });
  }
  const checks = page.locator('input[type="checkbox"]');
  const count = await checks.count();
  for (let i = 0; i < Math.min(count, 2); i++) {
    await humanClick(checks.nth(i), { settle: 450 });
  }
  await wait(900);
});

await scene("Teachers and live class waitlists", async () => {
  await goto("/instructors");
  await wait(1000);
  await smoothScroll(360, 1100);
  await wait(1000);
});

await scene("Household profiles with optional PINs", async () => {
  await goto("/household");
  await wait(800);
  const name = page.getByTestId("household-name");
  if (await name.isVisible().catch(() => false)) {
    await humanClick(name, { settle: 300 });
    await name.fill("Alex");
    await wait(400);
    await humanClick(page.getByTestId("household-add"), { settle: 900 });
  }
  await wait(900);
});

await scene("Workplace wellness — aggregate only", async () => {
  await goto("/corporate");
  await wait(800);
  const org = page.getByTestId("corporate-name");
  if (await org.isVisible().catch(() => false)) {
    await humanClick(org, { settle: 300 });
    await org.fill("Northwind Wellness");
    await wait(400);
  }
  await wait(1000);
});

await scene("Settings — habits, offline pack, voice control", async () => {
  await goto("/settings");
  await wait(800);
  await smoothScroll(520, 1200);
  const voice = page.getByTestId("settings-voice-control");
  if (await voice.isVisible().catch(() => false)) {
    await voice.scrollIntoViewIfNeeded();
    await wait(600);
    await humanClick(voice, { settle: 700 });
  }
  const offline = page.getByTestId("settings-offline-download");
  if (await offline.isVisible().catch(() => false)) {
    await offline.scrollIntoViewIfNeeded();
    await wait(800);
  }
  await wait(700);
});

await scene("Sadhana Plus plans — clear tiers, no pressure", async () => {
  await goto("/plus");
  await wait(1000);
  await smoothScroll(280, 900);
  await wait(1000);
});

await scene("Private challenges — no body comparisons", async () => {
  await goto("/challenges");
  await wait(1000);
  await smoothScroll(240, 900);
  await wait(900);
});

await scene("Privacy, terms, and health transparency", async () => {
  await goto("/privacy");
  await wait(1000);
  await smoothScroll(360, 1100);
  await wait(800);
  await goto("/account");
  await page.getByTestId("tab-reset").waitFor({ timeout: 8000 }).catch(() => {});
  await wait(700);
  if (await page.getByTestId("tab-reset").isVisible().catch(() => false)) {
    await humanClick(page.getByTestId("tab-reset"), { settle: 800 });
  }
  await wait(900);
});

await scene("Light or dark — free and open source", async () => {
  await page.emulateMedia({ colorScheme: "dark" });
  await goto("/asanas");
  await page.reload({ waitUntil: "domcontentloaded" });
  await wait(1600);
  await smoothScroll(480, 1200);
  await wait(1600);
});

await ctx.close();
await browser.close();

// Normalize the hashed Playwright filename so the encoder has a stable input.
const raw = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "raw.webm");
if (raw) renameSync(path.join(OUT, raw), path.join(OUT, "raw.webm"));
writeFileSync(path.join(OUT, "scenes.json"), JSON.stringify(scenes, null, 2));

console.log(`\nraw video → ${path.join(OUT, "raw.webm")}`);
console.log(`scene map → ${path.join(OUT, "scenes.json")}`);
