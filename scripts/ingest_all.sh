#!/bin/bash
# =============================================================================
# ingest_all.sh — Carga incremental de datasets SIS al datamart PostgreSQL
#
# Uso en VPS:
#   nohup bash scripts/ingest_all.sh >> /home/ubuntu/ingest_all.log 2>&1 &
#   echo $! > /home/ubuntu/ingest_all.pid
#
# Monitorear en tiempo real:
#   tail -f /home/ubuntu/ingest_all.log
#
# Idempotente: si un archivo ya fue cargado lo omite automaticamente.
# Procesa un ZIP a la vez y lo borra tras cargar (ahorra disco).
# Refresca vistas materializadas despues de cada archivo cargado.
# =============================================================================

set -uo pipefail

DATAMART_DIR="${DATAMART_DIR:-/home/ubuntu/datamart-sis}"
DATA_DIR="$DATAMART_DIR/data/raw"
TMP_DIR="$DATA_DIR/_tmp"
VENV_PY="$DATAMART_DIR/.venv/bin/python"
DB_URL="${DATABASE_URL:-postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@170.9.4.149:5433/datamart_sis}"
BASE_URL="https://www.datosabiertos.gob.pe/sites/default/files"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
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
db_query() {
    psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'
}

rows_in_db() {
    db_query "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis WHERE fuente_archivo='$1'"
}

total_in_db() {
    db_query "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis"
}

rows_by_year() {
    psql "$DB_URL" -c \
        "SELECT t.anio, TO_CHAR(SUM(f.cantidad_atenciones),'FM999,999,999,999') AS atenciones
         FROM datamart_sis.fact_atenciones_sis f
         JOIN datamart_sis.dim_tiempo t ON f.id_tiempo = t.id_tiempo
         GROUP BY t.anio ORDER BY t.anio" 2>/dev/null || log "  (error en consulta por anio)"
}

download_zip() {
    FNAME="$1"
    DEST="$DATA_DIR/$FNAME"
    URL="$BASE_URL/$FNAME"

    mkdir -p "$DATA_DIR"

    # Ya existe y tiene tamanio razonable (>1MB)
    if [ -f "$DEST" ]; then
        SIZE=$(wc -c < "$DEST" 2>/dev/null || echo 0)
        if [ "$SIZE" -gt 1048576 ]; then
            log "  Ya existe localmente ($((SIZE/1024/1024)) MB): $FNAME"
            return 0
        fi
        rm -f "$DEST"
    fi

    log "  Descargando $FNAME ..."
    TRIES=0
    while [ $TRIES -lt 5 ]; do
        TRIES=$((TRIES + 1))
        if curl -fsSL --max-time 300 \
                -H "User-Agent: $UA" \
                -H "Referer: https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis" \
                -o "$DEST" \
                "$URL"; then
            FINAL=$(wc -c < "$DEST" 2>/dev/null || echo 0)
            if [ "$FINAL" -gt 1048576 ]; then
                log "  Descarga OK: $((FINAL/1024/1024)) MB — $FNAME"
                return 0
            fi
        fi
        log "  Intento $TRIES fallido — esperando 15s"
        rm -f "$DEST"
        sleep 15
    done

    log "  ERROR: No se pudo descargar $FNAME tras 5 intentos"
    return 1
}

load_zip() {
    FNAME="$1"
    log "  Cargando $FNAME al datamart ..."
    cd "$DATAMART_DIR" || return 1
    DATABASE_URL="$DB_URL" "$VENV_PY" elt_load.py --file "$FNAME"
    return $?
}

refresh_mvs() {
    log "  Refrescando vistas materializadas ..."
    psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
        REFRESH MATERIALIZED VIEW datamart_sis.mv_kpis;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_anio;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_region;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_edad;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_sexo;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_top_servicios;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_nivel;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_plan;
        REFRESH MATERIALIZED VIEW datamart_sis.mv_por_mes;
    " 2>&1 || log "  ADVERTENCIA: error en refresh MVs"
    log "  MVs refreshed"
}

cleanup_zip() {
    FNAME="$1"
    if [ -f "$DATA_DIR/$FNAME" ]; then
        rm -f "$DATA_DIR/$FNAME"
        log "  ZIP borrado: $FNAME"
    fi
    # Borrar CSVs temporales
    if [ -d "$TMP_DIR" ]; then
        find "$TMP_DIR" -name "*.csv" -delete 2>/dev/null && log "  CSVs tmp borrados"
    fi
}

check_disk() {
    AVAIL=$(df -m "$DATA_DIR" 2>/dev/null | awk 'NR==2{print $4}')
    AVAIL="${AVAIL:-999}"
    log "  Espacio disponible: ${AVAIL} MB"
    if [ "$AVAIL" -lt 300 ]; then
        log "ERROR: Menos de 300 MB disponibles. Abortando."
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
log "DB: $DB_URL"
log "============================================================"

# Verificar DB
if ! psql "$DB_URL" -t -c "SELECT 1" >/dev/null 2>&1; then
    log "ERROR: No se puede conectar a la base de datos"
    exit 1
fi
log "Conexion DB OK"

# Verificar python
if [ ! -x "$VENV_PY" ]; then
    log "ERROR: Python venv no encontrado: $VENV_PY"
    exit 1
fi
log "Python OK: $VENV_PY"

mkdir -p "$DATA_DIR" "$TMP_DIR"

log ""
log "--- Estado actual por anio ---"
rows_by_year
log "Total actual en DB: $(total_in_db)"
log ""

# ---------------------------------------------------------------------------
# Procesar cada archivo
# ---------------------------------------------------------------------------
for FNAME in $FNAME_LIST; do
    log "=== $FNAME ==="

    # Verificar si ya esta cargado
    EXISTING=$(rows_in_db "$FNAME")
    if [ "${EXISTING:-0}" -gt 0 ]; then
        log "  YA CARGADO: $EXISTING atenciones — omitiendo"
        log ""
        continue
    fi

    check_disk

    # Descargar
    if ! download_zip "$FNAME"; then
        log "  FALLO descarga — continuando con el siguiente"
        log ""
        continue
    fi

    # Cargar al datamart
    if ! load_zip "$FNAME"; then
        log "  FALLO carga ELT"
        cleanup_zip "$FNAME"
        log ""
        continue
    fi

    # Verificar cuanto se cargo
    CARGADOS=$(rows_in_db "$FNAME")
    log "  Atenciones cargadas: ${CARGADOS:-0}"

    # Liberar disco antes del siguiente archivo
    cleanup_zip "$FNAME"

    # Refrescar MVs para que el dashboard muestre los datos nuevos
    refresh_mvs

    TOTAL_AHORA=$(total_in_db)
    log "  Total acumulado en DB: ${TOTAL_AHORA:-0}"
    log ""
done

# ---------------------------------------------------------------------------
# RESUMEN FINAL
# ---------------------------------------------------------------------------
log "============================================================"
log "RESUMEN FINAL — $(date '+%Y-%m-%d %H:%M:%S')"
log "============================================================"
log ""
log "--- Atenciones por anio (estado final) ---"
rows_by_year
log ""
log "Total en DB: $(total_in_db)"
log ""
log "============================================================"
log "INGEST COMPLETADO"
log "============================================================"
