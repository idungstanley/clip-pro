import platform
import subprocess
import shutil


def cuda_available() -> bool:
    try:
        result = subprocess.run(
            ["nvidia-smi"], capture_output=True, timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


def apple_silicon() -> bool:
    return platform.system() == "Darwin" and platform.machine() == "arm64"


def vaapi_available() -> bool:
    import os
    return os.path.exists("/dev/dri/renderD128")


def get_ffmpeg_encoder() -> dict:
    """Returns dict with hwaccel flags and video codec for ffmpeg."""
    if cuda_available():
        return {
            "hwaccel": ["-hwaccel", "cuda"],
            "vcodec": "h264_nvenc",
            "extra": ["-preset", "p4", "-cq", "23"],
        }
    elif apple_silicon():
        return {
            "hwaccel": ["-hwaccel", "videotoolbox"],
            "vcodec": "h264_videotoolbox",
            "extra": ["-b:v", "0", "-q:v", "65"],
        }
    elif vaapi_available():
        return {
            "hwaccel": ["-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi"],
            "vcodec": "h264_vaapi",
            "extra": [],
        }
    else:
        return {
            "hwaccel": [],
            "vcodec": "libx264",
            "extra": ["-preset", "fast", "-crf", "23"],
        }


def get_whisper_device() -> tuple[str, str]:
    """Returns (device, compute_type) for faster-whisper."""
    if cuda_available():
        return "cuda", "float16"
    if apple_silicon():
        # faster-whisper doesn't support MPS natively; use CPU with int8
        # but we keep this branch explicit so model size can be tuned per platform
        return "cpu", "int8"
    return "cpu", "int8"


def get_realesrgan_backend() -> str:
    if cuda_available():
        return "cuda"
    elif apple_silicon():
        return "mps"
    return "cpu"
