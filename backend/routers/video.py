import os
import json
import subprocess
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel

from services.ffmpeg_service import probe, extract_thumbnail

router = APIRouter()

TMP_DIR = Path(__file__).parent.parent / "tmp"
UPLOADS_DIR = TMP_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


class VideoPathRequest(BaseModel):
    path: str


class FolderPickerRequest(BaseModel):
    initial: str = str(Path.home())


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """
    Accept a video file upload from the browser, save to tmp/uploads/,
    return same metadata as /load.
    """
    safe_name = Path(file.filename).name  # strip any directory traversal
    dest = UPLOADS_DIR / safe_name

    if not dest.exists():
        contents = await file.read()
        dest.write_bytes(contents)

    return await _build_metadata(str(dest))


@router.post("/load")
async def load_video(req: VideoPathRequest):
    """Validate video path and return metadata."""
    path = req.path.strip()
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return await _build_metadata(path)


async def _build_metadata(path: str) -> dict:
    try:
        data = probe(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    video_stream = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    audio_stream = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    fmt = data.get("format", {})

    duration = float(fmt.get("duration", 0))
    size_bytes = int(fmt.get("size", 0))

    thumb_time = max(0, duration * 0.05)
    thumb_path = str(TMP_DIR / "preview_thumb.jpg")
    try:
        extract_thumbnail(path, thumb_time, thumb_path)
        thumb_url = "/tmp/preview_thumb.jpg"
    except Exception:
        thumb_url = None

    return {
        "path": path,
        "filename": os.path.basename(path),
        "duration": duration,
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / 1024 / 1024, 1),
        "width": video_stream.get("width") if video_stream else None,
        "height": video_stream.get("height") if video_stream else None,
        "fps": _parse_fps(video_stream.get("r_frame_rate", "24/1")) if video_stream else 24.0,
        "codec": video_stream.get("codec_name") if video_stream else None,
        "audio_codec": audio_stream.get("codec_name") if audio_stream else None,
        "thumbnail_url": thumb_url,
    }


@router.get("/stream")
async def stream_video(path: str):
    """Serve a local video file as a range-compatible stream for browser playback."""
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    file_size = os.path.getsize(path)
    content_type = _mime_type(path)

    def iterfile():
        with open(path, "rb") as f:
            while chunk := f.read(1024 * 1024):  # 1MB chunks
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type=content_type,
        headers={
            "Content-Length": str(file_size),
            "Accept-Ranges": "bytes",
        },
    )


@router.post("/open-folder")
async def open_folder(req: FolderPickerRequest):
    """Open a folder in the OS file manager."""
    path = req.initial
    if not os.path.isdir(path):
        raise HTTPException(status_code=404, detail="Directory not found")

    import platform
    try:
        if platform.system() == "Darwin":
            subprocess.Popen(["open", path])
        elif platform.system() == "Windows":
            subprocess.Popen(["explorer", path])
        else:
            subprocess.Popen(["xdg-open", path])
    except Exception:
        pass

    return {"opened": path}


def _parse_fps(fps_str: str) -> float:
    try:
        num, den = fps_str.split("/")
        return round(int(num) / max(int(den), 1), 3)
    except Exception:
        return 24.0


def _mime_type(path: str) -> str:
    ext = Path(path).suffix.lower()
    return {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".avi": "video/x-msvideo",
    }.get(ext, "video/mp4")
