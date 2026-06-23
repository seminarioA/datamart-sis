#!/usr/bin/env bash
# deploy.sh — reinicia uvicorn y cloudflared, guarda la URL pública.
# El build de React ya lo hizo GitHub Actions antes de llamar este script.
set -e

# ── 1. Reiniciar servidor web ────────────────────────────────────────────────
pkill -f 'uvicorn app:app' || true
sleep 2

source /home/ubuntu/datamart-sis/.venv/bin/activate
cd /home/ubuntu/datamart-sis/web

PYTHONUNBUFFERED=1 nohup uvicorn app:app \
  --host 0.0.0.0 --port 8080 --workers 1 \
  >> /home/ubuntu/web.log 2>&1 &
echo "Uvicorn iniciado — PID $!"

# ── 2. Reiniciar cloudflared y capturar URL pública ─────────────────────────
pkill cloudflared || true
sleep 2
rm -f /home/ubuntu/cloudflare.log

nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8080 \
  >> /home/ubuntu/cloudflare.log 2>&1 &
echo "Cloudflared iniciado — PID $!"

# Esperar a que cloudflared publique la URL (max 30s)
for i in $(seq 1 15); do
  URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' \
        /home/ubuntu/cloudflare.log 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    echo "$URL" > /home/ubuntu/public_url.txt
    echo "URL pública: $URL"
    exit 0
  fi
  sleep 2
done

echo "WARNING: no se pudo obtener la URL de cloudflared a tiempo"
exit 0
