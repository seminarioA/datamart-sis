"""
DAG: elt_sis
Descarga archivos ZIP del portal SIS, los procesa batch a batch
e inserta en el datamart PostgreSQL.

Schedule: manual (o @yearly para actualización anual)
"""
from __future__ import annotations

import os
import subprocess
from datetime import datetime, timedelta

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

DATAMART_DIR = "/home/ubuntu/datamart-sis"
VENV = f"{DATAMART_DIR}/.venv/bin/python"

SIS_FILES = [
    "OPENDATA_DS_01_2017_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2018_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2019_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2020_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip",
    "OPENDATA_DS_01_2023_ATENCIONES.zip",
    "OPENDATA_DS_01_2024_ATENCIONES.zip",
    "OPENDATA_DS_01_2025_07_12_ATENCIONES.zip",
]

default_args = {
    "owner": "seminario",
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": False,
}

with DAG(
    dag_id="elt_sis",
    description="Carga incremental de atenciones SIS al datamart PostgreSQL",
    start_date=datetime(2025, 1, 1),
    schedule=None,  # Manual — lanzar desde la UI de Airflow
    catchup=False,
    default_args=default_args,
    tags=["sis", "elt", "datamart"],
) as dag:

    start = BashOperator(
        task_id="verificar_entorno",
        bash_command=f"cd {DATAMART_DIR} && {VENV} -c 'import psycopg2; print(\"DB OK\")'",
    )

    # Una tarea por archivo ZIP para que sea visible en el Gantt de Airflow
    prev = start
    for zip_file in SIS_FILES:
        year_tag = zip_file.split("_")[3]  # e.g. "2017"
        task = BashOperator(
            task_id=f"cargar_{zip_file.replace('.zip','').replace('-','_')}",
            bash_command=(
                f"cd {DATAMART_DIR} && "
                f"{VENV} elt_load.py --file {zip_file}"
            ),
            execution_timeout=timedelta(hours=3),
        )
        prev >> task
        prev = task

    refresh = BashOperator(
        task_id="refresh_vistas_materializadas",
        bash_command=(
            f"cd {DATAMART_DIR} && "
            f"{VENV} -c \""
            "import psycopg2, os; "
            "c = psycopg2.connect(os.environ['DATABASE_URL']); "
            "c.autocommit = True; cur = c.cursor(); "
            "[cur.execute(f'REFRESH MATERIALIZED VIEW datamart_sis.{mv}') "
            " for mv in ['mv_kpis','mv_por_anio','mv_por_region','mv_por_edad',"
            "            'mv_por_sexo','mv_top_servicios','mv_por_nivel','mv_por_plan']]; "
            "print('MVs refreshed'); c.close()\""
        ),
        env={"DATABASE_URL": "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@localhost:5433/datamart_sis"},
    )
    prev >> refresh
