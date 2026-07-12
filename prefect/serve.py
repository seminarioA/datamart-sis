"""
serve.py — Arranca ambos flows como deployments locales.
Requiere que el servidor Prefect esté corriendo (prefect server start).

Uso:
  DATABASE_URL='...' PREFECT_API_URL='http://127.0.0.1:4200/api' \\
    .venv/bin/python prefect/serve.py
"""
from prefect import serve

from flows.elt_sis import elt_sis_flow
from flows.refresh_mvs import refresh_mvs_flow

if __name__ == "__main__":
    elt_deployment = elt_sis_flow.to_deployment(
        name="elt-sis-manual",
        description="Carga incremental SIS — trigger manual desde UI",
    )
    refresh_deployment = refresh_mvs_flow.to_deployment(
        name="refresh-mvs-hourly",
        description="Refresca MVs del datamart — cada hora",
        cron="0 * * * *",
    )
    serve(elt_deployment, refresh_deployment)
