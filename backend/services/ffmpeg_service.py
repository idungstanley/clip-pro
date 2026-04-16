import subprocess
import json
import os
import re
import shlex
import shutil
from pathlib import Path
from typing import Optional, List, Dict

from services.hw_detect import get_ffmpeg_encoder

# Locate ffmpeg/ffprobe at import time, checking common install paths
_SEARCH_PATHS = [
    "/opt/homebrew/bin",   # Apple Silicon Homebrew
    "/usr/local/bin",      # Intel Homebrew
    "/usr/bin",
    "/usr/local/sbin",
]

def _find_bin(name: str) -> str:
    found = shutil.which(name)
    if found:
        return found
    for d in _SEARCH_PATHS:
        p = Path(d) / name
        if p.exists():
            return str(p)
    raise FileNotFoundError(
        f"'{name}' not found. Install FFmpeg: brew install ffmpeg"
    )

FFPROBE = _find_bin("ffprobe")
FFMPEG  = _find_bin("ffmpeg")


def probe(video_path: str) -> dict:
    """Run ffprobe and return stream/format metadata."""
    result = subprocess.run(
        [
            FFPROBE, "-v", "quiet",
            "-print_format", "json",
            "-show_streams", "-show_format",
            video_path,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise ValueError(f"ffprobe failed: {result.stderr}")
    return json.loads(result.stdout)


def extract_thumbnail(video_path: str, timestamp: float, out_path: str) -> str:
    """Extract a single frame as JPEG thumbnail."""
    subprocess.run(
        [
            FFMPEG, "-y",
            "-ss", str(timestamp),
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "3",
            "-vf", "scale=320:-1",
            out_path,
        ],
        capture_output=True,
    )
    return out_path


def cut_clip(
    video_path: str,
    start: float,
    end: float,
    out_path: str,
    resolution: Optional[str] = None,
    aspect_ratio: Optional[str] = None,
    output_format: str = "mp4",
    crf: int = 23,
) -> str:
    """Cut a clip from video_path [start, end] and encode to out_path."""
    duration = end - start
    hw = get_ffmpeg_encoder()

    vf_filters = []
    if resolution and resolution != "original":
        scale_map = {
            "720p": "1280:720",
            "1080p": "1920:1080",
            "2K": "2560:1440",
            "4K": "3840:2160",
        }
        if resolution in scale_map:
            vf_filters.append(f"scale={scale_map[resolution]}:force_original_aspect_ratio=decrease,pad={scale_map[resolution]}:(ow-iw)/2:(oh-ih)/2")

    if aspect_ratio and aspect_ratio != "original":
        ar_map = {
            # Keep full height, crop width to 9/16 of height (portrait crop)
            "9:16": "trunc(ih*9/16/2)*2:trunc(ih/2)*2",
            # Crop to square using the smaller dimension
            "1:1": "trunc(min(iw\\,ih)/2)*2:trunc(min(iw\\,ih)/2)*2",
            # Keep full width, crop height to 9/16 of width (landscape crop)
            "16:9": "trunc(iw/2)*2:trunc(iw*9/16/2)*2",
        }
        if aspect_ratio in ar_map:
            w, h = ar_map[aspect_ratio].split(":", 1)
            vf_filters.append(f"crop={w}:{h}")

    cmd = [FFMPEG, "-y"]
    cmd += hw["hwaccel"]
    cmd += ["-ss", str(start), "-i", video_path, "-t", str(duration)]

    if vf_filters:
        cmd += ["-vf", ",".join(vf_filters)]

    # Codec selection
    if output_format == "gif":
        cmd += [
            "-vf", "fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
            "-loop", "0",
        ]
    elif output_format in ("mp4", "mov", "mkv"):
        if output_format == "mp4" and "h265" in out_path.lower():
            cmd += ["-c:v", "libx265", "-crf", str(crf), "-preset", "fast"]
        else:
            cmd += ["-c:v", hw["vcodec"]] + hw["extra"]
            # Override CRF if using software encoder
            if hw["vcodec"] == "libx264":
                cmd += ["-crf", str(crf)]
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    elif output_format == "webm":
        cmd += ["-c:v", "libvpx-vp9", "-crf", str(crf), "-b:v", "0", "-c:a", "libopus"]
    else:
        cmd += ["-c:v", hw["vcodec"]] + hw["extra"]
        cmd += ["-c:a", "aac", "-b:a", "192k"]

    cmd.append(out_path)
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg cut failed: {result.stderr[-500:]}")
    return out_path


def apply_text_overlays(
    input_path: str,
    out_path: str,
    layers: List[Dict],
    fonts_dir: str,
) -> str:
    """
    Burn text overlays into clip using FFmpeg drawtext filter.
    Each layer: { text, x_pct, y_pct, font, size, color, stroke_color, stroke_width,
                  alpha, animation, start_sec, end_sec }
    """
    if not layers:
        # No overlays: just copy
        subprocess.run(
            [FFMPEG, "-y", "-i", input_path, "-c", "copy", out_path],
            capture_output=True,
        )
        return out_path

    font_map = {
        "Bebas Neue": "BebasNeue-Regular.ttf",
        "Montserrat": "Montserrat-Bold.ttf",
        "Oswald": "Oswald-Bold.ttf",
        "Anton": "Anton-Regular.ttf",
        "Raleway": "Raleway-Bold.ttf",
        "Cinzel": "Cinzel-Bold.ttf",
        "Teko": "Teko-Bold.ttf",
        "Barlow Condensed": "BarlowCondensed-Bold.ttf",
        "Russo One": "RussoOne-Regular.ttf",
        "Righteous": "Righteous-Regular.ttf",
    }

    filter_parts = []
    for i, layer in enumerate(layers):
        font_file = font_map.get(layer.get("font", "Montserrat"), "Montserrat-Bold.ttf")
        font_path = os.path.join(fonts_dir, font_file)
        if not os.path.exists(font_path):
            font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

        text = layer.get("text", "").replace("'", "\\'").replace(":", "\\:")
        size = layer.get("size", 48)
        color = layer.get("color", "white")
        alpha = layer.get("alpha", 1.0)
        x_pct = layer.get("x_pct", 50) / 100.0
        y_pct = layer.get("y_pct", 80) / 100.0
        stroke_color = layer.get("stroke_color", "black")
        stroke_width = layer.get("stroke_width", 2)
        t_start = layer.get("start_sec", 0)
        t_end = layer.get("end_sec", 9999)

        x_expr = f"(w-text_w)*{x_pct:.3f}"
        y_expr = f"(h-text_h)*{y_pct:.3f}"

        dt = (
            f"drawtext=fontfile='{font_path}'"
            f":text='{text}'"
            f":fontsize={size}"
            f":fontcolor={color}@{alpha:.2f}"
            f":x={x_expr}:y={y_expr}"
            f":borderw={stroke_width}:bordercolor={stroke_color}"
            f":enable='between(t,{t_start},{t_end})'"
        )
        filter_parts.append(dt)

    vf = ",".join(filter_parts)
    cmd = [FFMPEG, "-y", "-i", input_path, "-vf", vf, "-c:a", "copy", out_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg drawtext failed: {result.stderr[-500:]}")
    return out_path


def extract_audio(video_path: str, out_path: str) -> str:
    subprocess.run(
        [FFMPEG, "-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le",
         "-ar", "44100", "-ac", "2", out_path],
        capture_output=True,
    )
    return out_path
