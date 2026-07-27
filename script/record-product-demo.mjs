/**
 * Record the "See it in practice" product montage from the real running app.
 *
 * Drives an actual browser through Trainer → guided session → pathways → library
 * → breathing → dark mode, with a synthetic cursor so the capture reads as a
 * person using Sadhana. Scene boundaries are written to scenes.json so the
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
async function humanClick(locator, { steps = 22, settle = 550 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new Error("no box for click target");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
  await wait(260);
  await page.mouse.down();
  await wait(90);
  await page.mouse.up();
  await wait(settle);
}

async function smoothScroll(to, duration = 1400) {
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
  await wait(duration + 220);
}

async function goto(route) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await wait(900);
}

console.log("recording…");

await goto("/");
t0 = Date.now();

await scene("Your practice, every day", async () => {
  await wait(1800);
  await smoothScroll(420, 1500);
  await wait(900);
  await smoothScroll(0, 1000);
});

await scene("Four quick questions", async () => {
  await humanClick(page.getByRole("link", { name: "Yoga Trainer" }).first());
  await wait(1100);
  const tourStart = page.getByTestId("button-tour-start");
  if (await tourStart.isVisible().catch(() => false)) {
    await humanClick(tourStart);
  }
  await wait(700);

  const answers = ["body-a-little-stiff", "energy-balanced", "time-15", "need-calm"];
  for (const testId of answers) {
    await humanClick(page.getByTestId(testId), { settle: 800 });
    const compose = page.getByTestId("button-compose");
    if (await compose.isVisible().catch(() => false)) {
      await humanClick(compose, { settle: 1600 });
      break;
    }
    await humanClick(page.getByTestId("button-next"), { settle: 800 });
  }
});

await scene("A practice built for today", async () => {
  await page.getByTestId("list-composed-poses").waitFor({ timeout: 15000 });
  await wait(2000);
  await smoothScroll(360, 1300);
  await wait(1300);
});

await scene("Guided voice sessions", async () => {
  await humanClick(page.getByTestId("button-start-guided"), { settle: 1600 });
  const preMood = page.getByTestId("premood-mood-calm");
  if (await preMood.isVisible().catch(() => false)) {
    await humanClick(preMood, { settle: 1300 });
  }
  const begin = page.getByTestId("button-begin-guided");
  if (await begin.isVisible().catch(() => false)) {
    await humanClick(begin, { settle: 1300 });
  }
  await page.getByTestId("guided-session").waitFor({ timeout: 20000 });
  await wait(9000);
  const exit = page.getByTestId("button-exit-guided");
  if (await exit.isVisible().catch(() => false)) {
    await humanClick(exit, { settle: 1000 });
  }
});

await scene("Quick flows and multi-week paths", async () => {
  await goto("/pathways");
  await wait(1500);
  await smoothScroll(560, 1700);
  await wait(1600);
});

await scene("Every pose, illustrated", async () => {
  await goto("/asanas");
  await wait(1400);
  await smoothScroll(760, 1800);
  await wait(1200);
  await smoothScroll(1560, 1800);
  await wait(1400);
});

await scene("Cues, variations, and what to avoid", async () => {
  await goto("/asanas/ardha-chandrasana");
  await wait(2000);
  await smoothScroll(900, 1800);
  await wait(1600);
});

await scene("Six guided breathing techniques", async () => {
  await goto("/breathing");
  await wait(1500);
  const start = page.getByRole("button", { name: /start|begin/i }).first();
  if (await start.isVisible().catch(() => false)) {
    await humanClick(start, { settle: 900 });
  }
  await wait(5500);
});

await scene("Light or dark — free and open source", async () => {
  // Theme follows prefers-color-scheme at mount, and route changes are hash-only,
  // so the app needs a real reload to remount dark. Reloading also repaints every
  // surface — toggling in-page leaves stale screencast tiles on the sidebar.
  await page.emulateMedia({ colorScheme: "dark" });
  await goto("/asanas");
  await page.reload({ waitUntil: "domcontentloaded" });
  await wait(2200);
  await smoothScroll(620, 1700);
  await wait(2200);
});

await ctx.close();
await browser.close();

// Normalize the hashed Playwright filename so the encoder has a stable input.
const raw = readdirSync(OUT).find((f) => f.endsWith(".webm") && f !== "raw.webm");
if (raw) renameSync(path.join(OUT, raw), path.join(OUT, "raw.webm"));
writeFileSync(path.join(OUT, "scenes.json"), JSON.stringify(scenes, null, 2));

console.log(`\nraw video → ${path.join(OUT, "raw.webm")}`);
console.log(`scene map → ${path.join(OUT, "scenes.json")}`);
