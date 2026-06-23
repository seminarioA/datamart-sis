#!/usr/bin/env bash
# deploy.sh — reinicia el servidor web.
# El build de React lo hace GitHub Actions (no el VPS).
# Este script solo reinicia uvicorn.
set -e

pkill -f 'uvicorn app:app' || true
sleep 2

source /home/ubuntu/datamart-sis/.venv/bin/activate
cd /home/ubuntu/datamart-sis/web

PYTHONUNBUFFERED=1 nohup uvicorn app:app \
  --host 0.0.0.0 --port 8080 --workers 1 \
  >> /home/ubuntu/web.log 2>&1 &

echo "Servidor iniciado — PID $!"
