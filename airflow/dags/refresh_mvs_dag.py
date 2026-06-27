"""
DAG: refresh_mvs — max_active_runs=1 evita runs duplicados y ExclusiveLocks simultaneos.
Ejecuta REFRESH de forma secuencial (uno a la vez) e invalida cache JSON.
"""
from __future__ import annotations
from datetime import datetime
from pathlib import Path
from airflow import DAG
from airflow.operators.python import PythonOperator

DATABASE_URL = "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@170.9.4.149:5433/datamart_sis"
CACHE_DIR    = Path("/home/ubuntu/datamart-sis/cache")
MVS = [
    "mv_kpis","mv_por_anio","mv_por_region","mv_por_edad",
    "mv_por_sexo","mv_top_servicios","mv_por_nivel","mv_por_plan","mv_por_mes",
]

def refresh_mv(mv_name: str, **ctx):
    import psycopg2
    c = psycopg2.connect(DATABASE_URL); c.autocommit = True
    c.cursor().execute(f"REFRESH MATERIALIZED VIEW datamart_sis.{mv_name}")
    c.close()
    for k in [mv_name.replace("mv_", "", 1), "dashboard"]:
        f = CACHE_DIR / f"{k}.json"
        if f.exists(): f.unlink()
    print(f"Refreshed {mv_name} — cache invalidado")

with DAG(
    dag_id="refresh_mvs",
    description="Refresca MVs SIS — max_active_runs=1 evita locks duplicados",
    start_date=datetime(2025, 1, 1),
    schedule="0 * * * *",
    catchup=False,
    default_args={"owner": "seminario", "retries": 0, "email_on_failure": False},
    tags=["sis", "dashboard", "mvs"],
    max_active_runs=1,   # clave: un solo run activo a la vez
    max_active_tasks=1,  # un REFRESH a la vez dentro del run
) as dag:
    tasks = [
        PythonOperator(task_id=f"refresh_{mv}", python_callable=refresh_mv, op_kwargs={"mv_name": mv})
        for mv in MVS
    ]
    for i in range(len(tasks) - 1):
        tasks[i] >> tasks[i + 1]
