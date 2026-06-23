#!/usr/bin/env bash
# deploy.sh — reinicia todos los servicios y captura las URLs públicas.
# El build de React ya lo hizo GitHub Actions antes de llamar este script.
set -e

log() { echo "[deploy] $*"; }

# ── 1. Servidor web (uvicorn) ────────────────────────────────────────────────
log "Reiniciando uvicorn..."
pkill -f 'uvicorn app:app' || true
sleep 2
source /home/ubuntu/datamart-sis/.venv/bin/activate
cd /home/ubuntu/datamart-sis/web
PYTHONUNBUFFERED=1 nohup uvicorn app:app \
  --host 0.0.0.0 --port 8080 --workers 1 \
  >> /home/ubuntu/web.log 2>&1 &
log "Uvicorn PID $!"

# ── 2. Airflow (Docker standalone) ──────────────────────────────────────────
log "Verificando Airflow..."
if ! docker ps --format '{{.Names}}' | grep -q airflow-standalone; then
  log "Iniciando Airflow standalone..."
  docker start airflow-standalone 2>/dev/null || \
  docker run -d \
    --name airflow-standalone \
    --restart unless-stopped \
    -p 8082:8080 \
    -e AIRFLOW__CORE__LOAD_EXAMPLES=False \
    -e AIRFLOW__CORE__EXECUTOR=SequentialExecutor \
    -e _AIRFLOW_DB_MIGRATE=true \
    -e _AIRFLOW_WWW_USER_CREATE=true \
    -e _AIRFLOW_WWW_USER_USERNAME=admin \
    -e _AIRFLOW_WWW_USER_PASSWORD=admin2024 \
    -e AIRFLOW__WEBSERVER__SECRET_KEY=sis-datamart-2024 \
    -v /home/ubuntu/datamart-sis/airflow/dags:/opt/airflow/dags \
    -v /home/ubuntu/datamart-sis/airflow/logs:/opt/airflow/logs \
    -v /home/ubuntu/datamart-sis:/workspace:ro \
    apache/airflow:2.10.3 standalone
else
  log "Airflow ya corre"
fi

# ── 3. Cloudflared — Dashboard (puerto 8080) ─────────────────────────────────
log "Iniciando tunnel para Dashboard..."
pkill -f 'cloudflared.*8080' || true
sleep 1
rm -f /home/ubuntu/cloudflare.log
nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8080 \
  >> /home/ubuntu/cloudflare.log 2>&1 &

# ── 4. Cloudflared — Airflow (puerto 8082) ───────────────────────────────────
log "Iniciando tunnel para Airflow..."
pkill -f 'cloudflared.*8082' || true
sleep 1
rm -f /home/ubuntu/cloudflare_airflow.log
nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8082 \
  >> /home/ubuntu/cloudflare_airflow.log 2>&1 &

# ── 5. Capturar URLs (max 40s cada una) ──────────────────────────────────────
for service in dashboard airflow; do
  log_file="/home/ubuntu/cloudflare${service/dashboard/}.log"
  [[ "$service" == "airflow" ]] && log_file="/home/ubuntu/cloudflare_airflow.log"
  url_file="/home/ubuntu/${service/dashboard/public}_url.txt"
  [[ "$service" == "dashboard" ]] && url_file="/home/ubuntu/public_url.txt"

  for i in $(seq 1 20); do
    URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' "$log_file" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then
      echo "$URL" > "$url_file"
      log "$service URL: $URL"
      break
    fi
    sleep 2
  done
done

log "Deploy completo."
