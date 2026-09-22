#!/usr/bin/env bash
# IBVAP process control — force stop/start/restart the backend and/or the
# edge camera pipelines without hunting for PIDs by hand every time.
#
# Usage:
#   ./scripts/manage.sh backend  {start|stop|restart|status}
#   ./scripts/manage.sh cameras  {start|stop|restart|status}
#   ./scripts/manage.sh all      {start|stop|restart|status}
#
# Logs land in <root>/logs/*.log — tail them if a camera looks stuck.

set -u
ROOT="/c/SIH_CCTV"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

BACKEND_PORT=8000
BACKEND_PY="$ROOT/backend/venv/Scripts/python.exe"

EDGE_PY="$ROOT/edge/venv/Scripts/python.exe"
EDGE_DIR="$ROOT/edge"

# camera_id : source_video : stream_port : extra_args
CAMERAS=(
  "BOP-01:../demo_assets/man_suspicious_border.mp4:8091:"
  "BOP-Alpha:../demo_assets/nissan_plate_test.mp4:8092:"
  "BOP-Bravo:../demo_assets/man_cattle_crossing_border.mp4:8093:"
  "BOP-Sentry-Thermal:../demo_assets/thermal_sentry_feed.mp4:8094:--model thermal_person_yolov8.pt --sensor-mode thermal"
)

port_pid() {
  netstat -ano 2>/dev/null | grep ":$1 " | grep LISTENING | awk '{print $NF}' | head -1
}

kill_port() {
  local port="$1" name="$2"
  local pid
  pid=$(port_pid "$port")
  if [ -n "${pid:-}" ]; then
    taskkill //F //PID "$pid" >/dev/null 2>&1
    echo "  stopped $name (port $port, PID $pid)"
  else
    echo "  $name (port $port) was not running"
  fi
}

backend_status() {
  local pid
  pid=$(port_pid "$BACKEND_PORT")
  if [ -n "${pid:-}" ]; then
    echo "backend: RUNNING (port $BACKEND_PORT, PID $pid)"
  else
    echo "backend: stopped"
  fi
}

backend_start() {
  if [ -n "$(port_pid "$BACKEND_PORT")" ]; then
    echo "backend already running on port $BACKEND_PORT — use 'restart' to cycle it"
    return
  fi
  ( cd "$ROOT/backend" && "$BACKEND_PY" -m uvicorn app.main:app --port "$BACKEND_PORT" > "$LOG_DIR/backend.log" 2>&1 & )
  sleep 2
  if curl -s "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
    echo "backend: started (port $BACKEND_PORT) — log: $LOG_DIR/backend.log"
  else
    echo "backend: failed to come up — check $LOG_DIR/backend.log"
  fi
}

backend_stop() {
  kill_port "$BACKEND_PORT" "backend"
}

cameras_status() {
  for entry in "${CAMERAS[@]}"; do
    IFS=':' read -r cam src port extra <<< "$entry"
    local pid
    pid=$(port_pid "$port")
    if [ -n "${pid:-}" ]; then
      echo "$cam: RUNNING (port $port, PID $pid)"
    else
      echo "$cam: stopped"
    fi
  done
}

cameras_start() {
  for entry in "${CAMERAS[@]}"; do
    IFS=':' read -r cam src port extra <<< "$entry"
    if [ -n "$(port_pid "$port")" ]; then
      echo "  $cam already running on port $port — use 'restart' to cycle it"
      continue
    fi
    local log="$LOG_DIR/$(echo "$cam" | tr '[:upper:]' '[:lower:]').log"
    # -u: unbuffered stdout — without it, Python fully-buffers print() when
    # stdout isn't a TTY, so the log file stays empty for a long time even
    # though the process is genuinely running (found during a cold-start check).
    ( cd "$EDGE_DIR" && "$EDGE_PY" -u pipeline.py --source "$src" --camera-id "$cam" --stream-port "$port" --loop --backend "http://127.0.0.1:$BACKEND_PORT/events" $extra > "$log" 2>&1 & )
    echo "  started $cam (port $port) — log: $log"
    sleep 1
  done
}

cameras_stop() {
  for entry in "${CAMERAS[@]}"; do
    IFS=':' read -r cam src port extra <<< "$entry"
    kill_port "$port" "$cam"
  done
}

reset_demo_data() {
  echo "Stopping everything before reset..."
  cameras_stop
  backend_stop
  sleep 1
  "$BACKEND_PY" "$ROOT/backend/reset_demo_data.py"
  echo "Restarting fresh..."
  backend_start
  cameras_start
}

usage() {
  echo "Usage: $0 {backend|cameras|all} {start|stop|restart|status}"
  echo "       $0 reset          — wipe accumulated events/audit log for a clean judge-ready state, then restart"
  exit 1
}

if [ "${1:-}" = "reset" ]; then
  reset_demo_data
  exit 0
fi

[ $# -eq 2 ] || usage
target="$1"
action="$2"

case "$target" in
  backend)
    case "$action" in
      start) backend_start ;;
      stop) backend_stop ;;
      restart) backend_stop; sleep 1; backend_start ;;
      status) backend_status ;;
      *) usage ;;
    esac
    ;;
  cameras)
    case "$action" in
      start) cameras_start ;;
      stop) cameras_stop ;;
      restart) cameras_stop; sleep 1; cameras_start ;;
      status) cameras_status ;;
      *) usage ;;
    esac
    ;;
  all)
    case "$action" in
      start) backend_start; cameras_start ;;
      stop) cameras_stop; backend_stop ;;
      restart) cameras_stop; backend_stop; sleep 1; backend_start; cameras_start ;;
      status) backend_status; cameras_status ;;
      *) usage ;;
    esac
    ;;
  *) usage ;;
esac
