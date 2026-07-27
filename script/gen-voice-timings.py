#!/usr/bin/env python3
"""Generate per-step narration timing JSON from edge-tts WordBoundary events.

Why
---
The app previously guessed which narration step was being spoken by dividing
the audio duration evenly across steps. Step texts vary from 3 to 20+ words, so
every visual cue driven by the step index (focus halo, 3D camera, limb
animation) landed on the wrong words.

edge-tts emits a WordBoundary event per spoken word with an offset in 100-ns
ticks. Re-synthesising each pose's narration with those events captured gives
exact step boundaries at zero API cost, fully offline.

Output
------
    client/public/voice/timings/{slug}.timing.json

        {
          "slug": "tadasana",
          "duration": 24.63,
          "steps": [{"start": 0.0, "end": 6.12}, ...]
        }

The client (`useNarrationTiming`) loads this when present and falls back to a
syllable-weighted estimate when it is missing, so partial generation is safe.

Usage
-----
    python3 script/gen-voice-timings.py                 # all poses, skip existing
    python3 script/gen-voice-timings.py --force         # regenerate everything
    python3 script/gen-voice-timings.py tadasana cobra  # specific slugs
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from pathlib import Path

try:
    import edge_tts
except ImportError:  # pragma: no cover - dependency hint
    sys.exit("edge-tts is required:  pip install edge-tts")

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "client" / "src" / "data" / "content.ts"
OUT_DIR = ROOT / "client" / "public" / "voice" / "timings"

# Must match script/gen-missing-voices.py exactly, or the boundaries won't line
# up with the mp3s already shipped in client/public/voice/.
VOICE = "en-US-JennyNeural"
RATE = "-8%"
PITCH = "-2Hz"

# edge-tts reports offsets in 100-nanosecond ticks.
TICKS_PER_SECOND = 10_000_000


def parse_asanas(src: str) -> list[tuple[str, list[str]]]:
    """Extract (slug, [step texts]) for every asana in content.ts."""
    out: list[tuple[str, list[str]]] = []
    for m in re.finditer(r'slug:\s*"([a-z0-9-]+)"\s*,', src):
        slug = m.group(1)
        steps_m = re.search(r"steps:\s*\[", src[m.end():])
        if not steps_m:
            continue
        start = m.end() + steps_m.end()
        # Walk to the matching close bracket so nested objects don't confuse us.
        depth = 1
        i = start
        while i < len(src) and depth > 0:
            if src[i] == "[":
                depth += 1
            elif src[i] == "]":
                depth -= 1
            i += 1
        block = src[start : i - 1]
        texts = [
            t.encode().decode("unicode_escape")
            for t in re.findall(r'text:\s*"((?:[^"\\]|\\.)*)"', block)
        ]
        if texts:
            out.append((slug, texts))
    return out


def narration_for(texts: list[str]) -> str:
    """The exact string gen-missing-voices.py synthesises for a pose."""
    return " ".join(texts)


def word_stream(texts: list[str]) -> list[int]:
    """Cumulative word counts marking where each step ends in the joined text."""
    bounds: list[int] = []
    total = 0
    for t in texts:
        total += len([w for w in t.split() if w])
        bounds.append(total)
    return bounds


async def timings_for(texts: list[str]) -> dict | None:
    """Synthesise the narration and map WordBoundary offsets onto step ends."""
    text = narration_for(texts)
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)

    words: list[tuple[float, float]] = []  # (start_sec, end_sec)
    async for chunk in communicate.stream():
        if chunk["type"] == "WordBoundary":
            start = chunk["offset"] / TICKS_PER_SECOND
            end = (chunk["offset"] + chunk["duration"]) / TICKS_PER_SECOND
            words.append((start, end))

    if not words:
        return None

    bounds = word_stream(texts)
    duration = words[-1][1]

    steps: list[dict[str, float]] = []
    cursor = 0.0
    for i, wordcount in enumerate(bounds):
        # WordBoundary count can drift from naive whitespace splitting (hyphens,
        # numerals). Clamp so we never index past the end.
        idx = min(wordcount, len(words)) - 1
        if idx < 0:
            end = cursor
        elif i == len(bounds) - 1:
            end = duration
        else:
            # End the step at the midpoint between this word's end and the next
            # word's start — that's where the natural pause sits.
            nxt = words[idx + 1][0] if idx + 1 < len(words) else words[idx][1]
            end = (words[idx][1] + nxt) / 2
        end = max(end, cursor)
        steps.append({"start": round(cursor, 3), "end": round(end, 3)})
        cursor = end

    steps[-1]["end"] = round(duration, 3)
    return {"duration": round(duration, 3), "steps": steps}


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slugs", nargs="*", help="specific slugs (default: all)")
    ap.add_argument("--force", action="store_true", help="regenerate existing files")
    args = ap.parse_args()

    src = CONTENT.read_text()
    asanas = parse_asanas(src)
    if args.slugs:
        wanted = set(args.slugs)
        asanas = [a for a in asanas if a[0] in wanted]
        missing = wanted - {a[0] for a in asanas}
        for slug in sorted(missing):
            print(f"  ?  {slug} — not found in content.ts")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = skipped = failed = 0

    for slug, texts in asanas:
        out = OUT_DIR / f"{slug}.timing.json"
        if out.exists() and not args.force:
            skipped += 1
            continue
        try:
            result = await timings_for(texts)
        except Exception as exc:  # network hiccup on one pose shouldn't stop the run
            print(f"  !  {slug}: {exc}")
            failed += 1
            continue
        if not result:
            print(f"  !  {slug}: no word boundaries returned")
            failed += 1
            continue
        out.write_text(
            json.dumps({"slug": slug, **result}, indent=None, separators=(",", ":"))
        )
        written += 1
        print(f"  ✓  {slug}  {len(result['steps'])} steps  {result['duration']}s")

    print(f"\n{written} written, {skipped} skipped, {failed} failed → {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
