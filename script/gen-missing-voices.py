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
    "marjaryasana-bitilasana",
    "supta-matsyendrasana",
    "supta-kapotasana",
    "parsva-balasana",
    "uttana-shishosana",
    "malasana",
    "virasana",
    "supta-baddha-konasana",
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
        lines.append(f"Hold for about {a['hold']}. Soften wherever you can.")
    lines.append("Beautiful. Stay present in the pose.")
    return " ".join(lines)


async def synthesize(text: str, mp3_path: Path) -> None:
    tmp = mp3_path.with_suffix(".tmp.mp3")
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(tmp))
    # Normalize to 128 kbps mono 44.1 kHz to match existing assets
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(tmp),
            "-ac",
            "1",
            "-ar",
            "44100",
            "-b:a",
            "128k",
            str(mp3_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    tmp.unlink(missing_ok=True)


async def main() -> None:
    src = CONTENT.read_text(encoding="utf-8")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for slug in MISSING:
        out = OUT_DIR / f"pose-{slug}.mp3"
        if out.exists() and out.stat().st_size > 50_000:
            print(f"skip (exists): {slug}")
            continue
        asana = extract_asana_block(src, slug)
        text = script_for(asana)
        print(f"generating {slug} ({len(text)} chars)…")
        await synthesize(text, out)
        print(f"  -> {out.name} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    asyncio.run(main())
