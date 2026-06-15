"""
main.py
=======
Orquestador del pipeline ETL completo para el DataMart SIS.

Uso:
  python etl/main.py                          # Ejecuta E→T→L completo
  python etl/main.py --step extract           # Solo extracción
  python etl/main.py --step transform         # Solo transformación (requiere --input)
  python etl/main.py --step load              # Solo carga
  python etl/main.py --years 2023 2024        # Solo esos años
  python etl/main.py --dry-run                # Simula sin cargar a BD
"""

import argparse
import logging
import sys
import time
from pathlib import Path
from datetime import datetime

# Asegurar imports relativos
sys.path.insert(0, str(Path(__file__).parent.parent))

from etl import extract, transform, load

# ─── Logging ──────────────────────────────────────────────────────────────────

def setup_logging(level: str = "INFO"):
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(f"etl_run_{datetime.now():%Y%m%d_%H%M%S}.log")
        ]
    )

logger = logging.getLogger("main")


# ─── Pipeline completo ────────────────────────────────────────────────────────

def run_full_pipeline(years: list = None, dry_run: bool = False):
    start = time.time()
    logger.info("=" * 60)
    logger.info("PIPELINE ETL — DATAMART SIS")
    logger.info("=" * 60)

    # EXTRACT
    logger.info("PASO 1/3: EXTRACCIÓN")
    streams = extract.run(years=years)
    if not streams:
        logger.error(
            "No se encontraron archivos para procesar.\n"
            "Opciones:\n"
            "  a) Descarga los ZIPs manualmente desde:\n"
            "     https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis\n"
            "  b) Colócalos en la carpeta data/raw/\n"
            "  c) Vuelve a ejecutar este script"
        )
        sys.exit(1)
    logger.info(f"Archivos extraídos: {len(streams)}")

    # TRANSFORM
    logger.info("PASO 2/3: TRANSFORMACIÓN")
    tables = transform.run(streams)
    logger.info("Transformación completada.")
    for name, df in tables.items():
        logger.info(f"  {name}: {len(df):,} registros")

    # LOAD
    if dry_run:
        logger.info("PASO 3/3: CARGA (DRY-RUN — no se escribe en BD)")
        logger.info("Para cargar a la base de datos, ejecuta sin --dry-run")
    else:
        logger.info("PASO 3/3: CARGA A POSTGRESQL (SUPABASE)")
        load.run(tables)

    elapsed = time.time() - start
    logger.info("=" * 60)
    logger.info(f"PIPELINE COMPLETADO en {elapsed:.1f}s")
    logger.info("=" * 60)


# ─── CLI ─────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(
        description="Pipeline ETL — DataMart de Atenciones SIS",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "--step",
        choices=["extract", "transform", "load", "all"],
        default="all",
        help="Etapa a ejecutar (default: all)"
    )
    parser.add_argument(
        "--years",
        nargs="+",
        type=int,
        default=None,
        help="Años a procesar (ej: 2023 2024). Default: todos los disponibles"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Ejecuta E y T pero no carga a la BD"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Nivel de logging (default: INFO)"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    setup_logging(args.log_level)

    if args.step == "all":
        run_full_pipeline(years=args.years, dry_run=args.dry_run)

    elif args.step == "extract":
        logger.info("Ejecutando solo EXTRACCIÓN")
        streams = extract.run(years=args.years)
        logger.info(f"Archivos disponibles: {len(streams)}")
        for name, _ in streams:
            logger.info(f"  ✓ {name}")

    elif args.step == "transform":
        logger.info("Ejecutando solo TRANSFORMACIÓN (usando archivos locales)")
        streams = extract.run(years=args.years)
        if not streams:
            logger.error("No hay archivos. Ejecuta primero: python etl/main.py --step extract")
            sys.exit(1)
        tables = transform.run(streams)
        for name, df in tables.items():
            print(f"\n{name.upper()} — {len(df):,} registros")
            print(df.head(3).to_string())

    elif args.step == "load":
        logger.info("Ejecutando solo CARGA (requiere datos ya transformados en memoria)")
        logger.warning("Para carga individual, ejecuta 'all' o 'transform+load' en secuencia.")

    logger.info("Proceso finalizado.")


if __name__ == "__main__":
    main()
