from typing import List, Dict


def quick_motion_score(video_path: str, start: float, end: float, n_samples: int = 6) -> float:
    """
    Sample n_samples frames across [start, end] and compute average frame diff.
    Frames are resized small for speed. Returns 0.0–1.0.
    """
    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return 0.5

        duration = end - start
        step = duration / max(n_samples, 1)

        frames = []
        for i in range(n_samples + 1):
            t = start + step * i
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ret, frame = cap.read()
            if ret:
                small = cv2.resize(frame, (160, 90))
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                frames.append(gray)

        cap.release()

        if len(frames) < 2:
            return 0.5

        diffs = [
            float(cv2.absdiff(frames[i - 1], frames[i]).mean()) / 255.0
            for i in range(1, len(frames))
        ]
        return float(sum(diffs) / len(diffs))

    except Exception as e:
        print(f"[VisualAnalysis] Motion error: {e}")
        return 0.5


def analyze_motion(video_path: str, sample_fps: float = 1.0) -> List[Dict]:
    """
    Full-video motion timeline using seek-based sampling.
    Returns list of { time, motion_score } normalized 0.0–1.0.
    """
    try:
        import cv2
        import numpy as np

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return []

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps
        step = 1.0 / sample_fps

        prev_gray = None
        results = []
        t = 0.0

        while t < duration:
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                diff = cv2.absdiff(prev_gray, gray)
                results.append({"time": t, "motion_score": float(diff.mean()) / 255.0})

            prev_gray = gray
            t += step

        cap.release()

        if results:
            max_val = max(r["motion_score"] for r in results) or 1.0
            for r in results:
                r["motion_score"] = r["motion_score"] / max_val

        return results

    except Exception as e:
        print(f"[VisualAnalysis] Motion error: {e}")
        return []


def analyze_faces(video_path: str, scenes: List) -> List[Dict]:
    try:
        from deepface import DeepFace
        import cv2

        cap = cv2.VideoCapture(video_path)
        results = []
        HIGH_EMOTION = {"angry", "fear", "surprise", "disgust"}

        for scene_start, scene_end in scenes:
            mid_time = (scene_start + scene_end) / 2
            cap.set(cv2.CAP_PROP_POS_MSEC, mid_time * 1000)
            ret, frame = cap.read()
            if not ret:
                results.append({"start": scene_start, "end": scene_end, "face_score": 0.0})
                continue
            try:
                analysis = DeepFace.analyze(frame, actions=["emotion"],
                                            enforce_detection=False, silent=True)
                if isinstance(analysis, list):
                    analysis = analysis[0]
                emotions = analysis.get("emotion", {})
                score = min(sum(emotions.get(e, 0) for e in HIGH_EMOTION) / 100.0, 1.0)
            except Exception:
                score = 0.0
            results.append({"start": scene_start, "end": scene_end, "face_score": score})

        cap.release()
        return results

    except Exception as e:
        print(f"[VisualAnalysis] Face error: {e}")
        return [{"start": s, "end": e, "face_score": 0.0} for s, e in scenes]


def get_segment_motion(motion_timeline: List[Dict], start: float, end: float) -> float:
    if not motion_timeline:
        return 0.5
    values = [m["motion_score"] for m in motion_timeline if start <= m["time"] <= end]
    return float(sum(values) / len(values)) if values else 0.5
