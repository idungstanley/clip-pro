# ViralClip AI

**100% free, offline, AI-powered viral clip detection and editor.**

Drop in any movie → AI finds the best moments → customize with text overlays → export in any format.

No API keys. No cloud. No subscriptions. Runs entirely on your machine.

---

## Quick Start

### 1. Install (run once)

```bash
./install.sh
```

This installs: FFmpeg, Python deps, Ollama, LLaMA 3, Whisper large-v3, and the frontend.

### 2. Launch

```bash
./start.sh
```

Opens at **http://localhost:3000**

---

## Requirements

| Requirement | Notes |
|---|---|
| Python 3.10+ | `python3 --version` |
| Node.js 18+ | `node --version` |
| FFmpeg | Auto-installed by `install.sh` |
| 8GB+ RAM | For Whisper large-v3 on CPU |
| GPU (optional) | NVIDIA/Apple Silicon speeds up Whisper & upscaling |
| ~10GB disk | Models cached after first download |

---

## AI Stack (all free, all local)

| Task | Tool |
|---|---|
| Scene detection | PySceneDetect |
| Transcription | faster-whisper (Whisper large-v3) |
| Viral scoring | Ollama + LLaMA 3 8B |
| Audio energy | librosa |
| Motion analysis | OpenCV |
| Face expressions | DeepFace |
| 4K upscaling | Real-ESRGAN |
| Video encoding | FFmpeg (hardware-accelerated) |

---

## Features

- **AI Viral Detection** — composite scoring from LLM, audio energy, motion, face expressions
- **Waveform Timeline Editor** — frame-accurate IN/OUT trim points
- **Text Overlay Editor** — Fabric.js canvas, 10+ cinematic fonts, animations, per-layer timing
- **4K Upscaling** — Real-ESRGAN frame-by-frame, GPU-accelerated
- **Hardware Acceleration** — auto-detects CUDA, Apple VideoToolbox, VAAPI, falls back to CPU
- **All formats** — MP4, MOV, WebM, MKV, GIF, aspect ratio conversion (9:16, 1:1, 16:9)
- **Bulk export** — batch render + ZIP download

---

## Troubleshooting

**Backend won't start**
```bash
cd backend && uvicorn main:app --port 8000
# Check the error — usually a missing pip package
```

**Ollama not responding**
```bash
ollama serve          # start Ollama
ollama list           # verify llama3 is downloaded
ollama pull llama3    # re-pull if missing
```

**Whisper running slow**
- Normal on CPU for long videos (~12 min per hour of video)
- GPU (CUDA) reduces this to ~4 min per hour
- Use a smaller model: edit `transcription.py` and change `large-v3` → `base` for faster but less accurate results

**DeepFace download errors**
- DeepFace downloads model weights on first use (~500MB)
- Ensure internet connection on first run

**Real-ESRGAN errors**
- Install via: `pip install basicsr realesrgan`
- Weights download automatically on first upscale

---

## Project Structure

```
viralclip-ai/
├── backend/
│   ├── main.py                  # FastAPI app + WebSocket
│   ├── routers/
│   │   ├── video.py             # File loading + streaming
│   │   ├── analyze.py           # AI pipeline trigger
│   │   ├── render.py            # FFmpeg clip rendering
│   │   └── export.py            # Download + ZIP
│   ├── services/
│   │   ├── scene_detection.py   # PySceneDetect
│   │   ├── transcription.py     # faster-whisper
│   │   ├── viral_scoring.py     # Ollama + LLaMA 3
│   │   ├── audio_analysis.py    # librosa
│   │   ├── visual_analysis.py   # OpenCV + DeepFace
│   │   ├── ffmpeg_service.py    # All FFmpeg commands
│   │   ├── upscaler.py          # Real-ESRGAN
│   │   ├── hw_detect.py         # GPU/CPU detection
│   │   └── job_manager.py       # WebSocket job tracking
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Upload / drag zone
│   │   ├── studio/page.tsx      # Clip list + timeline
│   │   ├── text-editor/page.tsx # Fabric.js text canvas
│   │   └── export/page.tsx      # Render + download
│   ├── components/
│   ├── hooks/
│   └── store/clipStore.ts       # Zustand global state
├── install.sh
├── start.sh
└── docker-compose.yml           # Redis (optional)
```
