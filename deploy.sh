#!/usr/bin/env bash
# deploy.sh — reinicia todos los servicios y captura las URLs públicas.
# El build de React ya lo hizo GitHub Actions antes de llamar este script.
set -e

log() { echo "[deploy $(date +%H:%M:%S)] $*"; }

AIRFLOW_HOME=/home/ubuntu/datamart-sis/airflow
AIRFLOW_BIN=/home/ubuntu/airflow-venv/bin/airflow
AIRFLOW_ENV="AIRFLOW_HOME=$AIRFLOW_HOME AIRFLOW__CORE__LOAD_EXAMPLES=False AIRFLOW__CORE__EXECUTOR=SequentialExecutor AIRFLOW__WEBSERVER__SECRET_KEY=sis-datamart-2024 AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=sqlite:////home/ubuntu/datamart-sis/airflow/airflow.db AIRFLOW__WEBSERVER__WORKERS=1 AIRFLOW__WEBSERVER__WORKER_CLASS=sync AIRFLOW__WEBSERVER__WEB_SERVER_WORKER_TIMEOUT=300"

# ── 1. Servidor web (uvicorn) ────────────────────────────────────────────────
log "Reiniciando uvicorn..."
pkill -9 -f 'uvicorn app:app' 2>/dev/null || true
sleep 2
source /home/ubuntu/datamart-sis/.venv/bin/activate
cd /home/ubuntu/datamart-sis/web
PYTHONUNBUFFERED=1 nohup uvicorn app:app \
  --host 0.0.0.0 --port 8080 --workers 1 \
  >> /home/ubuntu/web.log 2>&1 &
log "Uvicorn PID $!"

# ── 2. Airflow — inicializar DB si es la primera vez ────────────────────────
if [ ! -f "$AIRFLOW_HOME/airflow.db" ]; then
  log "Primera ejecucion: inicializando Airflow DB..."
  env $AIRFLOW_ENV $AIRFLOW_BIN db migrate >> /home/ubuntu/airflow-web.log 2>&1
  env $AIRFLOW_ENV $AIRFLOW_BIN users create \
    --username admin --password admin2024 \
    --firstname Admin --lastname SIS \
    --role Admin --email alesuperbros23@gmail.com \
    >> /home/ubuntu/airflow-web.log 2>&1
  log "Airflow DB inicializada"
fi

# ── 3. Airflow — matar TODOS los procesos anteriores ────────────────────────
log "Matando procesos Airflow anteriores..."
pkill -9 -f 'airflow webserver' 2>/dev/null || true
pkill -9 -f 'airflow scheduler' 2>/dev/null || true
sleep 3  # dar tiempo a que liberen el puerto

# ── 4. Iniciar Airflow ───────────────────────────────────────────────────────
log "Iniciando Airflow webserver en :8082..."
env $AIRFLOW_ENV nohup $AIRFLOW_BIN webserver --port 8082 \
  >> /home/ubuntu/airflow-web.log 2>&1 &
log "Airflow webserver PID $!"

env $AIRFLOW_ENV nohup $AIRFLOW_BIN scheduler \
  >> /home/ubuntu/airflow-sched.log 2>&1 &
log "Airflow scheduler PID $!"

# ── 5. Esperar que Airflow esté up (max 3 min) ──────────────────────────────
log "Esperando Airflow en localhost:8082..."
for i in $(seq 1 36); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8082/ 2>/dev/null || echo 000)
  if [ "$CODE" = "302" ] || [ "$CODE" = "200" ]; then
    log "Airflow UP (HTTP $CODE) en intento $i"
    break
  fi
  [ "$i" -eq 36 ] && log "WARNING: Airflow no respondio en 3 min - continuar de todas formas"
  sleep 5
done

# ── 6. Cloudflared — Dashboard (8080) ───────────────────────────────────────
log "Tunnel Dashboard..."
pkill -f 'cloudflared.*8080' 2>/dev/null || true
sleep 1
rm -f /home/ubuntu/cloudflare.log
nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8080 \
  >> /home/ubuntu/cloudflare.log 2>&1 &

# ── 7. Cloudflared — Airflow (8082) ─────────────────────────────────────────
log "Tunnel Airflow..."
pkill -f 'cloudflared.*8082' 2>/dev/null || true
sleep 1
rm -f /home/ubuntu/cloudflare_airflow.log
nohup /home/ubuntu/cloudflared tunnel --url http://localhost:8082 \
  >> /home/ubuntu/cloudflare_airflow.log 2>&1 &

# ── 8. Capturar ambas URLs (max 40s cada una) ────────────────────────────────
for service in dashboard airflow; do
  [ "$service" = "dashboard" ] && logf=/home/ubuntu/cloudflare.log       && urlf=/home/ubuntu/public_url.txt
  [ "$service" = "airflow"   ] && logf=/home/ubuntu/cloudflare_airflow.log && urlf=/home/ubuntu/airflow_url.txt
  for i in $(seq 1 20); do
    URL=$(grep -oP 'https://[a-z0-9\-]+\.trycloudflare\.com' "$logf" 2>/dev/null | head -1)
    if [ -n "$URL" ]; then echo "$URL" > "$urlf"; log "$service → $URL"; break; fi
    sleep 2
  done
done

log "Deploy completo."
