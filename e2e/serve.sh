#!/bin/sh
# 화면 확인용 서버를 한 번만 띄워 재사용한다 (포트 고정 · pid 파일).
#   e2e/serve.sh          — 개발 서버(vite, 바로가기 켜짐)를 띄운다. 이미 떠 있으면 그대로 둔다
#   e2e/serve.sh e2e      — `vite build --mode e2e` 산출물을 preview 로 띄운다(배포 꼴 + 바로가기)
#   e2e/serve.sh stop     — pid 로 끈다
#   e2e/serve.sh status
# 포트: E2E_PORT (기본 5410). 로그 · pid: e2e/.run/
set -eu
cd "$(dirname "$0")/.."
PORT="${E2E_PORT:-5410}"
RUN=e2e/.run
PID="$RUN/server-$PORT.pid"
LOG="$RUN/server-$PORT.log"
mkdir -p "$RUN"

alive() { [ -f "$PID" ] && kill -0 "$(cat "$PID")" 2>/dev/null; }
ready() { curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; }

case "${1:-dev}" in
  stop)
    if alive; then kill "$(cat "$PID")" && echo "stopped $(cat "$PID")"; else echo "not running"; fi
    rm -f "$PID"; exit 0 ;;
  status)
    if alive && ready; then echo "running pid=$(cat "$PID") http://127.0.0.1:$PORT/"; else echo "not running"; exit 1; fi
    exit 0 ;;
  dev|e2e) ;;
  *) echo "usage: $0 [dev|e2e|stop|status]"; exit 2 ;;
esac

if alive && ready; then echo "already running pid=$(cat "$PID") http://127.0.0.1:$PORT/"; exit 0; fi
rm -f "$PID"

# pnpm 을 거치면 pnpm 이 vite 를 자식으로 띄워 pid 로 못 끈다 — node 로 vite 를 곧바로 띄운다
VITE="node node_modules/vite/bin/vite.js"
if [ "${1:-dev}" = e2e ]; then
  $VITE build --mode e2e --outDir "$RUN/dist-$PORT" >"$LOG" 2>&1
  nohup $VITE preview --mode e2e --outDir "$RUN/dist-$PORT" --host 127.0.0.1 --port "$PORT" --strictPort >>"$LOG" 2>&1 &
else
  nohup $VITE --host 127.0.0.1 --port "$PORT" --strictPort >"$LOG" 2>&1 &
fi
echo $! >"$PID"

i=0
until ready; do
  i=$((i + 1))
  if [ "$i" -gt 150 ] || ! alive; then echo "server failed — $LOG"; tail -20 "$LOG"; exit 1; fi
  sleep 0.2
done
echo "ready pid=$(cat "$PID") http://127.0.0.1:$PORT/"
