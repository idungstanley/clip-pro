#!/usr/bin/env bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      ViralClip AI — Installer        ║"
echo "╚══════════════════════════════════════╝"
echo ""

OS="$(uname -s)"
ARCH="$(uname -m)"

# ── FFmpeg ──────────────────────────────────────────────────────────────────
echo "▶ Checking FFmpeg..."
if ! command -v ffmpeg &>/dev/null; then
  echo "  Installing FFmpeg..."
  case "$OS" in
    Darwin)  brew install ffmpeg ;;
    Linux)   sudo apt-get install -y ffmpeg 2>/dev/null || sudo yum install -y ffmpeg ;;
    MINGW*|CYGWIN*|MSYS*) echo "  Windows: install FFmpeg from https://ffmpeg.org/download.html and add to PATH" ;;
  esac
else
  echo "  FFmpeg already installed: $(ffmpeg -version 2>&1 | head -1)"
fi

# ── Python dependencies ──────────────────────────────────────────────────────
echo ""
echo "▶ Installing Python packages..."
pip install --upgrade pip -q

pip install \
  fastapi==0.111.0 \
  "uvicorn[standard]==0.29.0" \
  python-multipart==0.0.9 \
  websockets==12.0 \
  aiofiles==23.2.1 \
  httpx==0.27.0 \
  faster-whisper==1.0.1 \
  "scenedetect[opencv]==0.6.3" \
  librosa==0.10.2 \
  opencv-python==4.9.0.80 \
  deepface==0.0.91 \
  basicsr==1.4.2 \
  realesrgan==0.3.0 \
  Pillow==10.3.0 \
  numpy==1.26.4 \
  redis==5.0.4 \
  python-dotenv==1.0.1 \
  psutil==5.9.8

echo "  Python packages installed."

# ── Ollama ───────────────────────────────────────────────────────────────────
echo ""
echo "▶ Installing Ollama (local LLM runner)..."
if ! command -v ollama &>/dev/null; then
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "  Ollama already installed."
fi

echo ""
echo "▶ Pulling LLaMA 3 model (this downloads ~4.7GB once, cached forever)..."
echo "  (Press Ctrl+C to skip and use mistral instead)"
ollama pull llama3 || ollama pull mistral

# ── Whisper model pre-cache ───────────────────────────────────────────────────
echo ""
echo "▶ Pre-caching Whisper large-v3 model (downloads ~3GB once)..."
python3 -c "
from faster_whisper import WhisperModel
print('  Downloading Whisper large-v3...')
WhisperModel('large-v3', device='cpu', compute_type='int8')
print('  Whisper model cached.')
"

# ── Node / Frontend ───────────────────────────────────────────────────────────
echo ""
echo "▶ Installing frontend dependencies..."
cd "$(dirname "$0")/frontend"
npm install
cd ..

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  ✅  Installation complete!          ║"
echo "║  Run ./start.sh to launch the app   ║"
echo "╚══════════════════════════════════════╝"
echo ""
