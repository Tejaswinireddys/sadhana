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
`prefers-reduced-motion` or save-data is on.

## Asana Detail — amended

This doc previously said "do not add WebGL to Asana Detail". That still holds
for **React Three Fiber**: R3F's reconciler is a large always-loaded dependency
for what is a single non-interactive scene.

It no longer holds for raw three.js. Five pilot poses now render through
`PoseFigurineGL`, a procedurally-built jointed humanoid driven by
narration-step keyframes. The constraints that made the original ruling right
are all still respected:

- dynamically imported, so it never enters `index.js` (own ~131 kB gzip chunk)
- only loads for poses that have authored keyframes
- skipped entirely when WebGL is unavailable or Save-Data is on
- falls back to the CSS `PoseFigurine3D` stage in every one of those cases
- renders only while onscreen; obeys `prefers-reduced-motion` / `html.motion-off`

No model is downloaded — the figure is built from three.js primitives, so there
is no glTF/draco/ktx pipeline and no external asset host.

See `docs/pose-videos.md` for the pilot list and how to extend it.
