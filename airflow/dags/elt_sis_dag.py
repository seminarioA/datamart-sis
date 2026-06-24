"""
DAG: elt_sis
Carga los archivos ZIP de SIS al datamart PostgreSQL.
Cada archivo = 1 tarea visible en el Gantt.
Idempotente: si un archivo ya fue cargado se omite (a menos de forzar).

Schedule: Manual — lanzar desde la UI de Airflow
"""
from __future__ import annotations

from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.bash import BashOperator

DATAMART_DIR = "/home/ubuntu/datamart-sis"
VENV_PY    = f"{DATAMART_DIR}/.venv/bin/python"
DB_URL     = "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@localhost:5433/datamart_sis"

# Nombres exactos de los archivos en data/raw/
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

default_args = {
    "owner": "seminario",
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
    "email_on_failure": False,
}

with DAG(
    dag_id="elt_sis",
    description="Carga incremental de atenciones SIS — 14 archivos, 1 tarea por archivo",
    start_date=datetime(2025, 1, 1),
    schedule=None,
    catchup=False,
    default_args=default_args,
    tags=["sis", "elt", "datamart"],
    max_active_runs=1,
) as dag:

    verificar = BashOperator(
        task_id="verificar_entorno",
        bash_command=(
            f"cd {DATAMART_DIR} && "
            f"DATABASE_URL='{DB_URL}' {VENV_PY} -c "
            "'import psycopg2, os; "
            "c = psycopg2.connect(os.environ[\"DATABASE_URL\"]); "
            "cur = c.cursor(); "
            "cur.execute(\"SELECT COUNT(*) FROM datamart_sis.fact_atenciones_sis\"); "
            "n = cur.fetchone()[0]; "
            "print(f\"DB OK — {n:,} filas actuales\"); "
            "c.close()'"
        ),
        env={"DATABASE_URL": DB_URL},
    )

    prev = verificar
    for zip_file in SIS_FILES:
        # task_id seguro: sin puntos ni caracteres especiales
        safe_id = zip_file.replace(".zip", "").replace("-", "_").replace(".", "_")
        task = BashOperator(
            task_id=safe_id,
            bash_command=(
                f"cd {DATAMART_DIR} && "
                f"DATABASE_URL='{DB_URL}' "
                f"{VENV_PY} elt_load.py --file {zip_file}"
            ),
            env={"DATABASE_URL": DB_URL},
            execution_timeout=timedelta(hours=4),
        )
        prev >> task
        prev = task

    refresh = BashOperator(
        task_id="refresh_vistas_materializadas",
        bash_command=(
            f"cd {DATAMART_DIR} && "
            f"DATABASE_URL='{DB_URL}' {VENV_PY} -c \""
            "import psycopg2, os; "
            "c = psycopg2.connect(os.environ['DATABASE_URL']); "
            "c.autocommit = True; cur = c.cursor(); "
            "mvs = ['mv_kpis','mv_por_anio','mv_por_region','mv_por_edad',"
            "       'mv_por_sexo','mv_top_servicios','mv_por_nivel','mv_por_plan','mv_por_mes']; "
            "[cur.execute(f'REFRESH MATERIALIZED VIEW datamart_sis.{mv}') for mv in mvs]; "
            "print('MVs refreshed OK'); c.close()\""
        ),
        env={"DATABASE_URL": DB_URL},
    )
    prev >> refresh
