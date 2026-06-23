#!/usr/bin/env bash
set -e
cd /home/ubuntu/datamart-sis
source .venv/bin/activate

# Build React frontend
cd web/frontend
npm install --legacy-peer-deps --silent
npm run build
cd /home/ubuntu/datamart-sis

# Install Python deps
pip install -r requirements.txt -q

# Restart uvicorn
pkill -f 'uvicorn app:app' || true
sleep 2
cd /home/ubuntu/datamart-sis/web
PYTHONUNBUFFERED=1 nohup uvicorn app:app   --host 0.0.0.0 --port 8080 --workers 1   >> /home/ubuntu/web.log 2>&1 &
echo "Servidor iniciado — PID $!"
