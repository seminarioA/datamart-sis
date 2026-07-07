#!/usr/bin/env bash
# =============================================================================
# ingest_all.sh — Carga incremental completa de datasets SIS al datamart
#
# Uso en VPS:
#   nohup bash scripts/ingest_all.sh >> /home/ubuntu/ingest_all.log 2>&1 &
#   echo $! > /home/ubuntu/ingest_all.pid
#
# Monitorear:
#   tail -f /home/ubuntu/ingest_all.log
#
# Idempotente: si un archivo ya esta cargado lo omite.
# Procesa un ZIP a la vez, borra tras la carga para ahorrar disco.
# =============================================================================

DATAMART_DIR="${DATAMART_DIR:-/home/ubuntu/datamart-sis}"
DATA_DIR="$DATAMART_DIR/data/raw"
TMP_DIR="$DATA_DIR/_tmp"
VENV_PY="$DATAMART_DIR/.venv/bin/python"
DB_URL="${DATABASE_URL:-postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@170.9.4.149:5433/datamart_sis}"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
BASE_URL="https://www.datosabiertos.gob.pe/sites/default/files"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# Lista de archivos (todos los 14 del catalogo CKAN, orden cronologico)
# Formato: "nombre_archivo|etiqueta"
# ---------------------------------------------------------------------------
FILES="
OPENDATA_DS_01_2017_ATENCIONES_0.zip|2017 (completo)
OPENDATA_DS_01_2018_ATENCIONES_0.zip|2018 (completo)
OPENDATA_DS_01_2019_ATENCIONES_0.zip|2019 (completo)
OPENDATA_DS_01_2020_ATENCIONES_0.zip|2020 (completo)
OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip|2021 S1 (ene-jun)
OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip|2021 S2 (jul-dic)
OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip|2022 S1 (ene-jun)
OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip|2022 S2 (jul-dic)
OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip|2023 S1 (ene-jun)
OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip|2023 S2 (jul-dic)
OPENDATA_DS_01_2024_01_06_ATENCIONES.zip|2024 S1 (ene-jun)
OPENDATA_DS_01_2024_07_12_ATENCIONES.zip|2024 S2 (jul-dic)
OPENDATA_DS_01_2025_01_06_ATENCIONES.zip|2025 S1 (ene-jun)
OPENDATA_DS_01_2025_07_12_ATENCIONES.zip|2025 S2 (jul-dic)
"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
rows_in_db() {
    psql "$DB_URL" -t -c \
        "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis WHERE fuente_archivo='$1'" \
        2>/dev/null | tr -d ' \n'
}

total_in_db() {
    psql "$DB_URL" -t -c \
        "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis" \
        2>/dev/null | tr -d ' \n'
}

rows_by_year() {
    psql "$DB_URL" -c \
        "SELECT t.anio, TO_CHAR(SUM(f.cantidad_atenciones),'FM999,999,999,999') AS atenciones
         FROM datamart_sis.fact_atenciones_sis f
         JOIN datamart_sis.dim_tiempo t ON f.id_tiempo = t.id_tiempo
         GROUP BY t.anio ORDER BY t.anio" \
        2>/dev/null || echo "(error consultando DB)"
}

