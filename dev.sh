#!/usr/bin/env bash
# Start local Scoobidoo: backend on 8010, frontend on 5173.
# Usage: ./dev.sh
# Works on Linux, macOS, and Windows Git Bash.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()
CLEANED=0

is_windows() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

free_port() {
  local port="$1"
  local pids=""
  if is_windows; then
    pids="$(powershell.exe -NoProfile -Command \
      "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique" \
      2>/dev/null | tr -d '\r' | awk 'NF' || true)"
  else
    pids="$(lsof -nP -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
  fi
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  echo "Freeing 127.0.0.1:${port} ..."
  local pid
  for pid in ${pids}; do
    if is_windows; then
      taskkill.exe //F //T //PID "${pid}" >/dev/null 2>&1 || true
    else
      kill -9 "${pid}" 2>/dev/null || true
    fi
  done
}

cleanup() {
  if [[ "${CLEANED}" -eq 1 ]]; then
    return 0
  fi
  CLEANED=1
  echo ""
  echo "Stopping local stack..."
  local pid
  for pid in "${PIDS[@]:-}"; do
    if is_windows; then
      taskkill.exe //F //T //PID "${pid}" >/dev/null 2>&1 || true
    else
      kill "${pid}" 2>/dev/null || true
    fi
  done
  free_port 5173
  free_port 8010
  echo "Stopped."
}

trap cleanup EXIT INT TERM

if [[ ! -d "$ROOT/backend/.venv" ]]; then
  python -m venv "$ROOT/backend/.venv"
fi
if [[ -f "$ROOT/backend/.venv/Scripts/activate" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/Scripts/activate"
else
  # shellcheck disable=SC1091
  source "$ROOT/backend/.venv/bin/activate"
fi
python -m pip install -q -r "$ROOT/backend/requirements.txt"

if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
  (cd "$ROOT/frontend" && npm install)
fi

free_port 8010
free_port 5173

echo "Starting backend on http://127.0.0.1:8010 ..."
python -m uvicorn main:app --app-dir "$ROOT/backend" --host 127.0.0.1 --port 8010 &
PIDS+=($!)

echo "Starting frontend on http://127.0.0.1:5173 ..."
(cd "$ROOT/frontend" && npm run dev -- --host 127.0.0.1 --port 5173) &
PIDS+=($!)

echo ""
echo "Open http://127.0.0.1:5173"
wait
