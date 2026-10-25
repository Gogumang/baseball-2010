#!/bin/sh
# e2e/drive.mjs 에 명령 배열(JSON)을 보낸다
curl -s -X POST --data "$1" "http://127.0.0.1:${E2E_DRIVE_PORT:-5411}/"
