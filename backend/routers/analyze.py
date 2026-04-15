import asyncio
import uuid
import os
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from services.job_manager import job_manager
from services.transcription import transcribe_segment
from services.audio_analysis import quick_segment_energy
from services.visual_analysis import quick_motion_score
from services.ffmpeg_service import extract_thumbnail, probe

TMP_DIR = Path(__file__).parent.parent / "tmp"
router = APIRouter()

_cache: dict = {}

HIGH_EMOTION = {
    "never", "always", "love", "hate", "die", "kill", "truth", "lie",
    "betrayed", "wrong", "sorry", "please", "help", "stop", "wait",
    "impossible", "everything", "nothing", "everyone", "forever", "why",
    "because", "actually", "literally", "insane", "crazy", "amazing",
    "unbelievable", "incredible", "shocking", "breaking", "finally",
    "secret", "revealed", "exposed", "caught", "found", "lost",
}


class AnalyzeRequest(BaseModel):
    video_path: str
    llm_model: str = "llama3"
    max_clips: int = 15
    clip_duration: int = 59


@router.post("/start")
async def start_analysis(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    cache_key = f"{req.video_path}:{req.clip_duration}"
    if cache_key in _cache:
        job_id = str(uuid.uuid4())
        job_manager.create(job_id)
        return {"job_id": job_id, "cached": True, "result": _cache[cache_key]}

    job_id = str(uuid.uuid4())
    job_manager.create(job_id)
    background_tasks.add_task(_run_pipeline, job_id, req)
    return {"job_id": job_id, "cached": False}


@router.get("/result/{job_id}")
async def get_result(job_id: str):
    result = job_manager.get_result(job_id)
    if result is None:
        return {"ready": False}
    return {"ready": True, "result": result}


@router.get("/status/{job_id}")
async def get_status(job_id: str):
    job = job_manager._jobs.get(job_id)
    if not job:
        return {"found": False}
    return {
        "found": True,
        "progress": job.get("progress", 0),
        "status": job.get("status", "pending"),
        "done": job.get("done", False),
        "error": job.get("error"),
        "result": job.get("result"),
    }


async def _run_pipeline(job_id: str, req: AnalyzeRequest):
    try:
        video_path = req.video_path
        clip_duration = req.clip_duration

        await job_manager.emit(job_id, "init", 2, "Reading video metadata...")
        total_duration = _get_duration(video_path)
        if total_duration <= 0:
            raise ValueError("Could not read video duration")

        # Build fixed-duration segments
        segments = []
        t = 0.0
        while t < total_duration:
            end = min(t + clip_duration, total_duration)
            if end - t >= 5.0:  # skip tiny trailing segments
                segments.append((t, end))
            t = end

        n = len(segments)
        moments = []

        for i, (start, end) in enumerate(segments):
            pct = int(5 + (i / n) * 88)
            await job_manager.emit(
                job_id, "processing", pct,
                f"Analyzing clip {i + 1} of {n}..."
            )

            # Run transcription, motion, and energy concurrently
            transcript, motion, energy = await asyncio.gather(
                asyncio.to_thread(transcribe_segment, video_path, start, end),
                asyncio.to_thread(quick_motion_score, video_path, start, end),
                asyncio.to_thread(quick_segment_energy, video_path, start, end),
            )

            # Thumbnail
            thumb_time = (start + end) / 2
            thumb_path = str(TMP_DIR / f"thumb_{job_id}_{i}.jpg")
            try:
                await asyncio.to_thread(extract_thumbnail, video_path, thumb_time, thumb_path)
                thumbnail = f"/tmp/thumb_{job_id}_{i}.jpg"
            except Exception:
                thumbnail = None

            score, reason, scene_type = _score_clip(transcript, motion, energy)

            clip = {
                "id": f"clip_{i}",
                "start_time": round(start, 2),
                "end_time": round(end, 2),
                "trim_start": round(start, 2),
                "trim_end": round(end, 2),
                "viral_score": score,
                "reason": reason,
                "transcript": transcript[:400] if transcript else "",
                "scene_type": scene_type,
                "audio_energy": round(energy, 3),
                "motion_score": round(motion, 3),
                "face_intensity": 0.0,
                "thumbnail": thumbnail,
                "selected": False,
            }
            moments.append(clip)

            # Emit this clip immediately so frontend can show it
            await job_manager.emit(
                job_id, "clip_ready", pct,
                f"Clip {i + 1} ready", {"clip": clip}
            )

        # Sort by score descending for final result
        moments.sort(key=lambda x: x["viral_score"], reverse=True)
        moments = moments[:req.max_clips]

        cache_key = f"{video_path}:{req.clip_duration}"
        _cache[cache_key] = moments
        await job_manager.finish(job_id, {"moments": moments})

    except Exception as e:
        import traceback
        traceback.print_exc()
        await job_manager.error(job_id, str(e))


def _get_duration(video_path: str) -> float:
    try:
        data = probe(video_path)
        return float(data.get("format", {}).get("duration", 0))
    except Exception:
        return 0.0


def _score_clip(transcript: str, motion: float, energy: float) -> tuple[int, str, str]:
    text = (transcript or "").lower()
    words = text.split()

    matches = [w.strip(".,!?\"'") for w in words if w.strip(".,!?\"'") in HIGH_EMOTION]
    emotion_score = min(len(matches) * 12, 40)
    length_bonus = min(len(words) / 30 * 15, 15)
    punct_score = min(text.count("!") * 8 + text.count("?") * 6, 20)
    text_component = (emotion_score + length_bonus + punct_score) / 75.0

    composite = (
        text_component * 0.35 +
        energy         * 0.35 +
        motion         * 0.30
    )
    final = min(int(composite * 100) + 15, 100)

    if energy > 0.7:
        scene_type = "action"
    elif emotion_score > 24:
        scene_type = "emotional"
    elif punct_score > 10:
        scene_type = "confrontation"
    else:
        scene_type = "dialogue"

    if matches:
        reason = f"Keywords: {', '.join(matches[:3])}"
    elif energy > 0.6:
        reason = "High audio energy peak"
    elif motion > 0.5:
        reason = "High motion activity"
    else:
        reason = f"{len(words)}-word segment"

    return final, reason, scene_type
