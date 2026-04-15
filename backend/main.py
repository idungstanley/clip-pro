import asyncio
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from routers import video, analyze, render, export
from services.job_manager import job_manager

TMP_DIR = Path(__file__).parent / "tmp"
TMP_DIR.mkdir(exist_ok=True)

_API_KEY = os.getenv("API_KEY", "")
_CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _API_KEY:
        print("ViralClip AI backend starting... (API key auth enabled)")
    else:
        print("ViralClip AI backend starting... (WARNING: no API_KEY set, auth disabled)")
    yield
    print("Shutting down...")


app = FastAPI(title="ViralClip AI", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    # Skip auth if no API_KEY is configured (local dev)
    if not _API_KEY:
        return await call_next(request)
    # Always allow health check
    if request.url.path == "/health":
        return await call_next(request)
    # WebSocket auth via query param: /ws/job/{id}?api_key=...
    if request.url.path.startswith("/ws/"):
        if request.query_params.get("api_key") == _API_KEY:
            return await call_next(request)
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    # HTTP auth: header or query param (query param needed for <video src> / <img src>)
    if request.headers.get("X-API-Key") == _API_KEY:
        return await call_next(request)
    if request.query_params.get("api_key") == _API_KEY:
        return await call_next(request)
    return JSONResponse({"detail": "Unauthorized"}, status_code=401)

app.include_router(video.router, prefix="/api/video", tags=["video"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(render.router, prefix="/api/render", tags=["render"])
app.include_router(export.router, prefix="/api/export", tags=["export"])

# Serve temp files (thumbnails, previews, outputs)
app.mount("/tmp", StaticFiles(directory=str(TMP_DIR)), name="tmp")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.websocket("/ws/job/{job_id}")
async def websocket_job(websocket: WebSocket, job_id: str):
    await websocket.accept()
    job_manager.register_ws(job_id, websocket)
    try:
        while True:
            # Keep connection alive; server pushes events
            await asyncio.sleep(1)
            if job_manager.is_done(job_id):
                break
    except WebSocketDisconnect:
        pass
    finally:
        job_manager.unregister_ws(job_id)
