#!/usr/bin/env python3
"""Generate deterministic mono WAV assets used by the InnerAudioContext fallback."""

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


def write_jump_action() -> None:
    """Generate a short descending kick/whoosh instead of an electronic jump beep."""
    target = ASSETS / "sfx-jump-action.wav"
    duration = 0.24
    frame_count = int(SAMPLE_RATE * duration)
    phase = 0.0
    noise_state = 0x5EED1234
    previous_noise = 0.0
    with wave.open(str(target), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for index in range(frame_count):
            time = index / SAMPLE_RATE
            progress = time / duration
            frequency = 190.0 - 118.0 * (progress ** 0.72)
            phase += 2 * math.pi * frequency / SAMPLE_RATE
            attack = min(1.0, time / 0.006)
            body_envelope = attack * ((1.0 - progress) ** 2.25)
            body = math.sin(phase) + 0.16 * math.sin(phase * 2.0)

            # Deterministic high-passed noise gives a light fabric/air movement texture.
            noise_state = (1664525 * noise_state + 1013904223) & 0xFFFFFFFF
            noise = ((noise_state / 0xFFFFFFFF) * 2.0) - 1.0
            high_noise = noise - previous_noise * 0.82
            previous_noise = noise
            whoosh_envelope = attack * math.sin(math.pi * progress) * ((1.0 - progress) ** 0.7)
            mixed = body * body_envelope * 0.72 + high_noise * whoosh_envelope * 0.10
            sample = max(-32767, min(32767, int(11_500 * mixed)))
            frames.extend(struct.pack("<h", sample))
        output.writeframes(frames)


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    for tone in (110, 440, 880):
        write_tone(tone)
    write_jump_action()
