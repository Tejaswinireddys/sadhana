#!/usr/bin/env python3
"""Regenerate pose narration audio + exact per-step timing together.

Why
---
Two problems compounded to make the guided-session pose demo feel out of
sync with the coaching voice — not like a real trainer at all:

1. `client/public/voice/pose-{slug}.mp3` files were generated long ago from
   an older, uncommitted script. A transcript check shows the *words spoken
   no longer match the steps shown on screen* for many poses (steps have
   been edited in `content.ts` since those files were recorded).
2. No `client/public/voice/timings/{slug}.timing.json` files exist, so the
   client's video-scrub logic (`useNarrationTiming`, `resolveCueList`) always
   fell back to a syllable-weighted *guess* spread across the *entire* audio
   clip — including several seconds of intro/outro speech that isn't a step
   at all. That guess put the pose video on the wrong step for a large
   fraction of every practice.

edge-tts's WordBoundary event no longer fires on the current service (only
SentenceBoundary does), and even SentenceBoundary text-matching for a
"Step N." marker is unreliable: TTS sentence-splitting treats things like
"...forming an inverted V." as an abbreviation and merges the next "Step 3."
marker into the same sentence, losing the boundary.

This script sidesteps all of that: each narration part (intro, each step,
breathing, hold, outro) is synthesized as its **own** edge-tts call, so its
duration is known exactly from that call — no text matching, no guessing.
The parts are concatenated in order and the per-step timing is just the
running sum of prior part durations. This is exact by construction and
always matches the shipped audio because the shipped audio *is* the
concatenation.

Output (per slug)
------------------
    client/public/voice/pose-{slug}.mp3          (overwritten)
    client/public/voice/timings/{slug}.timing.json

Usage
-----
    python3 script/regen-pose-narration.py                  # all poses, skip done
    python3 script/regen-pose-narration.py --force           # regenerate everything
    python3 script/regen-pose-narration.py tadasana bhujangasana
    python3 script/regen-pose-narration.py --limit 5          # smoke test
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import edge_tts
except ImportError:
    sys.exit("edge-tts is required:  pip install edge-tts")

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "client" / "src" / "data" / "content.ts"
VOICE_DIR = ROOT / "client" / "public" / "voice"
TIMING_DIR = VOICE_DIR / "timings"

# Must stay identical to script/gen-missing-voices.py so every pose in the
# catalog — old and new — shares one coaching voice.
VOICE = "en-US-JennyNeural"
RATE = "-8%"
PITCH = "-2Hz"

CONCURRENCY = 10


def unescape(s: str) -> str:
    return s.replace('\\"', '"').replace("\\n", "\n")


def parse_asanas(src: str) -> list[dict]:
    """Extract every RAW_ASANAS entry with the fields narration needs."""
    start = src.index("const RAW_ASANAS")
    end = src.index("export const ASANAS")
    block = src[start:end]

    out: list[dict] = []
    for m in re.finditer(r'\{\s*slug:\s*"([a-z0-9-]+)"\s*,', block):
        slug = m.group(1)
        obj_start = m.start()
        depth = 0
        i = obj_start
        while i < len(block):
            if block[i] == "{":
                depth += 1
            elif block[i] == "}":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
            i += 1
        entry = block[obj_start:i]

        def field(name: str) -> str:
            mm = re.search(rf'{name}:\s*"((?:\\.|[^"\\])*)"', entry)
            return unescape(mm.group(1)) if mm else ""

        steps_m = re.search(r"steps:\s*\[", entry)
        steps: list[str] = []
        if steps_m:
            s0 = steps_m.end()
            depth2 = 1
            j = s0
            while j < len(entry) and depth2 > 0:
                if entry[j] == "[":
                    depth2 += 1
                elif entry[j] == "]":
                    depth2 -= 1
                j += 1
            steps_block = entry[s0 : j - 1]
            steps = [
                unescape(t)
                for t in re.findall(r'text:\s*"((?:\\.|[^"\\])*)"', steps_block)
            ]

        if not steps:
            continue
        out.append(
            {
                "slug": slug,
                "english": field("english"),
                "sanskrit": field("sanskrit"),
                "summary": field("summary"),
                "breathing": field("breathing"),
                "hold": field("hold"),
                "steps": steps,
            }
        )
    return out


def narration_parts(a: dict) -> dict:
    """Named narration segments. Each is synthesized independently so its
    duration is known exactly — no sentence-boundary text matching needed.
    """
    intro = (
        f"Welcome to {a['english']}. In Sanskrit, {a['sanskrit']}. "
        f"{a['summary']} I'll guide you step by step. Take your time."
    )
    steps = [f"Step {i}. {text}" for i, text in enumerate(a["steps"], 1)]
    outro_bits = []
    if a["breathing"]:
        outro_bits.append(f"Breathing. {a['breathing']}")
    if a["hold"]:
        outro_bits.append(f"Hold for about {a['hold']}. Stay with your breath.")
    outro_bits.append("When you're ready, gently release the pose.")
    outro = " ".join(outro_bits)
    return {"intro": intro, "steps": steps, "outro": outro}


async def synth_part(text: str, out_path: Path) -> None:
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(out_path))


def probe_duration(path: Path) -> float:
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
    )
    try:
        return float(probe.stdout.strip())
    except ValueError:
        return 0.0


async def process_one(a: dict, force: bool) -> str:
    slug = a["slug"]
    mp3_path = VOICE_DIR / f"pose-{slug}.mp3"
    timing_path = TIMING_DIR / f"{slug}.timing.json"
    if timing_path.exists() and mp3_path.exists() and not force:
        return f"  =  {slug}: already regenerated (skip)"

    parts = narration_parts(a)
    order = ["intro", *[f"step{i}" for i in range(len(parts["steps"]))], "outro"]
    texts = {"intro": parts["intro"], "outro": parts["outro"]}
    for i, t in enumerate(parts["steps"]):
        texts[f"step{i}"] = t

    with tempfile.TemporaryDirectory(prefix=f"narr-{slug}-") as tmp:
        tmp_path = Path(tmp)
        seg_paths: dict[str, Path] = {}
        try:
            for key in order:
                seg = tmp_path / f"{key}.mp3"
                await synth_part(texts[key], seg)
                seg_paths[key] = seg
        except Exception as exc:
            return f"  !  {slug}: synthesis failed on {key} — {exc}"

        durations = {key: probe_duration(seg_paths[key]) for key in order}
        if any(d <= 0 for d in durations.values()):
            bad = [k for k, d in durations.items() if d <= 0]
            return f"  !  {slug}: zero-duration segment(s) {bad}"

        # Concat filter (decode + re-encode once) avoids MP3 frame-boundary
        # gaps that a raw byte-concat of separate mp3s can introduce.
        list_file = tmp_path / "concat.txt"
        list_file.write_text(
            "\n".join(f"file '{seg_paths[key].as_posix()}'" for key in order) + "\n"
        )
        concat_wav = tmp_path / "concat.wav"
        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(list_file),
                    str(concat_wav),
                ],
                check=True,
                capture_output=True,
            )
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(concat_wav),
                    "-af",
                    "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar",
                    "44100",
                    "-ac",
                    "1",
                    str(mp3_path),
                ],
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError as exc:
            return f"  !  {slug}: ffmpeg concat/encode failed — {exc.stderr.decode(errors='ignore')[:200]}"

        encoded_duration = probe_duration(mp3_path)
        raw_total = sum(durations.values())
        k = encoded_duration / raw_total if raw_total > 0 else 1.0

        windows = []
        cursor = 0.0
        for key in order:
            start = cursor
            cursor += durations[key]
            if key.startswith("step"):
                windows.append({"start": round(start * k, 3), "end": round(cursor * k, 3)})
        windows[-1]["end"] = round(encoded_duration, 3)

        TIMING_DIR.mkdir(parents=True, exist_ok=True)
        timing_path.write_text(
            json.dumps(
                {"slug": slug, "duration": round(encoded_duration, 3), "steps": windows},
                separators=(",", ":"),
            )
        )
        return f"  \u2713  {slug}: {len(windows)} steps, {encoded_duration:.1f}s"


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("slugs", nargs="*", help="specific slugs (default: all)")
    ap.add_argument("--force", action="store_true", help="regenerate existing files")
    ap.add_argument("--limit", type=int, default=0, help="process only the first N (smoke test)")
    args = ap.parse_args()

    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        sys.exit("ffmpeg/ffprobe are required")

    src = CONTENT.read_text(encoding="utf-8")
    asanas = parse_asanas(src)
    if args.slugs:
        wanted = set(args.slugs)
        asanas = [a for a in asanas if a["slug"] in wanted]
    if args.limit:
        asanas = asanas[: args.limit]

    sem = asyncio.Semaphore(CONCURRENCY)
    results: list[str] = [""] * len(asanas)

    async def worker(idx: int, a: dict):
        async with sem:
            results[idx] = await process_one(a, args.force)
            print(results[idx], flush=True)

    await asyncio.gather(*(worker(i, a) for i, a in enumerate(asanas)))

    ok = sum(1 for r in results if r.strip().startswith("\u2713"))
    skipped = sum(1 for r in results if "skip" in r)
    failed = sum(1 for r in results if r.strip().startswith("!"))
    print(f"\n{ok} regenerated, {skipped} skipped, {failed} failed, {len(asanas)} total")


if __name__ == "__main__":
    asyncio.run(main())
