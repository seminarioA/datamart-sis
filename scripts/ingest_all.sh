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
# El script es idempotente: si un archivo ya está cargado lo omite.
# Procesa un ZIP a la vez, borra el ZIP/CSV tras la carga (ahorra disco).
# Refresca las vistas materializadas después de cada archivo cargado.
# =============================================================================
set -euo pipefail

DATAMART_DIR="${DATAMART_DIR:-/home/ubuntu/datamart-sis}"
DATA_DIR="$DATAMART_DIR/data/raw"
TMP_DIR="$DATA_DIR/_tmp"
VENV_PY="$DATAMART_DIR/.venv/bin/python"
DB_URL="${DATABASE_URL:-postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@170.9.4.149:5433/datamart_sis}"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
BASE_URL="https://www.datosabiertos.gob.pe/sites/default/files"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# ---------------------------------------------------------------------------
# Todos los ZIPs del catálogo (orden cronológico)
# ---------------------------------------------------------------------------
declare -A FILE_LABELS=(
    ["OPENDATA_DS_01_2017_ATENCIONES_0.zip"]="2017 (completo)"
    ["OPENDATA_DS_01_2018_ATENCIONES_0.zip"]="2018 (completo)"
    ["OPENDATA_DS_01_2019_ATENCIONES_0.zip"]="2019 (completo)"
    ["OPENDATA_DS_01_2020_ATENCIONES_0.zip"]="2020 (completo)"
    ["OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip"]="2021 S1 (ene-jun)"
    ["OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip"]="2021 S2 (jul-dic)"
    ["OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip"]="2022 S1 (ene-jun)"
    ["OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip"]="2022 S2 (jul-dic)"
    ["OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip"]="2023 S1 (ene-jun)"
    ["OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip"]="2023 S2 (jul-dic)"
    ["OPENDATA_DS_01_2024_01_06_ATENCIONES.zip"]="2024 S1 (ene-jun)"
    ["OPENDATA_DS_01_2024_07_12_ATENCIONES.zip"]="2024 S2 (jul-dic)"
    ["OPENDATA_DS_01_2025_01_06_ATENCIONES.zip"]="2025 S1 (ene-jun)"
    ["OPENDATA_DS_01_2025_07_12_ATENCIONES.zip"]="2025 S2 (jul-dic)"
)

