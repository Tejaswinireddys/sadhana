// StepMotion — a small library of reusable animated "step-motion" primitives.
//
// Each primitive is a compact 60-100px SVG showing a body in a micro-position
// with a small motion cue (limb rotation, torso fold, breath dot, arrow nudge,
// etc). Animations come from CSS keyframes in index.css (the `.step-*` classes)
// and are disabled under prefers-reduced-motion / html.motion-off.
//
// Each step in content.ts maps to one of these via a `stepMotion` field.

export type StepMotionKey =
  | "limb-rotate"
  | "torso-fold"
  | "hip-shift"
  | "arm-extend"
  | "leg-extend"
  | "inhale"
  | "exhale"
  | "lift"
  | "twist"
  | "ground"
  | "balance"
  | "settle";

type Props = {
  motion: StepMotionKey;
  size?: number;
  className?: string;
};

const G = 84;

function Frame({
  children,
  size,
  className,
  label,
}: {
  children: React.ReactNode;
  size: number;
  className?: string;
  label: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`step-svg ${className ?? ""}`}
      role="img"
      aria-label={label}
    >
      {children}
      <line x1="14" y1={G} x2="86" y2={G} strokeWidth={1.5} opacity={0.3} />
    </svg>
  );
}

// An upright torso with a rotating limb (arm/leg).
const PRIMITIVES: Record<StepMotionKey, () => JSX.Element> = {
  "limb-rotate": () => (
    <>
      <circle cx="50" cy="24" r="8" />
      <line x1="50" y1="32" x2="50" y2="62" />
      <path d="M50 62 L40 84 M50 62 L60 84" />
      <g className="step-limb-rotate" style={{ transformOrigin: "50px 38px" }}>
        <line x1="50" y1="38" x2="74" y2="30" />
      </g>
    </>
  ),

  "torso-fold": () => (
    <>
      <path d="M40 84 L40 50 M60 84 L60 50" />
      <g className="step-torso-fold" style={{ transformOrigin: "50px 50px" }}>
        <line x1="50" y1="50" x2="50" y2="20" />
        <circle cx="50" cy="16" r="7" />
        <path d="M50 26 L40 40 M50 26 L60 40" />
      </g>
    </>
  ),

  "hip-shift": () => (
    <g className="step-hip-shift">
      <circle cx="50" cy="22" r="8" />
      <line x1="50" y1="30" x2="50" y2="58" />
      <path d="M50 36 L36 48 M50 36 L64 48" />
      <path d="M50 58 L38 84 M50 58 L62 84" />
    </g>
  ),

  "arm-extend": () => (
    <>
      <circle cx="50" cy="24" r="8" />
      <line x1="50" y1="32" x2="50" y2="62" />
      <path d="M50 62 L40 84 M50 62 L60 84" />
      <g className="step-arm-extend" style={{ transformOrigin: "50px 40px" }}>
        <path d="M22 40 L50 40 L78 40" />
      </g>
    </>
  ),

  "leg-extend": () => (
    <>
      <circle cx="32" cy="40" r="7" />
      <line x1="32" y1="47" x2="40" y2="64" />
      <path d="M40 64 L24 80 L24 84" />
      <g className="step-leg-extend" style={{ transformOrigin: "40px 64px" }}>
        <path d="M40 64 L82 80" />
      </g>
    </>
  ),

  inhale: () => (
    <>
      <circle cx="50" cy="22" r="7" />
      <line x1="50" y1="29" x2="50" y2="56" />
      <path d="M50 56 L40 84 M50 56 L60 84" />
      <g className="step-inhale" style={{ transformOrigin: "50px 42px" }}>
        <circle cx="50" cy="42" r="9" opacity={0.55} fill="currentColor" stroke="none" />
      </g>
    </>
  ),

  exhale: () => (
    <>
      <circle cx="50" cy="22" r="7" />
      <line x1="50" y1="29" x2="50" y2="56" />
      <path d="M50 56 L40 84 M50 56 L60 84" />
      <g className="step-exhale" style={{ transformOrigin: "50px 42px" }}>
        <circle cx="50" cy="42" r="9" opacity={0.55} fill="currentColor" stroke="none" />
      </g>
    </>
  ),

  lift: () => (
    <>
      <path d="M22 80 L34 80 L34 60" />
      <g className="step-lift">
        <path d="M34 60 L50 48 L66 60" />
        <circle cx="22" cy="74" r="5" />
      </g>
      <path d="M66 60 L66 80 L78 80" />
    </>
  ),

  twist: () => (
    <>
      <line x1="50" y1="84" x2="50" y2="54" />
      <g className="step-twist" style={{ transformOrigin: "50px 54px" }}>
        <line x1="50" y1="54" x2="50" y2="24" />
        <circle cx="50" cy="18" r="7" />
        <path d="M50 30 L30 36 M50 30 L70 24" />
      </g>
    </>
  ),

  ground: () => (
    <>
      <line x1="50" y1="58" x2="50" y2="30" />
      <circle cx="50" cy="22" r="7" />
      <path d="M50 36 L38 50 M50 36 L62 50" />
      <g className="step-pulse" style={{ transformOrigin: "50px 70px" }}>
        <path d="M40 58 L34 80 M60 58 L66 80" />
        <line x1="30" y1="80" x2="70" y2="80" />
      </g>
    </>
  ),

  balance: () => (
    <g className="step-pulse" style={{ transformOrigin: "50px 84px" }}>
      <circle cx="50" cy="20" r="7" />
      <line x1="50" y1="27" x2="50" y2="56" />
      <path d="M50 32 L42 18 M50 32 L58 18" />
      <path d="M50 56 L50 84" />
      <path d="M50 56 L40 62 L48 70" />
    </g>
  ),

  settle: () => (
    <g className="step-pulse" style={{ transformOrigin: "50px 60px" }}>
      <circle cx="50" cy="34" r="7" />
      <line x1="50" y1="41" x2="50" y2="62" />
      <path d="M50 46 L40 58 M50 46 L60 58" />
      <path d="M50 62 L34 76 L50 72 L66 76 Z" />
    </g>
  ),
};

const LABELS: Record<StepMotionKey, string> = {
  "limb-rotate": "Limb rotation cue",
  "torso-fold": "Torso folding cue",
  "hip-shift": "Hip shift cue",
  "arm-extend": "Arms extending cue",
  "leg-extend": "Leg extending cue",
  inhale: "Inhale — breath expanding",
  exhale: "Exhale — breath settling",
  lift: "Hips lifting cue",
  twist: "Spinal twist cue",
  ground: "Grounding cue",
  balance: "Balancing cue",
  settle: "Settle and breathe",
};

export function StepMotion({ motion, size = 80, className }: Props) {
  const draw = PRIMITIVES[motion] || PRIMITIVES.settle;
  return (
    <Frame size={size} className={className} label={LABELS[motion]}>
      {draw()}
    </Frame>
  );
}
