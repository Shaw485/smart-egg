#!/usr/bin/env python3
"""Generate Smart Egg's original, continuous and seamless ambient BGM loop.

The runtime deliberately plays this one long asset instead of sequencing short
tones.  Keeping the render deterministic makes the Web and WeChat copies easy
to verify byte-for-byte and prevents the old 380 ms "dot sound" regression.
"""

from __future__ import annotations

import argparse
import math
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 16_000
DURATION_SECONDS = 16.0
FRAME_COUNT = int(SAMPLE_RATE * DURATION_SECONDS)

# Four airy harmonic colours.  Frequencies are adjusted to a whole number of
# cycles over the 16-second loop, so oscillator phase is continuous at the seam.
CHORDS = (
    (146.83, 220.00, 293.66, 329.63),
    (116.54, 174.61, 220.00, 293.66),
    (98.00, 146.83, 164.81, 246.94),
    (110.00, 164.81, 220.00, 293.66),
)
VOICE_WEIGHTS = (0.46, 0.31, 0.20, 0.13)


def loop_frequency(frequency: float) -> float:
    cycles = max(1, round(frequency * DURATION_SECONDS))
    return cycles / DURATION_SECONDS


def smootherstep(value: float) -> float:
    value = min(1.0, max(0.0, value))
    return value * value * value * (value * (value * 6.0 - 15.0) + 10.0)


def chord_weights(time_seconds: float) -> tuple[tuple[int, float], tuple[int, float]]:
    section_length = DURATION_SECONDS / len(CHORDS)
    section = int(time_seconds / section_length) % len(CHORDS)
    section_progress = (time_seconds % section_length) / section_length
    blend = smootherstep(section_progress)
    return (section, 1.0 - blend), ((section + 1) % len(CHORDS), blend)


def render_sample(index: int) -> float:
    t = index / SAMPLE_RATE
    mixed = 0.0
    for chord_index, chord_gain in chord_weights(t):
        for voice_index, raw_frequency in enumerate(CHORDS[chord_index]):
            frequency = loop_frequency(raw_frequency)
            phase = 2.0 * math.pi * frequency * t + voice_index * 0.41
            # A quiet second harmonic gives the pad some shape without attacks.
            voice = math.sin(phase) + 0.16 * math.sin(phase * 2.0 + 0.27)
            mixed += chord_gain * VOICE_WEIGHTS[voice_index] * voice

    # Slow periodic breathing and a continuous low layer avoid isolated notes.
    breathing = 0.82 + 0.09 * math.sin(2.0 * math.pi * t / 8.0)
    bass_frequency = loop_frequency(73.42)
    bass = 0.20 * math.sin(2.0 * math.pi * bass_frequency * t + 0.15)
    shimmer_frequency = loop_frequency(440.0)
    shimmer = 0.045 * math.sin(2.0 * math.pi * shimmer_frequency * t + 0.7)
    sample = (mixed * breathing + bass + shimmer) * 0.24
    # Gentle saturation protects headroom without a limiter click.
    return math.tanh(sample * 1.25) * 0.72


def write_wav(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(output), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for index in range(FRAME_COUNT):
            sample = int(max(-1.0, min(1.0, render_sample(index))) * 32767)
            frames.extend(struct.pack("<h", sample))
        wav.writeframes(frames)


def main() -> None:
    default_output = Path(__file__).resolve().parents[1] / "assets" / "bgm-wilds-ambient.wav"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", nargs="?", type=Path, default=default_output)
    args = parser.parse_args()
    write_wav(args.output.resolve())
    print(f"generated {args.output.resolve()} ({FRAME_COUNT} frames @ {SAMPLE_RATE} Hz)")


if __name__ == "__main__":
    main()
