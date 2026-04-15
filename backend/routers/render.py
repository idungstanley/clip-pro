import asyncio
import uuid
import os
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

from services.job_manager import job_manager
from services.ffmpeg_service import cut_clip, apply_text_overlays
from services.upscaler import upscale_clip

router = APIRouter()
TMP_DIR = Path(__file__).parent.parent / "tmp"
FONTS_DIR = Path(__file__).parent.parent / "fonts"
OUTPUT_DIR = TMP_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


class TextLayer(BaseModel):
    text: str
    x_pct: float = 50.0
    y_pct: float = 80.0
    font: str = "Montserrat"
    size: int = 48
    color: str = "white"
    alpha: float = 1.0
    stroke_color: str = "black"
    stroke_width: int = 2
    animation: str = "none"
    start_sec: float = 0.0
    end_sec: float = 9999.0


class ClipRenderRequest(BaseModel):
    clip_id: str
    video_path: str
    start_time: float
    end_time: float
    text_layers: List[TextLayer] = []
    output_format: str = "mp4"
    resolution: Optional[str] = None
    aspect_ratio: Optional[str] = None
    crf: int = 23
    upscale: bool = False
    upscale_target: str = "4K"
    output_dir: Optional[str] = None


class BatchRenderRequest(BaseModel):
    clips: List[ClipRenderRequest]


@router.post("/clip")
async def render_clip(req: ClipRenderRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    job_manager.create(job_id)
    background_tasks.add_task(_render_single, job_id, req)
    return {"job_id": job_id}


@router.post("/batch")
async def render_batch(req: BatchRenderRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    job_manager.create(job_id)
    background_tasks.add_task(_render_batch, job_id, req.clips)
    return {"job_id": job_id}


async def _render_single(job_id: str, req: ClipRenderRequest):
    try:
        out_dir = Path(req.output_dir) if req.output_dir else OUTPUT_DIR
        out_dir.mkdir(parents=True, exist_ok=True)

        ext = "gif" if req.output_format == "gif" else req.output_format
        raw_path = str(out_dir / f"{req.clip_id}_raw.{ext}")
        final_path = str(out_dir / f"{req.clip_id}.{ext}")

        await job_manager.emit(job_id, "rendering", 20, f"Cutting clip {req.clip_id}...")
        await asyncio.to_thread(
            cut_clip, req.video_path, req.start_time, req.end_time,
            raw_path, req.resolution, req.aspect_ratio, req.output_format, req.crf,
        )

        current_path = raw_path

        if req.text_layers and req.output_format != "gif":
            await job_manager.emit(job_id, "text_overlay", 60, "Burning in text overlays...")
            text_path = str(out_dir / f"{req.clip_id}_text.{ext}")
            layers = [layer.dict() for layer in req.text_layers]
            await asyncio.to_thread(
                apply_text_overlays, current_path, text_path, layers, str(FONTS_DIR)
            )
            current_path = text_path

        if req.upscale and req.output_format != "gif":
            await job_manager.emit(job_id, "upscaling", 75, f"Upscaling to {req.upscale_target}...")
            scale_map = {"1080p": 2, "2K": 2, "4K": 4}
            scale = scale_map.get(req.upscale_target, 4)
            up_path = str(out_dir / f"{req.clip_id}_upscaled.{ext}")
            await asyncio.to_thread(upscale_clip, current_path, up_path, scale)
            current_path = up_path

        # Move to final path
        import shutil
        shutil.move(current_path, final_path)

        size = os.path.getsize(final_path)
        await job_manager.finish(job_id, {
            "clip_id": req.clip_id,
            "path": final_path,
            "url": f"/tmp/output/{req.clip_id}.{ext}",
            "size_bytes": size,
            "size_mb": round(size / 1024 / 1024, 1),
            "format": req.output_format,
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        await job_manager.error(job_id, str(e))


async def _render_batch(job_id: str, clips: List[ClipRenderRequest]):
    results = []
    total = len(clips)

    for i, clip_req in enumerate(clips):
        pct = int((i / total) * 90)
        await job_manager.emit(job_id, "rendering", pct, f"Rendering clip {i+1} of {total}...")

        try:
            sub_job_id = str(uuid.uuid4())
            job_manager.create(sub_job_id)
            await _render_single(sub_job_id, clip_req)
            result = job_manager.get_result(sub_job_id)
            if result:
                results.append(result)
        except Exception as e:
            results.append({"clip_id": clip_req.clip_id, "error": str(e)})

    await job_manager.finish(job_id, {"clips": results, "total": total})
