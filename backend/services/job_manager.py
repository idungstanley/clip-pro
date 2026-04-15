import asyncio
import json
from typing import Dict, Optional
from fastapi import WebSocket


class JobManager:
    def __init__(self):
        self._jobs: Dict[str, dict] = {}
        self._sockets: Dict[str, WebSocket] = {}

    def create(self, job_id: str):
        self._jobs[job_id] = {"status": "pending", "progress": 0, "done": False, "result": None, "error": None}

    def register_ws(self, job_id: str, ws: WebSocket):
        self._sockets[job_id] = ws

    def unregister_ws(self, job_id: str):
        self._sockets.pop(job_id, None)

    def is_done(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        return job.get("done", False) if job else True

    async def emit(self, job_id: str, stage: str, pct: int, message: str, data: Optional[dict] = None):
        event = {"stage": stage, "pct": pct, "message": message}
        if data:
            event["data"] = data

        job = self._jobs.get(job_id)
        if job:
            job["progress"] = pct
            job["status"] = stage

        ws = self._sockets.get(job_id)
        if ws:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                pass

    async def finish(self, job_id: str, result: dict):
        job = self._jobs.get(job_id)
        if job:
            job["done"] = True
            job["result"] = result

        ws = self._sockets.get(job_id)
        if ws:
            try:
                await ws.send_text(json.dumps({
                    "stage": "done",
                    "pct": 100,
                    "message": "All clips ready!",
                    "data": result,
                }))
            except Exception:
                pass

    async def error(self, job_id: str, message: str):
        job = self._jobs.get(job_id)
        if job:
            job["done"] = True
            job["status"] = "error"
            job["error"] = message

        ws = self._sockets.get(job_id)
        if ws:
            try:
                await ws.send_text(json.dumps({
                    "stage": "error",
                    "pct": 0,
                    "message": message,
                }))
            except Exception:
                pass

    def get_result(self, job_id: str) -> Optional[dict]:
        job = self._jobs.get(job_id)
        return job.get("result") if job else None


job_manager = JobManager()
