# Architecture invariants (audit §10)

These surfaces must stay logic-stable. Restyle and motion are fine; do **not** rewrite
queue timing, ownership, or gate behavior without an explicit product decision.

| Surface | Location | Keep stable |
|---------|----------|-------------|
| Practice queue / persist | `PracticeContext`, `lib/practicePersist` | Session hydrate/save, `loadSession`, progress |
| Guided timing + voice | `pages/GuidedSession.tsx` | Phase machine, audio sync, hold/side switch |
| Mood / session logging | `lib/logPracticeSession`, session APIs | Payload shape and ownership |
| Device-ID ownership | `lib/deviceId`, `server/owner` | `X-Device-Id` scoping |
| Pose / coach catalogs | `data/content.ts`, coach generation | Data model fields used by Trainer/Guided |
| Kids ParentGate | `ParentGate`, `KidsGateContext` | Math unlock, session scope |
| Theme + motion prefs | `ThemeProvider`, `MotionToggle` | `dark` class, `html.motion-off` |
| shadcn primitives | `components/ui/*` | Prefer token restyle over library swaps |

When adding UI motion or 3D, honor `prefers-reduced-motion` and `html.motion-off`.
