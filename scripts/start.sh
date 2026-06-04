#!/usr/bin/env bash
# Launch the Lyzr Underwriting Copilot:
#   1) FastAPI backend on :8000
#   2) Vite/React frontend on :5173
#   3) Open the dashboard in the default browser
#
# Usage:  ./start.sh              (or:  bash start.sh)
#         ./start.sh --no-cache    fresh venv + pip + node_modules (no reuse)
# Stop:   Ctrl-C (both processes are killed via trap)

set -euo pipefail

NO_CACHE=false
for arg in "$@"; do
  case "$arg" in
    --no-cache|--fresh) NO_CACHE=true ;;
    -h|--help)
      echo "Usage: $0 [--no-cache]"
      echo "  --no-cache  Remove backend/.venv and frontend/node_modules before starting"
      exit 0
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"

# ANSI-C quoting so the escapes are *real* control characters, not literal
# backslash sequences — this lets them survive being passed through `%s`.
CYAN=$'\033[38;5;87m'
DIM=$'\033[2m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

log() { printf '%s▌%s %s\n' "$CYAN" "$RESET" "$*"; }
dim() { printf '%s  %s%s\n'  "$DIM"  "$*" "$RESET"; }

# ─── cleanup ────────────────────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  echo
  log "Shutting down…"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID"  ]] && kill "$BACKEND_PID"  2>/dev/null || true
  wait 2>/dev/null || true
  log "Stopped."
}
trap cleanup EXIT INT TERM

# ─── prerequisite checks ────────────────────────────────────────────────────
command -v python3 >/dev/null 2>&1 || { echo "✗ python3 not found"; exit 1; }
command -v yarn    >/dev/null 2>&1 || { echo "✗ yarn not found";    exit 1; }

# Prefer python3.13 → 3.12 → 3.11 → python3. pydantic-core wheels for Python
# 3.14 only started shipping recently and source builds need a full Rust
# toolchain — so we try older interpreters first.
PY_CANDIDATES=(python3.13 python3.12 python3.11 python3)

# Some Homebrew Python installs ship a broken `ensurepip`, so a plain
# `python -m venv` fails. This helper tries the standard path first and
# falls back to `--without-pip` + bootstrapping pip via get-pip.py.
make_venv() {
  local py="$1"
  rm -rf .venv
  if "$py" -m venv .venv >/dev/null 2>&1 && [[ -x .venv/bin/pip ]]; then
    return 0
  fi
  rm -rf .venv
  dim "Standard venv failed for $py — falling back to --without-pip + get-pip.py"
  if ! "$py" -m venv --without-pip .venv >/dev/null 2>&1; then
    return 1
  fi
  if ! curl -fsSL https://bootstrap.pypa.io/get-pip.py \
       | .venv/bin/python - --quiet >/dev/null 2>&1; then
    rm -rf .venv
    return 1
  fi
  return 0
}

cd "$BACKEND_DIR"

# ─── backend ────────────────────────────────────────────────────────────────
log "${BOLD}Backend${RESET} — preparing FastAPI on :8000"

if [[ "$NO_CACHE" == true ]]; then
  dim "Clearing backend cache (removing .venv)"
  rm -rf .venv
fi

# Reuse an existing valid venv when possible (has both python and pip).
PY_BIN=""
PY_VERSION=""
if [[ -d ".venv" && -x ".venv/bin/python" && -x ".venv/bin/pip" ]]; then
  PY_VERSION="$(.venv/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "")"
  if [[ -n "$PY_VERSION" ]]; then
    dim "Reusing existing .venv (Python $PY_VERSION)"
    PY_BIN=".venv/bin/python"
  fi
fi

# Need to (re)create — try each candidate until one succeeds.
if [[ -z "$PY_BIN" ]]; then
  if [[ -d ".venv" ]]; then
    dim "Existing .venv missing pip or unreadable — recreating"
    rm -rf .venv
  fi
  for cand in "${PY_CANDIDATES[@]}"; do
    command -v "$cand" >/dev/null 2>&1 || continue
    CAND_VER="$("$cand" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "?")"
    dim "Trying $cand (Python $CAND_VER) for venv creation"
    if make_venv "$cand"; then
      PY_BIN=".venv/bin/python"
      PY_VERSION="$CAND_VER"
      dim "Virtualenv created at backend/.venv using $cand"
      break
    fi
    dim "  $cand failed to create a working venv"
  done
