import os
import subprocess
import tempfile
from typing import List, Dict
from services.hw_detect import get_whisper_device

_model = None


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        device, compute_type = get_whisper_device()
        print(f"[Whisper] Loading tiny on {device} ({compute_type})")
        _model = WhisperModel("tiny", device=device, compute_type=compute_type)
    return _model


def _ffmpeg_bin() -> str:
    import shutil
    for path in ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"]:
        if os.path.exists(path):
            return path
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise FileNotFoundError("ffmpeg not found")


def transcribe_segment(video_path: str, start: float, end: float) -> str:
    """
    Extract audio for [start, end] and transcribe with Whisper tiny.
    Returns combined transcript text.
    """
    duration = end - start
    tmp = tempfile.mktemp(suffix=".wav")
    try:
        ffmpeg = _ffmpeg_bin()
        subprocess.run(
            [
                ffmpeg, "-y",
                "-ss", str(start),
                "-i", video_path,
                "-t", str(duration),
                "-vn", "-ar", "16000", "-ac", "1",
                tmp,
            ],
            capture_output=True,
        )

        if not os.path.exists(tmp) or os.path.getsize(tmp) < 1000:
            return ""

        model = get_model()
        segments_raw, _ = model.transcribe(
            tmp,
            beam_size=1,
            word_timestamps=False,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return " ".join(s.text.strip() for s in segments_raw)

    except Exception as e:
        print(f"[Whisper] Segment error ({start:.1f}-{end:.1f}s): {e}")
        return ""
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


# Keep legacy full-video transcription for any other callers
def transcribe(video_path: str) -> List[Dict]:
    model = get_model()
    segments_raw, _ = model.transcribe(
        video_path,
        beam_size=1,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    segments = []
    for seg in segments_raw:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({"start": w.start, "end": w.end, "word": w.word})
        segments.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text.strip(),
            "words": words,
        })
    return segments
