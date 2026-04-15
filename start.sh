#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║       ViralClip AI — Starting        ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Redis (optional, via Docker) ─────────────────────────────────────────────
if command -v docker &>/dev/null; then
  echo "▶ Starting Redis..."
  docker run -d --name viralclip-redis -p 6379:6379 redis:7-alpine 2>/dev/null || \
  docker start viralclip-redis 2>/dev/null || \
  echo "  Redis already running or Docker unavailable (non-fatal)"
fi

# ── Ollama ────────────────────────────────────────────────────────────────────
if command -v ollama &>/dev/null; then
  echo "▶ Starting Ollama..."
  ollama serve &>/tmp/ollama.log &
  sleep 1
fi

# ── FastAPI backend ────────────────────────────────────────────────────────────
echo "▶ Starting FastAPI backend on http://localhost:8000 ..."
cd "$ROOT/backend"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd "$ROOT"

# ── Next.js frontend ───────────────────────────────────────────────────────────
echo "▶ Starting Next.js frontend on http://localhost:3000 ..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"

# ── Open browser ───────────────────────────────────────────────────────────────
sleep 3
echo ""
echo "  🎬  ViralClip AI running at http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop all services."
echo ""

case "$(uname -s)" in
  Darwin) open http://localhost:3000 ;;
  Linux)  xdg-open http://localhost:3000 2>/dev/null || true ;;
esac

# ── Trap cleanup ───────────────────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Stopping services..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

wait $BACKEND_PID $FRONTEND_PID
