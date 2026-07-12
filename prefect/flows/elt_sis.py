"""
Prefect flow: elt-sis
Carga incremental de los 14 datasets SIS al datamart PostgreSQL.
Cada archivo es una tarea independiente visible en el Prefect UI.
Idempotente: si un archivo ya fue cargado (fuente_archivo existe) se omite.
Trigger: manual desde Prefect UI o CLI.
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from prefect import flow, task, get_run_logger

DATAMART_DIR = Path("/home/ubuntu/datamart-sis")
VENV_PY = DATAMART_DIR / ".venv" / "bin" / "python"

SIS_FILES = [
    "OPENDATA_DS_01_2017_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2018_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2019_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2020_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2024_01_06_ATENCIONES.zip",
    "OPENDATA_DS_01_2024_07_12_ATENCIONES.zip",
    "OPENDATA_DS_01_2025_01_06_ATENCIONES.zip",
    "OPENDATA_DS_01_2025_07_12_ATENCIONES.zip",
]


@task(
    name="cargar-archivo",
    retries=1,
    retry_delay_seconds=300,
    timeout_seconds=28800,   # 8 h por archivo
)
def load_file(zip_file: str) -> int:
    logger = get_run_logger()
    env = {**os.environ, "DATABASE_URL": os.environ["DATABASE_URL"]}
    result = subprocess.run(
        [str(VENV_PY), "elt_load.py", "--file", zip_file],
        cwd=str(DATAMART_DIR),
        env=env,
        capture_output=True,
        text=True,
    )
    logger.info(result.stdout[-4000:] if result.stdout else "(sin salida)")
    if result.returncode != 0:
        logger.error(result.stderr[-2000:])
        raise RuntimeError(f"elt_load.py falló para {zip_file}: {result.stderr[-500:]}")
    rows = 0
    for line in result.stdout.splitlines():
        if "FACT rows inserted" in line or "filas insertadas" in line.lower():
            try:
                rows = int(line.split()[-1].replace(",", ""))
            except ValueError:
                pass
    logger.info(f"{zip_file}: OK ({rows:,} filas)")
    return rows


@task(name="refrescar-mvs")
def refresh_mvs() -> None:
    logger = get_run_logger()
    import psycopg2

    mvs = [
        "mv_kpis", "mv_por_anio", "mv_por_region", "mv_por_edad",
        "mv_por_sexo", "mv_top_servicios", "mv_por_nivel", "mv_por_plan", "mv_por_mes",
    ]
    c = psycopg2.connect(os.environ["DATABASE_URL"])
    c.autocommit = True
    cur = c.cursor()
    for mv in mvs:
        cur.execute(f"REFRESH MATERIALIZED VIEW datamart_sis.{mv}")
        logger.info(f"Refreshed {mv}")
    c.close()


@flow(
    name="elt-sis",
    description="Carga incremental SIS — 14 archivos, 1 tarea por archivo. Trigger manual.",
    log_prints=True,
)
def elt_sis_flow() -> None:
    total = 0
    for zip_file in SIS_FILES:
        rows = load_file(zip_file)
        total += rows
    refresh_mvs()
    get_run_logger().info(f"ELT completado — {total:,} filas totales insertadas")
