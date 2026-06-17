#!/usr/bin/env bash
# deploy.sh — reinicia el servidor web tras un git pull
# Llamado por GitHub Actions y también útil para restarts manuales.
set -e

cd /home/ubuntu/datamart-sis
source .venv/bin/activate

# Matar instancia anterior limpiamente
OLD=$(pgrep -f 'uvicorn app:app' || true)
if [ -n "$OLD" ]; then
  kill "$OLD" || true
  sleep 2
fi

# Arrancar nuevo proceso en background
cd /home/ubuntu/datamart-sis/web
PYTHONUNBUFFERED=1 nohup uvicorn app:app \
  --host 0.0.0.0 --port 8080 --workers 1 \
  >> /home/ubuntu/web.log 2>&1 &

echo "Servidor web iniciado — PID $!"
