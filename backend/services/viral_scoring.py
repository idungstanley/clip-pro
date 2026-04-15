import json
import httpx
from typing import List, Dict


OLLAMA_URL = "http://localhost:11434/api/generate"
SYSTEM_PROMPT = """You are a viral content expert specializing in movie clips and social media.
Score each transcript segment for viral potential on a scale of 0-100.
Return ONLY a valid JSON array with no markdown, no explanation.
Each object must have: start (float), end (float), score (int 0-100), reason (string, max 15 words), scene_type (string)."""

SCENE_TYPES = ["confrontation", "humor", "revelation", "action", "emotional", "romance", "suspense", "dialogue", "other"]

SCORING_PROMPT = """Score these transcript segments from a movie for viral social media potential.
Consider: emotional intensity, quotable dialogue, plot twists, conflict/confrontation, humor, shock value.

Segments:
{segments}

Return ONLY a JSON array like:
[{{"start": 0.0, "end": 15.0, "score": 85, "reason": "Intense confrontation with iconic line", "scene_type": "confrontation"}}]"""


def score_segments(segments: List[Dict], model: str = "llama3") -> List[Dict]:
    """
    Score transcript segments using local Ollama LLM.
    Falls back to heuristic scoring if Ollama is unavailable.
    """
    if not segments:
        return []

    # Only send relevant fields to LLM
    slim = [{"start": s["start"], "end": s["end"], "text": s["text"]} for s in segments]
    prompt = SCORING_PROMPT.format(segments=json.dumps(slim, indent=2))

    try:
        response = httpx.post(
            OLLAMA_URL,
            json={
                "model": model,
                "prompt": prompt,
                "system": SYSTEM_PROMPT,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 2048},
            },
            timeout=120.0,
        )
        response.raise_for_status()
        raw = response.json().get("response", "")

        # Extract JSON from response (handle markdown code fences)
        raw = raw.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        scored = json.loads(raw)
        return scored

    except Exception as e:
        print(f"[LLM] Ollama error: {e}, using heuristic scoring")
        return _heuristic_score(segments)


def _heuristic_score(segments: List[Dict]) -> List[Dict]:
    """Simple heuristic fallback when LLM is unavailable."""
    HIGH_EMOTION_WORDS = {
        "never", "always", "love", "hate", "die", "kill", "truth", "lie",
        "betrayed", "wrong", "sorry", "please", "help", "stop", "wait",
        "impossible", "everything", "nothing", "everyone", "forever",
    }

    results = []
    for seg in segments:
        text = seg["text"].lower()
        words = text.split()
        matches = sum(1 for w in words if w.strip(".,!?") in HIGH_EMOTION_WORDS)
        length_score = min(len(words) / 20 * 30, 30)
        emotion_score = min(matches * 15, 40)
        punct_score = min(text.count("!") * 10 + text.count("?") * 8, 30)
        score = int(min(length_score + emotion_score + punct_score + 10, 100))

        scene_type = "emotional" if emotion_score > 20 else "dialogue"
        reason = f"Heuristic: {matches} emotional keywords detected"

        results.append({
            "start": seg["start"],
            "end": seg["end"],
            "score": score,
            "reason": reason,
            "scene_type": scene_type,
        })

    return results
