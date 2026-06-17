#!/usr/bin/env bash
set -e

cd /home/ubuntu/datamart-sis
source .venv/bin/activate

# Matar TODAS las instancias anteriores
pkill -f 'uvicorn app:app' || true
sleep 2

# Arrancar nuevo proceso en background
cd /home/ubuntu/datamart-sis/web
PYTHONUNBUFFERED=1 nohup uvicorn app:app   --host 0.0.0.0 --port 8080 --workers 1   >> /home/ubuntu/web.log 2>&1 &

echo "Servidor web iniciado — PID $!"
