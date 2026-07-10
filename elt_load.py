"""
elt_load.py - DataMart SIS - carga incremental por batches
Procesa cada CSV en lotes de 50K filas. Hace COMMIT después de cada lote,
así los datos son visibles progresivamente en la DB.
"""

import argparse
import csv
import io
import os
import sys
import logging
import zipfile
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
log = logging.getLogger("elt")

DATABASE_URL = os.getenv("DATABASE_URL")
RAW_DIR = Path(os.getenv("DATA_RAW_DIR", "./data/raw"))
TMP_DIR = RAW_DIR / "_tmp"
BATCH_SIZE = 500_000


def extract_csv(zip_path: Path, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path) as z:
        csv_names = [n for n in z.namelist() if n.endswith(".csv")]
        if not csv_names:
            raise ValueError(f"No hay CSV dentro de {zip_path.name}")
        name = csv_names[0]
        log.info(f"{zip_path.name}: extrayendo {name} a disco...")
        z.extract(name, out_dir)
        return out_dir / name


def process_batch(conn, rows: list, fuente: str) -> int:
    """Carga un lote al staging y ejecuta ELT. Commitea al final."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(rows)   # sin header — COPY posicional
    buf.seek(0)

    with conn.cursor() as cur:
        cur.execute("SET synchronous_commit = off")
        cur.execute("SET work_mem = '128MB'")
        cur.execute("TRUNCATE datamart_sis.stg_atenciones")
        cur.copy_expert(
            "COPY datamart_sis.stg_atenciones FROM STDIN WITH (FORMAT csv, HEADER false)",
            buf,
        )
        cur.execute("SELECT datamart_sis.fn_load_staging(%s)", (fuente,))
        filas = cur.fetchone()[0]

    if filas is None or filas <= 0:
        raise RuntimeError(
            f"fn_load_staging devolvió {filas} filas para {fuente} — posible fallo silencioso"
        )

    conn.commit()
    return filas


def load_file(conn, csv_path: Path, fuente: str) -> int:
    # Borra datos previos de este archivo para que el rerun sea idempotente
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM datamart_sis.fact_atenciones_sis WHERE fuente_archivo = %s",
            (fuente,),
        )
        deleted = cur.rowcount
    conn.commit()
    if deleted:
        log.info(f"{fuente}: {deleted:,} filas previas eliminadas (rerun)")

    total = 0
    batch_num = 0
    batch = []

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # salta header del CSV

        for row in reader:
            batch.append(row)
            if len(batch) >= BATCH_SIZE:
                batch_num += 1
                filas = process_batch(conn, batch, fuente)
                total += filas
                log.info(
                    f"{fuente}: batch {batch_num} -> {filas:,} filas | acumulado: {total:,}"
                )
                batch = []

        if batch:
            batch_num += 1
            filas = process_batch(conn, batch, fuente)
            total += filas
            log.info(
                f"{fuente}: batch {batch_num} (último) -> {filas:,} filas | acumulado: {total:,}"
            )

    # Todos los batches se commitearon sin excepciones: marcar el archivo
    # como completamente cargado en la tabla de control.
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO datamart_sis.etl_load_control (fuente_archivo, rows_loaded)
            VALUES (%s, %s)
            ON CONFLICT (fuente_archivo) DO UPDATE
                SET rows_loaded = EXCLUDED.rows_loaded,
                    completed_at = now()
            """,
            (fuente, total),
        )
    conn.commit()

    return total


def ensure_control_table(conn) -> None:
    """Crea (si no existe) la tabla de control que rastrea qué archivos
    fueron completamente cargados. Idempotente — segura de llamar siempre."""
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS datamart_sis.etl_load_control (
                fuente_archivo TEXT PRIMARY KEY,
                rows_loaded INTEGER NOT NULL,
                completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    conn.commit()


def already_loaded(conn, zip_name: str) -> bool:
    """Devuelve True si el archivo ya fue cargado COMPLETAMENTE, según la
    tabla de control (no infiere completitud a partir del conteo de filas
    en la fact table, ya que una carga parcial dejaría filas sin terminar)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM datamart_sis.etl_load_control WHERE fuente_archivo = %s)",
            (zip_name,)
        )
        return cur.fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description="ELT carga DataMart SIS")
    parser.add_argument("--file", type=str, default=None,
                        help="Nombre del ZIP a procesar (ej: OPENDATA_DS_01_2019_ATENCIONES_0.zip). "
                             "Sin este argumento procesa todos los ZIPs en data/raw/.")
    parser.add_argument("--force", action="store_true",
                        help="Forzar recarga aunque el archivo ya esté cargado.")
    args = parser.parse_args()

    if not DATABASE_URL:
        log.error("DATABASE_URL no definida (revisa .env)")
        sys.exit(1)

    if args.file:
        zp = RAW_DIR / args.file
        if not zp.exists():
            log.error(f"Archivo no encontrado: {zp}")
            sys.exit(1)
        zips = [zp]
    else:
        zips = sorted(RAW_DIR.glob("OPENDATA_DS_01_*.zip"))
        if not zips:
            log.error(f"No hay ZIPs en {RAW_DIR}")
            sys.exit(1)

    conn = psycopg2.connect(DATABASE_URL)
    try:
        ensure_control_table(conn)
        for zp in zips:
            if not args.force and already_loaded(conn, zp.name):
                log.info(f"{zp.name}: ya cargado — omitiendo (usa --force para recargar)")
                continue
            log.info(f"=== Procesando {zp.name} ===")
            csv_path = extract_csv(zp, TMP_DIR)
            try:
                total = load_file(conn, csv_path, zp.name)
                log.info(f"{zp.name}: COMPLETO — {total:,} filas totales")
            finally:
                csv_path.unlink(missing_ok=True)
    finally:
        conn.close()

    log.info("=== ELT completado. ===")


if __name__ == "__main__":
    main()
