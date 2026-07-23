# Product demo videos

Sadhana ships a reusable `ProductDemoVideo` component for real product walkthroughs.

## Shipped assets

| Asset | Path |
|-------|------|
| MP4 (primary) | `client/public/videos/product-overview.mp4` |
| WebM | `client/public/videos/product-overview.webm` |
| Poster | `client/public/images/product-overview-poster.png` |
| Captions | `client/public/captions/product-overview.vtt` |

The overview montage is built from local pose demo clips (muted). Replace with a live
app capture anytime — keep the same filenames.

## Capture guidelines

1. Record the live app (Trainer → guided pose → complete) at 1280×720 or 1920×1080.
2. Export muted-friendly audio (or silent) — the component never autoplays with sound.
3. Keep overview clips to **45–90 seconds**.
4. Provide English captions in WebVTT for any spoken guidance.
5. Optimize: H.264 MP4 primary + optional WebM (VP9); poster as PNG (or WebP if tooling is available).

## Usage

```tsx
import { ProductDemoVideo } from "@/components/ProductDemoVideo";

<ProductDemoVideo title="See Sadhana in practice" />
```

Optional props: `name`, `posterSrc`, `webmSrc`, `mp4Src`, `captionsSrc`, `autoPlayMuted`.