ORDERED_FILES=(
    "OPENDATA_DS_01_2017_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2018_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2019_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2020_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip"
    "OPENDATA_DS_01_2024_01_06_ATENCIONES.zip"
    "OPENDATA_DS_01_2024_07_12_ATENCIONES.zip"
    "OPENDATA_DS_01_2025_01_06_ATENCIONES.zip"
    "OPENDATA_DS_01_2025_07_12_ATENCIONES.zip"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
rows_in_db() {
    local fname="$1"
    psql "$DB_URL" -t -c \
        "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis WHERE fuente_archivo='$fname'" \
        2>/dev/null | tr -d ' \n'
}

total_in_db() {
    psql "$DB_URL" -t -c \
        "SELECT COALESCE(SUM(cantidad_atenciones),0) FROM datamart_sis.fact_atenciones_sis" \
        2>/dev/null | tr -d ' \n'
}

rows_by_year() {
    psql "$DB_URL" -t -c \
        "SELECT t.anio, SUM(f.cantidad_atenciones)
         FROM datamart_sis.fact_atenciones_sis f
         JOIN datamart_sis.dim_tiempo t ON f.id_tiempo = t.id_tiempo
         GROUP BY t.anio ORDER BY t.anio" \
        2>/dev/null
}

download_zip() {
    local fname="$1"
    local dest="$DATA_DIR/$fname"
    local url="$BASE_URL/$fname"

    mkdir -p "$DATA_DIR"

    if [[ -f "$dest" ]]; then
        log "  Ya existe localmente: $fname"
        return 0
    fi

    log "  Descargando $fname ..."
    # wget con resume, reintentos, barra de progreso en log
    wget --quiet --show-progress --progress=dot:mega \
         --tries=5 --timeout=120 --waitretry=10 \
         --continue \
         --header="User-Agent: $UA" \
         --header="Referer: https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis" \
         -O "$dest" "$url" 2>&1 | \
         while IFS= read -r line; do echo "  [wget] $line"; done

    if [[ ! -f "$dest" || ! -s "$dest" ]]; then
        log "  ERROR: descarga fallida para $fname"
        return 1
    fi
    log "  Descarga OK: $(du -sh "$dest" | cut -f1) — $fname"
}

load_zip() {
    local fname="$1"
    log "  Cargando $fname al datamart..."
    cd "$DATAMART_DIR"
    DATABASE_URL="$DB_URL" "$VENV_PY" elt_load.py --file "$fname" 2>&1 | \
        while IFS= read -r line; do echo "  [elt] $line"; done
    return "${PIPESTATUS[0]}"
}

refresh_mvs() {
    log "  Refrescando vistas materializadas..."
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
    " 2>&1 | grep -v "^$" | while IFS= read -r line; do echo "  [mv] $line"; done
}

cleanup_zip() {
    local fname="$1"
    local zip_path="$DATA_DIR/$fname"
    local csv_glob="$TMP_DIR/*.csv"

    # Borrar ZIP
    [[ -f "$zip_path" ]] && rm -f "$zip_path" && log "  Borrado ZIP: $fname"

    # Borrar CSVs temporales si quedaron
    for f in $TMP_DIR/*.csv 2>/dev/null; do
        [[ -f "$f" ]] && rm -f "$f" && log "  Borrado temp: $(basename "$f")"
    done
}

check_disk() {
    local avail_mb
    avail_mb=$(df -m "$DATA_DIR" 2>/dev/null | awk 'NR==2{print $4}' || df -m /home | awk 'NR==2{print $4}')
    if [[ "$avail_mb" -lt 500 ]]; then
        log "ADVERTENCIA: poco espacio en disco (${avail_mb} MB disponibles)"
    else
        log "  Disco disponible: ${avail_mb} MB"
    fi
}

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
log "============================================================"
log "DataMart SIS — Ingest completo"
log "VPS: $(hostname) | DB: $DB_URL"
log "============================================================"

# Verificar conexión a DB
if ! psql "$DB_URL" -t -c "SELECT 1" >/dev/null 2>&1; then
    log "ERROR: No se puede conectar a la base de datos"
    exit 1
fi
log "Conexión a DB OK"

# Estado inicial
TOTAL_INICIAL=$(total_in_db)
log "Atenciones actuales en DB: $(printf '%s' "$TOTAL_INICIAL" | sed ':a;s/\B[0-9]\{3\}\b/,&/;ta')"
log ""

# Mostrar estado por año antes de empezar
log "--- Estado actual por año ---"
rows_by_year
log "---"
log ""

LOADED_COUNT=0
SKIPPED_COUNT=0
FAILED=()

mkdir -p "$DATA_DIR" "$TMP_DIR"

for FNAME in "${ORDERED_FILES[@]}"; do
    LABEL="${FILE_LABELS[$FNAME]}"
    log "=== $LABEL — $FNAME ==="

    # Verificar si ya está cargado
    EXISTING=$(rows_in_db "$FNAME")
    if [[ "$EXISTING" -gt 0 ]]; then
        log "  YA CARGADO: $(printf '%s' "$EXISTING" | sed ':a;s/\B[0-9]\{3\}\b/,&/;ta') atenciones — omitiendo"
        SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
        log ""
        continue
    fi

    check_disk

    # Descargar
    if ! download_zip "$FNAME"; then
        log "  ERROR en descarga — pasando al siguiente"
        FAILED+=("$FNAME")
        log ""
        continue
    fi

    # Cargar
    if ! load_zip "$FNAME"; then
        log "  ERROR en carga ELT — limpiando y pasando al siguiente"
        cleanup_zip "$FNAME"
        FAILED+=("$FNAME")
        log ""
        continue
    fi

    # Verificar registros cargados
    CARGADOS=$(rows_in_db "$FNAME")
    log "  Registros cargados: $(printf '%s' "$CARGADOS" | sed ':a;s/\B[0-9]\{3\}\b/,&/;ta') atenciones"

    # Limpiar ZIP (liberar disco antes del siguiente)
    cleanup_zip "$FNAME"

    # Refrescar MVs para que el dashboard muestre los nuevos datos
    refresh_mvs

    TOTAL_AHORA=$(total_in_db)
    log "  Total acumulado en DB: $(printf '%s' "$TOTAL_AHORA" | sed ':a;s/\B[0-9]\{3\}\b/,&/;ta') atenciones"

    LOADED_COUNT=$((LOADED_COUNT + 1))
    log ""
done

# ---------------------------------------------------------------------------
# RESUMEN FINAL
# ---------------------------------------------------------------------------
log "============================================================"
log "RESUMEN FINAL"
log "============================================================"
log "Archivos cargados este run:  $LOADED_COUNT"
log "Archivos ya existían:        $SKIPPED_COUNT"
log "Archivos fallidos:           ${#FAILED[@]}"

if [[ "${#FAILED[@]}" -gt 0 ]]; then
    log "Fallidos:"
    for f in "${FAILED[@]}"; do log "  - $f"; done
fi

log ""
log "--- Atenciones por año (estado final) ---"
rows_by_year
log "---"

TOTAL_FINAL=$(total_in_db)
log ""
log "Total atenciones en DB: $(printf '%s' "$TOTAL_FINAL" | sed ':a;s/\B[0-9]\{3\}\b/,&/;ta')"
log "============================================================"
log "INGEST COMPLETADO"
log "============================================================"
