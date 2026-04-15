from pathlib import Path
from typing import List, Tuple
from services.ffmpeg_service import FFPROBE


def detect_scenes(video_path: str, threshold: float = 27.0) -> List[Tuple[float, float]]:
    """
    Returns list of (start_sec, end_sec) for each detected scene.
    Falls back to time-based chunking if PySceneDetect fails.
    """
    try:
        from scenedetect import detect, ContentDetector, open_video

        video = open_video(video_path)
        scene_list = detect(video_path, ContentDetector(threshold=threshold))

        scenes = []
        for scene in scene_list:
            start = scene[0].get_seconds()
            end = scene[1].get_seconds()
            if end - start >= 5.0:  # skip very short scenes
                scenes.append((start, end))

        if not scenes:
            scenes = _fallback_chunks(video_path)

        return scenes

    except Exception as e:
        print(f"[SceneDetect] Error: {e}, using fallback chunking")
        return _fallback_chunks(video_path)


def _fallback_chunks(video_path: str, chunk_size: float = 30.0) -> List[Tuple[float, float]]:
    """Split video into fixed-size chunks as fallback."""
    import subprocess, json

    result = subprocess.run(
        [
            FFPROBE, "-v", "quiet", "-print_format", "json",
            "-show_format", video_path,
        ],
        capture_output=True, text=True,
    )
    data = json.loads(result.stdout)
    duration = float(data["format"]["duration"])

    chunks = []
    t = 0.0
    while t < duration:
        end = min(t + chunk_size, duration)
        chunks.append((t, end))
        t = end

    return chunks
