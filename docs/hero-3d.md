# Landing hero 3D (audit §13)

Sadhana ships a **CSS/SVG “breathing silhouette”** hero (`HeroBreathScene`) instead of
Three.js or Spline — zero heavy runtime cost.

## Behavior

- Dynamically imported from `Landing.tsx`
- Static `tadasana.png` fallback for LCP, mobile (`<768px`), reduced-motion, and `html.motion-off`
- Pauses decorative motion when offscreen (`IntersectionObserver`)

## Optional Spline upgrade later

If a real Spline scene is desired:

```bash
npm i @splinetool/react-spline
```

Lazy-load a thin wrapper, keep the PNG fallback, and never autoplay motion when
`prefers-reduced-motion` or save-data is on. Prefer one decorative hero only —
do not add R3F for Asana Detail unless it clarifies alignment better than DemoMode.
