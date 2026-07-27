# Product demo videos

Sadhana ships a reusable `ProductDemoVideo` component for real product walkthroughs.

## Shipped assets

| Asset | Path |
|-------|------|
| MP4 (primary) | `client/public/videos/product-overview.mp4` |
| WebM | `client/public/videos/product-overview.webm` |
| Poster | `client/public/images/product-overview-poster.png` |
| Captions | `client/public/captions/product-overview.vtt` |

The overview is a real capture of the running app: Home → Yoga Trainer intake →
guided session → pathways → asana library → breathing → dark mode.

## Regenerating the overview

Requires ffmpeg on PATH and Chromium for Playwright (`npx playwright install chromium`).

```bash
npm run dev                 # terminal 1 — serves on :5000
npm run demo:record         # terminal 2 — drives the app, writes /tmp/demo
npm run demo:encode         # writes the four shipped assets
```

`demo:record` writes `raw.webm` plus a `scenes.json` timing map; `demo:encode` reads
both, so on-screen captions and the WebVTT track always match the capture. Useful
flags: `--speed` (default `1.3`) and `--poster` (poster timestamp in final seconds).

## Capture guidelines

1. Record at 1280×720 so the shipped MP4 stays under ~4 MB.
2. Silent by design — the component never autoplays with sound.
3. Keep overview clips to **45–90 seconds**.
4. Caption every scene in WebVTT; the encoder generates this from the scene map.
5. Optimize: H.264 MP4 primary + VP9 WebM; poster is a palette-quantized PNG.

## Usage

```tsx
import { ProductDemoVideo } from "@/components/ProductDemoVideo";

<ProductDemoVideo title="See Sadhana in practice" />
```

Optional props: `name`, `posterSrc`, `webmSrc`, `mp4Src`, `captionsSrc`, `autoPlayMuted`.
