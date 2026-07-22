#!/usr/bin/env python3
"""Generate missing pose-*.mp3 narrations with edge-tts (calm female voice)."""

from __future__ import annotations

import asyncio
import re
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "client" / "src" / "data" / "content.ts"
OUT_DIR = ROOT / "client" / "public" / "voice"
VOICE = "en-US-JennyNeural"
RATE = "-8%"
PITCH = "-2Hz"

MISSING = [
    "baddha-virabhadrasana",
    "baddha-parsvakonasana",
    "parivrtta-hasta-padangusthasana",
    "parivrtta-paschimottanasana",
    "jathara-parivartanasana",
    "uttana-padasana",
    "tolasana",
    "bhujapidasana",
    "galavasana",
    "eka-pada-bakasana",
]


def extract_asana_block(src: str, slug: str) -> dict[str, object]:
    # Find the object that starts with slug: "<slug>"
    m = re.search(rf'slug:\s*"{re.escape(slug)}"\s*,', src)
    if not m:
        raise SystemExit(f"slug not found: {slug}")
    start = src.rfind("{", 0, m.start())
    # naive brace match from start
    depth = 0
    end = None
    for i, ch in enumerate(src[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        raise SystemExit(f"could not parse block for {slug}")
    block = src[start:end]

    def field(name: str) -> str:
        mm = re.search(rf'{name}:\s*"((?:\\.|[^"\\])*)"', block)
        return mm.group(1).replace('\\"', '"') if mm else ""

    steps = re.findall(r'\{\s*text:\s*"((?:\\.|[^"\\])*)"', block)
    steps = [s.replace('\\"', '"') for s in steps]
    return {
        "slug": slug,
        "english": field("english"),
        "sanskrit": field("sanskrit"),
        "summary": field("summary"),
        "breathing": field("breathing"),
        "hold": field("hold"),
        "steps": steps,
    }


def script_for(a: dict[str, object]) -> str:
    steps: list[str] = a["steps"]  # type: ignore
    lines = [
        f"Welcome to {a['english']}. In Sanskrit, {a['sanskrit']}.",
        str(a["summary"]),
        "I'll guide you step by step. Take your time.",
    ]
    for i, step in enumerate(steps, 1):
        lines.append(f"Step {i}. {step}")
    if a["breathing"]:
        lines.append(f"Breathing. {a['breathing']}")
    if a["hold"]:
        lines.append(f"Hold for about {a['hold']}. Stay with your breath.")
    lines.append("When you're ready, gently release the pose.")
    return " ".join(lines)


async def synth_one(slug: str, text: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw = OUT_DIR / f"pose-{slug}.raw.mp3"
    out = OUT_DIR / f"pose-{slug}.mp3"
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(raw))
    # Normalize loudness / convert for web
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(raw),
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(out),
        ],
        check=True,
        capture_output=True,
    )
    raw.unlink(missing_ok=True)
    return out


async def main() -> None:
    src = CONTENT.read_text(encoding="utf-8")
    for slug in MISSING:
        a = extract_asana_block(src, slug)
        text = script_for(a)
        print(f"Generating {slug}…")
        path = await synth_one(slug, text)
        print(f"  → {path.name} ({path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    asyncio.run(main())
