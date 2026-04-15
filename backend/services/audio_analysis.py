import subprocess
import tempfile
import os
from typing import List, Dict
from services.ffmpeg_service import FFMPEG


def quick_segment_energy(video_path: str, start: float, end: float) -> float:
    """
    Fast RMS audio energy for a segment using ffmpeg volumedetect.
    Returns normalized 0.0–1.0. No Python audio libs needed.
    """
    try:
        duration = end - start
        result = subprocess.run(
            [
                FFMPEG,
                "-ss", str(start),
                "-i", video_path,
                "-t", str(duration),
                "-vn",
                "-af", "volumedetect",
                "-f", "null", "/dev/null",
            ],
            capture_output=True,
            text=True,
        )
        for line in result.stderr.split("\n"):
            if "mean_volume" in line:
                # e.g. "mean_volume: -23.5 dB"
                db = float(line.split("mean_volume:")[1].split("dB")[0].strip())
                # Map [-60, 0] dB → [0, 1]
                return max(0.0, min(1.0, (db + 60.0) / 60.0))
        return 0.5
    except Exception:
        return 0.5


def analyze_audio_energy(video_path: str) -> List[Dict]:
    """
    Returns list of { time, energy } dicts for the full video.
    Energy is normalized 0.0–1.0.
    """
    try:
        import librosa
        import numpy as np

        tmp_wav = tempfile.mktemp(suffix=".wav")
        subprocess.run(
            [FFMPEG, "-i", video_path, "-vn", "-acodec", "pcm_s16le",
             "-ar", "16000", "-ac", "1", tmp_wav, "-y"],
            capture_output=True,
        )

        y, sr = librosa.load(tmp_wav, sr=16000)
        os.unlink(tmp_wav)

        hop_length = int(sr * 0.5)
        frame_length = int(sr * 1.0)
        rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]

        rms_max = rms.max() if rms.max() > 0 else 1.0
        rms_norm = rms / rms_max

        times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop_length)
        return [{"time": float(t), "energy": float(e)} for t, e in zip(times, rms_norm)]

    except Exception as e:
        print(f"[AudioAnalysis] Error: {e}")
        return []


def get_segment_energy(energy_timeline: List[Dict], start: float, end: float) -> float:
    if not energy_timeline:
        return 0.5
    values = [e["energy"] for e in energy_timeline if start <= e["time"] <= end]
    return float(sum(values) / len(values)) if values else 0.5
