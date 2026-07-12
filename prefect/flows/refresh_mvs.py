"""
Prefect flow: refresh-mvs
Refresca las 9 vistas materializadas SIS cada hora.
Ejecuta cada REFRESH en secuencia para evitar ExclusiveLocks simultáneos.
"""
from __future__ import annotations

import os

from prefect import flow, task, get_run_logger

MVS = [
    "mv_kpis",
    "mv_por_anio",
    "mv_por_region",
    "mv_por_edad",
    "mv_por_sexo",
    "mv_top_servicios",
    "mv_por_nivel",
    "mv_por_plan",
    "mv_por_mes",
]


@task(name="refresh-mv", retries=1, retry_delay_seconds=30)
def refresh_mv(mv_name: str) -> None:
    import psycopg2

    c = psycopg2.connect(os.environ["DATABASE_URL"])
    c.autocommit = True
    c.cursor().execute(f"REFRESH MATERIALIZED VIEW datamart_sis.{mv_name}")
    c.close()
    get_run_logger().info(f"Refreshed {mv_name}")


@flow(
    name="refresh-mvs",
    description="Refresca las 9 MVs del datamart SIS. Schedule: cada hora.",
    log_prints=True,
)
def refresh_mvs_flow() -> None:
    for mv in MVS:
        refresh_mv(mv)
