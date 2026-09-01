#!/usr/bin/env python3
"""Generate Smart Egg's original, continuous and seamless adventure BGM loop.

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

# Four warm, phone-audible harmonic colours.  The previous render put almost all
# of its energy below 200 Hz: headphones could reproduce it, but a phone speaker
# made it sound as if no BGM existed.  These voices deliberately live in the
# 220-1,320 Hz range while retaining a very quiet low foundation.
#
# Frequencies are adjusted to a whole number of cycles over the 16-second loop,
# so oscillator phase is continuous at the seam.
CHORDS = (
    (261.63, 329.63, 392.00, 523.25),
    (220.00, 293.66, 369.99, 493.88),
    (246.94, 311.13, 392.00, 587.33),
    (293.66, 369.99, 440.00, 659.25),
)
VOICE_WEIGHTS = (0.36, 0.29, 0.23, 0.18)

# A legato top line, cross-faded instead of triggered as isolated notes.  It
# gives the loop a recognisable fantasy-adventure identity without restoring the
# old periodic "dot" sequencer or borrowing a melody from another game.
MELODY = (659.25, 587.33, 783.99, 698.46, 523.25, 622.25, 739.99, 587.33)


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


def melody_weights(time_seconds: float) -> tuple[tuple[int, float], tuple[int, float]]:
    note_length = DURATION_SECONDS / len(MELODY)
    note = int(time_seconds / note_length) % len(MELODY)
    note_progress = (time_seconds % note_length) / note_length
    # Spend most of each phrase on one pitch, then glide through a broad
    # cross-fade.  Both oscillators remain continuous, so there is no click or
    # short per-note audio object.
    blend = smootherstep((note_progress - 0.48) / 0.52)
    return (note, 1.0 - blend), ((note + 1) % len(MELODY), blend)


def render_sample(index: int) -> float:
    t = index / SAMPLE_RATE
    mixed = 0.0
    for chord_index, chord_gain in chord_weights(t):
        for voice_index, raw_frequency in enumerate(CHORDS[chord_index]):
            frequency = loop_frequency(raw_frequency)
            phase = 2.0 * math.pi * frequency * t + voice_index * 0.41
            # Second and third harmonics keep the body audible on small phone
            # speakers without making the loop sharp or metallic.
            voice = (
                math.sin(phase)
                + 0.24 * math.sin(phase * 2.0 + 0.27)
                + 0.10 * math.sin(phase * 3.0 + 0.53)
            )
            mixed += chord_gain * VOICE_WEIGHTS[voice_index] * voice

    melody = 0.0
    for note_index, note_gain in melody_weights(t):
        melody_frequency = loop_frequency(MELODY[note_index])
        melody_phase = 2.0 * math.pi * melody_frequency * t + 0.19
        melody += note_gain * (
            math.sin(melody_phase)
            + 0.22 * math.sin(melody_phase * 2.0 + 0.31)
        )

    # Slow breathing keeps the result continuous.  The 110 Hz foundation is
    # intentionally subordinate; the audible pad and melody carry the music.
    breathing = 0.88 + 0.07 * math.sin(2.0 * math.pi * t / 8.0)
    bass_frequency = loop_frequency(110.0)
    bass = 0.055 * math.sin(2.0 * math.pi * bass_frequency * t + 0.15)
    air_frequency = loop_frequency(1046.50)
    air = 0.055 * math.sin(2.0 * math.pi * air_frequency * t + 0.7)
    sample = (mixed * breathing + melody * 0.24 + bass + air) * 0.34
    # Gentle saturation protects headroom without a limiter click.
    return math.tanh(sample * 1.18) * 0.82


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
