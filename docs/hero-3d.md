# Landing hero 3D (audit §13)

Sadhana ships a **CSS/SVG “breathing” hero** (`HeroBreathScene`) instead of
Three.js or Spline — zero heavy runtime cost.

## Behavior

- Dynamically imported from `Landing.tsx`
- Always shows the real pose photo (`tadasana.png`) as the visual anchor (good for LCP)
- When motion is enabled and the scene is onscreen: soft photo breath, mat plane, and
  (on wider viewports) a translucent silhouette with CSS perspective
- Narrow viewports keep the photo + lighter overlays (no “static-only” dead zone)
- Respects `prefers-reduced-motion` and `html.motion-off`
- Pauses decorative motion when offscreen (`IntersectionObserver`)

## Optional Spline upgrade later

If a real Spline scene is desired:

```bash
npm i @splinetool/react-spline
```

Lazy-load a thin wrapper, keep the PNG fallback, and never autoplay motion when
`prefers-reduced-motion` or save-data is on. Prefer one decorative hero only —
do not add R3F for Asana Detail unless it clarifies alignment better than DemoMode.
