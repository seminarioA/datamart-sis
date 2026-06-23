"""
DAG: refresh_mvs
Refresca las 8 vistas materializadas del dashboard cada hora.
Invalida el cache JSON del API para que la siguiente petición
obtenga datos frescos de la DB.

Schedule: cada hora
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator

DATABASE_URL = "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@localhost:5433/datamart_sis"
CACHE_DIR    = Path("/home/ubuntu/datamart-sis/cache")

MVS = [
    "mv_kpis",
    "mv_por_anio",
    "mv_por_region",
    "mv_por_edad",
    "mv_por_sexo",
    "mv_top_servicios",
    "mv_por_nivel",
    "mv_por_plan",
]

default_args = {
    "owner": "seminario",
    "retries": 1,
    "retry_delay": timedelta(minutes=2),
    "email_on_failure": False,
}


def refresh_mv(mv_name: str, **ctx):
    import psycopg2
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f"REFRESH MATERIALIZED VIEW datamart_sis.{mv_name}")
    conn.close()
    # Invalidar cache JSON para que el API sirva datos frescos en la próxima petición
    cache_key = mv_name[3:]  # "mv_kpis" → "kpis"
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        cache_file.unlink()
    print(f"Refreshed {mv_name} — cache invalidated")


with DAG(
    dag_id="refresh_mvs",
    description="Refresca las vistas materializadas del dashboard SIS",
    start_date=datetime(2025, 1, 1),
    schedule="0 * * * *",   # cada hora
    catchup=False,
    default_args=default_args,
    tags=["sis", "dashboard", "mvs"],
    max_active_runs=1,
) as dag:

    tasks = [
        PythonOperator(
            task_id=f"refresh_{mv}",
            python_callable=refresh_mv,
            op_kwargs={"mv_name": mv},
        )
        for mv in MVS
    ]

    # Ejecutar en paralelo (independientes entre sí)
    # Si prefieres serie: tasks[i] >> tasks[i+1]
