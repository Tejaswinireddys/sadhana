# Product demo videos

Sadhana ships a reusable `ProductDemoVideo` component for real product walkthroughs.

## Placeholder paths

Replace these files with real captures (do not invent fake demos):

| Asset | Path |
|-------|------|
| WebM | `client/public/videos/product-overview.webm` |
| MP4 fallback | `client/public/videos/product-overview.mp4` |
| Poster | `client/public/images/product-overview-poster.webp` |
| Captions | `client/public/captions/product-overview.vtt` |

Until real files exist, the player shows the poster (when available) and a clear fallback message.

## Capture guidelines

1. Record the live app (Trainer → guided pose → complete) at 1280×720 or 1920×1080.
2. Export muted-friendly audio (or silent) — the component never autoplays with sound.
3. Keep overview clips to **45–90 seconds**.
4. Provide English captions in WebVTT for any spoken guidance.
5. Optimize: WebM (VP9) primary + H.264 MP4 fallback; poster as WebP.

## Usage

```tsx
import { ProductDemoVideo } from "@/components/ProductDemoVideo";

<ProductDemoVideo title="See Sadhana in practice" />
```

Optional props: `name`, `posterSrc`, `webmSrc`, `mp4Src`, `captionsSrc`, `autoPlayMuted`.
