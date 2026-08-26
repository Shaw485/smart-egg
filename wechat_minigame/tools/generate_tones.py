#!/usr/bin/env python3
"""Generate tiny mono WAV tones used by the InnerAudioContext fallback."""

import math
import pathlib
import struct
import wave


ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SAMPLE_RATE = 16_000
DURATION_SECONDS = 0.9


def write_tone(frequency: int) -> None:
    target = ASSETS / f"tone-{frequency}.wav"
    frame_count = int(SAMPLE_RATE * DURATION_SECONDS)
    with wave.open(str(target), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for index in range(frame_count):
            time = index / SAMPLE_RATE
            fade = min(1.0, time / 0.012, (DURATION_SECONDS - time) / 0.08)
            sample = int(7_000 * max(0.0, fade) * math.sin(2 * math.pi * frequency * time))
            frames.extend(struct.pack("<h", sample))
        output.writeframes(frames)


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    for tone in (110, 440, 880):
        write_tone(tone)
