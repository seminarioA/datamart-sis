#!/bin/bash
# start_prefect.sh — Arranca Prefect server y flows en :4200 (puerto fijo público).
set -e

DATAMART_DIR="/home/ubuntu/datamart-sis"
VENV_PY="$DATAMART_DIR/.venv/bin/python"
PREFECT_HOME="/home/ubuntu/.prefect"
PREFECT_API="http://127.0.0.1:4200/api"
PUBLIC_URL="http://192.9.159.35:4200"

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# Instalar Prefect en el venv si no está
if ! "$VENV_PY" -c "import prefect" 2>/dev/null; then
    log "Instalando Prefect..."
    "$DATAMART_DIR/.venv/bin/pip" install "prefect>=3.0,<4" psycopg2-binary --quiet
fi

# Detener procesos anteriores
pkill -f "prefect server"  2>/dev/null || true
pkill -f "prefect/serve.py" 2>/dev/null || true
sleep 3

# Abrir puerto 4200 en iptables (idempotente)
sudo iptables -C INPUT -p tcp --dport 4200 -j ACCEPT 2>/dev/null \
    || sudo iptables -I INPUT -p tcp --dport 4200 -j ACCEPT

# Arrancar servidor Prefect con UI apuntando a la IP pública fija
log "Arrancando Prefect server en :4200 (UI: $PUBLIC_URL)..."
PREFECT_HOME="$PREFECT_HOME" \
PREFECT_UI_API_URL="$PUBLIC_URL/api" \
nohup "$DATAMART_DIR/.venv/bin/prefect" server start \
    --host 0.0.0.0 \
    --port 4200 \
    >> /home/ubuntu/prefect-server.log 2>&1 &
echo $! > /home/ubuntu/prefect-server.pid
log "Prefect server PID: $(cat /home/ubuntu/prefect-server.pid)"

# Esperar a que levante
for i in $(seq 1 30); do
    if curl -sf "$PREFECT_API/health" > /dev/null 2>&1; then
        log "Prefect server listo (${i}s)"
        break
    fi
    sleep 2
done

# Configurar cliente local
"$DATAMART_DIR/.venv/bin/prefect" config set PREFECT_API_URL="$PREFECT_API" 2>/dev/null || true

# Arrancar flows
log "Arrancando deployments (elt-sis + refresh-mvs)..."
cd "$DATAMART_DIR"
DATABASE_URL="$DATABASE_URL" \
PREFECT_API_URL="$PREFECT_API" \
PREFECT_HOME="$PREFECT_HOME" \
nohup "$VENV_PY" prefect/serve.py \
    >> /home/ubuntu/prefect-flows.log 2>&1 &
echo $! > /home/ubuntu/prefect-flows.pid
log "Flows PID: $(cat /home/ubuntu/prefect-flows.pid)"

# URL fija — no depende de cloudflared
echo "$PUBLIC_URL" > /home/ubuntu/prefect_url.txt
log "Prefect UI disponible en: $PUBLIC_URL"