download_zip() {
    local fname="$1"
    local dest="$DATA_DIR/$fname"
    local url="$BASE_URL/$fname"

    mkdir -p "$DATA_DIR"

    # Ya descargado y de tamanio razonable (>1MB)
    if [ -f "$dest" ] && [ "$(stat -c%s "$dest" 2>/dev/null || stat -f%z "$dest" 2>/dev/null)" -gt 1048576 ]; then
        log "  Archivo ya existe localmente: $fname"
        return 0
    fi

    log "  Descargando $fname ..."
    local tmp_dest="${dest}.tmp"

    # curl con resume, reintentos, progress log
    for i in 1 2 3 4 5; do
        local offset=0
        if [ -f "$tmp_dest" ]; then
            offset=$(stat -c%s "$tmp_dest" 2>/dev/null || stat -f%z "$tmp_dest" 2>/dev/null || echo 0)
        fi

        local range_opt=""
        if [ "$offset" -gt 0 ]; then
            range_opt="-r ${offset}-"
            log "  Reanudando desde $((offset/1024/1024)) MB (intento $i)"
        else
            log "  Descarga desde cero (intento $i)"
        fi

        curl -fsSL --max-time 300 --retry 0 \
             -H "User-Agent: $UA" \
             -H "Referer: https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis" \
             $range_opt \
             -o "$tmp_dest" \
             ${offset:+--append-header "Range: bytes=${offset}-"} \
             "$url" 2>&1 && break

        log "  Error en intento $i — reintentando en 10s"
        sleep 10
    done

    if [ ! -f "$tmp_dest" ] || [ "$(stat -c%s "$tmp_dest" 2>/dev/null || stat -f%z "$tmp_dest" 2>/dev/null)" -le 1048576 ]; then
        log "  ERROR: descarga fallida o archivo demasiado pequeno para $fname"
        rm -f "$tmp_dest"
        return 1
    fi

    mv "$tmp_dest" "$dest"
    local size_mb
    size_mb=$(du -m "$dest" | cut -f1)
    log "  Descarga OK: ${size_mb} MB — $fname"
}

load_zip() {
    local fname="$1"
    log "  Cargando $fname ..."
    cd "$DATAMART_DIR" || return 1
    DATABASE_URL="$DB_URL" "$VENV_PY" elt_load.py --file "$fname" 2>&1 | \
        while IFS= read -r line; do log "  [elt] $line"; done
    local rc="${PIPESTATUS[0]}"
    return "$rc"
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
    " 2>&1 | while IFS= read -r line; do log "  [mv] $line"; done
    log "  MVs refreshed OK"
}

cleanup_zip() {
    local fname="$1"
    rm -f "$DATA_DIR/$fname" && log "  ZIP borrado: $fname"
    # CSV temporales
    for f in "$TMP_DIR"/*.csv 2>/dev/null; do
        [ -f "$f" ] && rm -f "$f" && log "  CSV tmp borrado: $(basename "$f")"
    done
}

check_disk() {
    local avail_mb
    avail_mb=$(df -m "$DATA_DIR" 2>/dev/null | awk 'NR==2{print $4}')
    log "  Espacio disponible: ${avail_mb:-?} MB"
    if [ "${avail_mb:-999}" -lt 300 ]; then
        log "ADVERTENCIA: poco espacio en disco. Abortando para evitar corrupcion."
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
log "============================================================"
log "DataMart SIS — Ingest completo $(date '+%Y-%m-%d %H:%M:%S')"
log "VPS: $(hostname 2>/dev/null || echo unknown)"
log "DB: $DB_URL"
log "============================================================"

# Verificar conexion a DB
if ! psql "$DB_URL" -t -c "SELECT 1" >/dev/null 2>&1; then
    log "ERROR: No se puede conectar a la base de datos"
    exit 1
fi
log "Conexion a DB OK"

# Verificar que el venv existe
if [ ! -x "$VENV_PY" ]; then
    log "ERROR: Python venv no encontrado en $VENV_PY"
    exit 1
fi
log "Python venv OK: $VENV_PY"

log ""
log "--- Estado actual por anio ---"
rows_by_year
log ""

LOADED_COUNT=0
SKIPPED_COUNT=0
FAILED_LIST=""

mkdir -p "$DATA_DIR" "$TMP_DIR"

# Procesar cada archivo
echo "$FILES" | grep -v '^$' | while IFS='|' read -r FNAME LABEL; do
    [ -z "$FNAME" ] && continue

    log "=== $LABEL — $FNAME ==="

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
        log "  FALLO en descarga — continuando con el siguiente"
        log ""
        continue
    fi

    # Cargar
    if ! load_zip "$FNAME"; then
        log "  FALLO en carga ELT"
        cleanup_zip "$FNAME"
        log ""
        continue
    fi

    # Verificar registros
    CARGADOS=$(rows_in_db "$FNAME")
    log "  Atenciones cargadas: ${CARGADOS:-0}"

    # Limpiar ZIP (liberar disco antes del siguiente)
    cleanup_zip "$FNAME"

    # Refrescar MVs para que el dashboard refleje los datos nuevos
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
log "============================================================"
log "INGEST COMPLETADO"
log "============================================================"
