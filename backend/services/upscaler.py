import subprocess
import os
import tempfile
import shutil
from pathlib import Path

from services.hw_detect import get_realesrgan_backend
from services.ffmpeg_service import FFMPEG, FFPROBE


def upscale_clip(
    input_path: str,
    output_path: str,
    target_scale: int = 4,  # 2 or 4
    model: str = "RealESRGAN_x4plus",
    tmp_dir: str = "/tmp/realesrgan",
) -> str:
    """
    Upscale video using Real-ESRGAN frame-by-frame.
    1. Extract frames with FFmpeg
    2. Run Real-ESRGAN on frames
    3. Reassemble with FFmpeg + original audio
    """
    frames_in = os.path.join(tmp_dir, "frames_in")
    frames_out = os.path.join(tmp_dir, "frames_out")
    os.makedirs(frames_in, exist_ok=True)
    os.makedirs(frames_out, exist_ok=True)

    # Get video FPS
    import json
    probe = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json",
         "-show_streams", input_path],
        capture_output=True, text=True,
    )
    streams = json.loads(probe.stdout).get("streams", [])
    fps = "24"
    for s in streams:
        if s.get("codec_type") == "video":
            fps_raw = s.get("r_frame_rate", "24/1")
            num, den = fps_raw.split("/")
            fps = str(round(int(num) / max(int(den), 1), 3))
            break

    # Step 1: Extract frames
    subprocess.run(
        [FFMPEG, "-y", "-i", input_path,
         os.path.join(frames_in, "frame%06d.png")],
        capture_output=True,
    )

    # Step 2: Real-ESRGAN
    backend = get_realesrgan_backend()
    try:
        _run_realesrgan_python(frames_in, frames_out, model, target_scale)
    except Exception as e:
        print(f"[Upscaler] Python Real-ESRGAN failed ({e}), trying binary fallback")
        _run_realesrgan_binary(frames_in, frames_out, model, target_scale)

    # Step 3: Reassemble
    audio_tmp = tempfile.mktemp(suffix=".aac")
    subprocess.run(
        [FFMPEG, "-y", "-i", input_path, "-vn", "-acodec", "copy", audio_tmp],
        capture_output=True,
    )

    frame_pattern = os.path.join(frames_out, "frame%06d.png")
    cmd = [
        FFMPEG, "-y",
        "-framerate", fps,
        "-i", frame_pattern,
        "-i", audio_tmp,
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-c:a", "copy",
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)

    # Cleanup
    shutil.rmtree(frames_in, ignore_errors=True)
    shutil.rmtree(frames_out, ignore_errors=True)
    try:
        os.unlink(audio_tmp)
    except Exception:
        pass

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg reassemble failed: {result.stderr[-300:]}")

    return output_path


def _run_realesrgan_python(frames_in: str, frames_out: str, model: str, scale: int):
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer
    import cv2
    import numpy as np
    from PIL import Image

    net = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=scale)
    upsampler = RealESRGANer(
        scale=scale,
        model_path=f"https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/{model}.pth",
        model=net,
        tile=256,
        tile_pad=10,
        pre_pad=0,
        half=False,
    )

    frames = sorted(os.listdir(frames_in))
    for fname in frames:
        img = cv2.imread(os.path.join(frames_in, fname), cv2.IMREAD_UNCHANGED)
        out, _ = upsampler.enhance(img, outscale=scale)
        cv2.imwrite(os.path.join(frames_out, fname), out)


def _run_realesrgan_binary(frames_in: str, frames_out: str, model: str, scale: int):
    """Try system realesrgan-ncnn-vulkan binary."""
    binary = shutil.which("realesrgan-ncnn-vulkan")
    if not binary:
        raise FileNotFoundError("realesrgan-ncnn-vulkan not found")

    result = subprocess.run(
        [binary, "-i", frames_in, "-o", frames_out, "-n", model, "-s", str(scale)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr)