fi

if [[ -z "$PY_BIN" ]]; then
  echo "✗ Could not create a Python venv with any available interpreter."
  echo "  Tried: ${PY_CANDIDATES[*]}"
  echo "  Try:   brew reinstall python@3.13   (or python@3.12)"
  exit 1
fi

log "Using Python $PY_VERSION → $PY_BIN"

# shellcheck disable=SC1091
source .venv/bin/activate

if [[ "$NO_CACHE" == true ]] || [[ ! -f ".venv/.deps-installed" ]] || [[ requirements.txt -nt ".venv/.deps-installed" ]]; then
  dim "Installing Python dependencies (prefer-binary, no-cache)"
  python -m pip install --quiet --upgrade pip
  # --prefer-binary  → take a prebuilt wheel over a source build whenever possible
  # --no-cache-dir   → bypass any corrupt entries in ~/.cache/pip
  python -m pip install --quiet --prefer-binary --no-cache-dir -r requirements.txt
  touch ".venv/.deps-installed"
else
  dim "Python dependencies already installed"
fi

if [[ ! -f ".env" ]]; then
  dim "Copying .env from .env.example"
  cp .env.example .env
fi

log "Starting uvicorn → $BACKEND_URL"
uvicorn main:app --host 127.0.0.1 --port 8000 --log-level info &
BACKEND_PID=$!

# Wait for /api/health to respond
dim "Waiting for backend to be ready…"
for i in {1..40}; do
  if curl -fsS "$BACKEND_URL/api/health" >/dev/null 2>&1; then
    dim "Backend is up."
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "✗ Backend exited before becoming ready."
    exit 1
  fi
  sleep 0.5
  if [[ $i -eq 40 ]]; then
    echo "✗ Backend did not respond on $BACKEND_URL/api/health within 20s."
    exit 1
  fi
done

# ─── frontend ───────────────────────────────────────────────────────────────
log "${BOLD}Frontend${RESET} — preparing Vite/React on :5173"

cd "$FRONTEND_DIR"

if [[ "$NO_CACHE" == true ]]; then
  dim "Clearing frontend cache (removing node_modules)"
  rm -rf node_modules
fi

if [[ "$NO_CACHE" == true ]] || [[ ! -d "node_modules" ]] || [[ package.json -nt node_modules ]]; then
  dim "Installing yarn dependencies"
  yarn install --silent
else
  dim "yarn dependencies already installed"
fi

log "Starting Vite dev server → $FRONTEND_URL"
yarn dev --host 127.0.0.1 --port 5173 >/dev/null 2>&1 &
FRONTEND_PID=$!

# Wait for the Vite server to respond
dim "Waiting for frontend to be ready…"
for i in {1..40}; do
  if curl -fsS "$FRONTEND_URL" >/dev/null 2>&1; then
    dim "Frontend is up."
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "✗ Frontend exited before becoming ready."
    exit 1
  fi
  sleep 0.5
  if [[ $i -eq 40 ]]; then
    echo "✗ Frontend did not respond on $FRONTEND_URL within 20s."
    exit 1
  fi
done

# ─── open browser ───────────────────────────────────────────────────────────
log "Opening dashboard → $FRONTEND_URL"
if command -v open >/dev/null 2>&1; then
  open "$FRONTEND_URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$FRONTEND_URL" >/dev/null 2>&1 &
fi

printf '\n  %sLyzr Underwriting Copilot is running%s\n\n' "$BOLD" "$RESET"
printf '    Dashboard : %s\n' "$FRONTEND_URL"
printf '    API       : %s/api/health\n\n' "$BACKEND_URL"
printf '  Press Ctrl-C to stop both processes.\n\n'

# Keep the script alive while children run; exit if either dies.
wait -n "$BACKEND_PID" "$FRONTEND_PID"
