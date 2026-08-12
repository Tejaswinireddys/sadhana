# Premium session assets (human-provided)

Engineering can ship the guided-session *experience* (cross-fades, idle chrome,
session summary → journal). The following assets must come from the product
owner — they cannot be invented in code:

| Asset | What “done” looks like |
| --- | --- |
| **Narration audio** | Recorded or approved neural TTS per pose (`client/public/voice/` / media manifest). Without approval, the app stays silent or uses the user’s `allowRobotVoice` preference only. |
| **Real motion (top ~20–30 poses)** | Filmed instructor clips, licensed stock, or a rigged 3D avatar export. Everything else stays illustrated / generated step-journey clips. |
| **Camera-feedback joint angles** | Target joint-angle definitions for feedback poses, validated with an instructor before enabling live form scoring. |

Until those land, guided practice still runs end-to-end with illustrations,
optional looping presentation clips, chimes, and captions.
