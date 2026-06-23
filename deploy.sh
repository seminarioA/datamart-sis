#!/usr/bin/env bash
# deploy.sh — reinicia todos los servicios y captura las URLs públicas.
# El build de React ya lo hizo GitHub Actions antes de llamar este script.
set -e

log() { echo "[deploy $(date +%H:%M:%S)] $*"; }

# ── Entorno Airflow ──────────────────────────────────────────────────────────
export AIRFLOW_HOME=/home/ubuntu/datamart-sis/airflow
export AIRFLOW__CORE__LOAD_EXAMPLES=False
export AIRFLOW__CORE__EXECUTOR=SequentialExecutor
export AIRFLOW__WEBSERVER__SECRET_KEY=sis-datamart-2024
export AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=sqlite:////home/ubuntu/datamart-sis/airflow/airflow.db
AIRFLOW_BIN=/home/ubuntu/airflow-venv/bin/airflow

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

# ── 2. Airflow — inicializar DB si es la primera vez ────────────────────────
if [ ! -f "$AIRFLOW_HOME/airflow.db" ]; then
  log "Primera ejecución: inicializando Airflow DB..."
  $AIRFLOW_BIN db migrate >> /home/ubuntu/airflow-web.log 2>&1
  $AIRFLOW_BIN users create \
    --username admin --password admin2024 \
    --firstname Admin --lastname SIS \
    --role Admin --email alesuperbros23@gmail.com \
    >> /home/ubuntu/airflow-web.log 2>&1
  log "Airflow DB inicializada"
fi

# ── 3. Airflow webserver + scheduler ────────────────────────────────────────
log "Reiniciando Airflow..."
pkill -f 'airflow webserver' || true
pkill -f 'airflow scheduler' || true
sleep 2
nohup $AIRFLOW_BIN webserver --port 8082 >> /home/ubuntu/airflow-web.log 2>&1 &
log "Airflow webserver PID $!"
nohup $AIRFLOW_BIN scheduler >> /home/ubuntu/airflow-sched.log 2>&1 &
log "Airflow scheduler PID $!"

# ── 4. Cloudflared — Dashboard (8080) ───────────────────────────────────────
log "Tunnel Dashboard..."
pkill -f 'cloudflared.*8080' || true
sleep 1
rm -f /home/ubuntu/cloudflare.log
nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8080 \
  >> /home/ubuntu/cloudflare.log 2>&1 &

# ── 5. Cloudflared — Airflow (8082) ─────────────────────────────────────────
log "Tunnel Airflow..."
pkill -f 'cloudflared.*8082' || true
sleep 1
rm -f /home/ubuntu/cloudflare_airflow.log
nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8082 \
  >> /home/ubuntu/cloudflare_airflow.log 2>&1 &

# ── 6. Capturar ambas URLs (max 40s cada una) ────────────────────────────────
for service in dashboard airflow; do
  if [ "$service" = "dashboard" ]; then
    logf=/home/ubuntu/cloudflare.log
    urlf=/home/ubuntu/public_url.txt
  else
    logf=/home/ubuntu/cloudflare_airflow.log
    urlf=/home/ubuntu/airflow_url.txt
  fi
  for i in $(seq 1 20); do
    URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' "$logf" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then
      echo "$URL" > "$urlf"
      log "$service → $URL"
      break
    fi
    sleep 2
  done
done

log "Deploy completo."
