#!/bin/bash
# =============================================================================
# ingest_all.sh — Carga incremental de datasets SIS al datamart PostgreSQL
#
# Uso en VPS (lanzar en background):
#   nohup bash scripts/ingest_all.sh >> /home/ubuntu/ingest_all.log 2>&1 &
#   echo $! > /home/ubuntu/ingest_all.pid
#
# Monitorear:
#   tail -f /home/ubuntu/ingest_all.log
#
# Idempotente: si un archivo ya fue cargado lo omite.
# Procesa un ZIP a la vez y lo borra tras cargar (ahorra disco).
# =============================================================================

set -uo pipefail

DATAMART_DIR="${DATAMART_DIR:-/home/ubuntu/datamart-sis}"
DATA_DIR="$DATAMART_DIR/data/raw"
TMP_DIR="$DATA_DIR/_tmp"
VENV_PY="$DATAMART_DIR/.venv/bin/python"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set}"
BASE_URL="https://www.datosabiertos.gob.pe/sites/default/files"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# ---------------------------------------------------------------------------
# DB helpers — usa psycopg2 (no necesita psql instalado)
# ---------------------------------------------------------------------------
py_db() {
    # py_db "<SQL>" [<expected_type: scalar|table>]
    "$VENV_PY" - "$DB_URL" "$1" <<'PYEOF' 2>/dev/null
import sys
import psycopg2

db_url = sys.argv[1]
sql    = sys.argv[2]
try:
    conn = psycopg2.connect(db_url)
    cur  = conn.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    for row in rows:
        print('\t'.join(str(c) if c is not None else '' for c in row))
    conn.close()
except Exception as e:
    print(f"DB_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
}

rows_in_db() {
    py_db "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis WHERE fuente_archivo='$1'" | tr -d ' \n'
}

rows_by_year() {
    # Usa la vista materializada (rapida) en lugar de un full scan de la fact table
    py_db "SELECT anio, atenciones FROM datamart_sis.mv_por_anio ORDER BY anio" | \
    while IFS=$'\t' read -r yr cnt; do
        printf "  Anio %s: %'d atenciones\n" "$yr" "$cnt" 2>/dev/null || echo "  Anio $yr: $cnt atenciones"
    done
}

total_in_db() {
    # Usa mv_kpis en lugar de SUM sobre 188M filas
    py_db "SELECT total_atenciones FROM datamart_sis.mv_kpis" | tr -d ' \n'
}

check_db() {
    py_db "SELECT 1" >/dev/null 2>&1
}

create_index_fuente() {
    log "  Creando indice en fuente_archivo (si no existe) ..."
    "$VENV_PY" - "$DB_URL" <<'PYEOF' 2>&1
import sys
import psycopg2

db_url = sys.argv[1]
try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_fact_fuente_archivo
        ON datamart_sis.fact_atenciones_sis (fuente_archivo)
    """)
    conn.close()
    print("  Indice idx_fact_fuente_archivo OK")
except Exception as e:
    print(f"  WARN: no se pudo crear indice: {e}")
PYEOF
}

refresh_mvs() {
    log "  Refrescando vistas materializadas ..."
    "$VENV_PY" - "$DB_URL" <<'PYEOF' 2>&1
import sys
import psycopg2

db_url = sys.argv[1]
mvs = [
    'mv_kpis','mv_por_anio','mv_por_region','mv_por_edad',
    'mv_por_sexo','mv_top_servicios','mv_por_nivel','mv_por_plan','mv_por_mes'
]
try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    for mv in mvs:
        cur.execute(f'REFRESH MATERIALIZED VIEW datamart_sis.{mv}')
        print(f'  [mv] {mv} OK')
    conn.close()
except Exception as e:
    print(f'  [mv] ERROR: {e}')
    sys.exit(1)
PYEOF
    log "  MVs refreshed"
}

# ---------------------------------------------------------------------------
# Lista de archivos (todos los 14 del catalogo CKAN, orden cronologico)
# ---------------------------------------------------------------------------
FNAME_LIST="OPENDATA_DS_01_2017_ATENCIONES_0.zip
OPENDATA_DS_01_2018_ATENCIONES_0.zip
OPENDATA_DS_01_2019_ATENCIONES_0.zip
OPENDATA_DS_01_2020_ATENCIONES_0.zip
OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip
OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip
OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip
OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip
OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip
OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip
OPENDATA_DS_01_2024_01_06_ATENCIONES.zip
OPENDATA_DS_01_2024_07_12_ATENCIONES.zip
OPENDATA_DS_01_2025_01_06_ATENCIONES.zip
OPENDATA_DS_01_2025_07_12_ATENCIONES.zip"

# ---------------------------------------------------------------------------
download_zip() {
    FNAME="$1"
    DEST="$DATA_DIR/$FNAME"
    URL="$BASE_URL/$FNAME"

    mkdir -p "$DATA_DIR"

    if [ -f "$DEST" ]; then
        SZ=$(wc -c < "$DEST" 2>/dev/null || echo 0)
        if [ "$SZ" -gt 1048576 ]; then
            log "  Ya existe ($((SZ/1024/1024)) MB): $FNAME"
            return 0
        fi
        rm -f "$DEST"
    fi

    log "  Descargando $FNAME ..."
    TRY=0
    while [ $TRY -lt 5 ]; do
        TRY=$((TRY + 1))
        if curl -fsSL --max-time 300 \
                -H "User-Agent: $UA" \
                -H "Referer: https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis" \
                -o "$DEST" "$URL"; then
            SZ=$(wc -c < "$DEST" 2>/dev/null || echo 0)
            if [ "$SZ" -gt 1048576 ]; then
                log "  Descarga OK: $((SZ/1024/1024)) MB — $FNAME"
                return 0
            fi
        fi
        log "  Intento $TRY fallido, reintentando en 15s ..."
        rm -f "$DEST"
        sleep 15
    done

    log "  ERROR: No se pudo descargar $FNAME tras 5 intentos"
    return 1
}

cleanup_zip() {
    FNAME="$1"
    rm -f "$DATA_DIR/$FNAME" 2>/dev/null && log "  ZIP borrado: $FNAME"
    find "$TMP_DIR" -name "*.csv" -delete 2>/dev/null
}

check_disk() {
    AV=$(df -m "$DATA_DIR" 2>/dev/null | awk 'NR==2{print $4}')
    AV="${AV:-999}"
    log "  Espacio disponible: ${AV} MB"
    if [ "$AV" -lt 300 ]; then
        log "ERROR: Menos de 300 MB libres. Abortando para evitar corrupcion."
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
log "============================================================"
log "DataMart SIS — Ingest completo"
log "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
log "VPS: $(hostname 2>/dev/null || echo unknown)"
log "============================================================"

# Verificar Python
if [ ! -x "$VENV_PY" ]; then
    log "ERROR: Python venv no encontrado: $VENV_PY"
    exit 1
fi
log "Python OK: $VENV_PY"

# Verificar DB (via psycopg2)
if ! check_db; then
    log "ERROR: No se puede conectar a la DB — verifica DATABASE_URL y red"
    exit 1
fi
log "Conexion DB OK"

create_index_fuente

mkdir -p "$DATA_DIR" "$TMP_DIR"

log ""
log "--- Estado actual por anio ---"
rows_by_year
log "Total actual: $(total_in_db) atenciones"
log ""

# ---------------------------------------------------------------------------
# Procesar cada archivo secuencialmente
# ---------------------------------------------------------------------------
for FNAME in $FNAME_LIST; do
    log "=== $FNAME ==="

    EXISTING=$(rows_in_db "$FNAME")
    if [ "${EXISTING:-0}" -gt 0 ]; then
        log "  YA CARGADO ($EXISTING atenciones) — omitiendo"
        log ""
        continue
    fi

    check_disk

    if ! download_zip "$FNAME"; then
        log "  FALLO descarga — siguiente archivo"
        log ""
        continue
    fi

    log "  Cargando al datamart ..."
    cd "$DATAMART_DIR" || exit 1
    if ! DATABASE_URL="$DB_URL" "$VENV_PY" elt_load.py --file "$FNAME"; then
        log "  FALLO carga ELT"
        cleanup_zip "$FNAME"
        log ""
        continue
    fi

    CARGADOS=$(rows_in_db "$FNAME")
    log "  Atenciones cargadas: ${CARGADOS:-0}"

    cleanup_zip "$FNAME"
    refresh_mvs

    log "  Total acumulado: $(total_in_db)"
    log ""
done

# ---------------------------------------------------------------------------
log "============================================================"
log "RESUMEN FINAL — $(date '+%Y-%m-%d %H:%M:%S')"
log "============================================================"
rows_by_year
log "Total en DB: $(total_in_db)"
log "============================================================"
log "INGEST COMPLETADO"
log "============================================================"
