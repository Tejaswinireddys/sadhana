#!/usr/bin/env python3
"""Generate kids-*.mp3 story narrations with a warm edge-tts voice."""

from __future__ import annotations

import asyncio
import re
import subprocess
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
KIDS = ROOT / "client" / "src" / "data" / "kids.ts"
OUT_DIR = ROOT / "client" / "public" / "voice"
VOICE = "en-US-AnaNeural"
RATE = "+5%"
PITCH = "+2Hz"

MISSING = [
    "flamingo",
    "elephant",
    "airplane",
    "owl",
    "penguin",
    "rainbow",
    "volcano",
    "crab",
    "turtle",
    "dragon",
]


def extract_kids_pose(src: str, slug: str) -> dict[str, object]:
    m = re.search(rf'slug:\s*"{re.escape(slug)}"\s*,', src)
    if not m:
        raise SystemExit(f"slug not found: {slug}")
    start = src.rfind("{", 0, m.start())
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
        raise SystemExit(f"could not parse {slug}")
    block = src[start:end]

    def field(name: str) -> str:
        mm = re.search(rf'{name}:\s*"((?:\\.|[^"\\])*)"', block)
        return mm.group(1).replace('\\"', '"') if mm else ""

    story = re.findall(r'story:\s*\[([\s\S]*?)\]', block)
    paras: list[str] = []
    if story:
        paras = re.findall(r'"((?:\\.|[^"\\])*)"', story[0])
        paras = [p.replace('\\"', '"') for p in paras]
    return {
        "slug": slug,
        "title": field("title"),
        "poseName": field("poseName"),
        "intro": field("intro"),
        "story": paras,
    }


def script_for(a: dict[str, object]) -> str:
    lines = [
        f"Welcome to {a['title']}. Today we will practice {a['poseName']}.",
        str(a["intro"]),
    ]
    for p in a["story"]:  # type: ignore
        lines.append(str(p))
    lines.append("You did such a wonderful job. Take a big breath, and smile.")
    return " ".join(lines)


async def synth_one(slug: str, text: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    raw = OUT_DIR / f"kids-{slug}.raw.mp3"
    out = OUT_DIR / f"kids-{slug}.mp3"
    communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await communicate.save(str(raw))
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
    src = KIDS.read_text(encoding="utf-8")
    for slug in MISSING:
        print(f"Generating kids-{slug}…")
        a = extract_kids_pose(src, slug)
        out = await synth_one(slug, script_for(a))
        print(f"  → {out.name} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    asyncio.run(main())
