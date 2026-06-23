# Apache Airflow — DataMart SIS

## Credenciales

- **URL:** ver GitHub Release del último deploy
- **Usuario:** `admin`
- **Password:** `admin2024`

## DAGs disponibles

| DAG | Schedule | Descripción |
|-----|----------|-------------|
| `elt_sis` | Manual | Carga incremental de ZIPs SIS al datamart PostgreSQL |
| `refresh_mvs` | Cada hora | Refresca las 8 MVs del dashboard + invalida cache JSON |

## Arranque (VPS con pip)

```bash
export AIRFLOW_HOME=/home/ubuntu/datamart-sis/airflow
/home/ubuntu/airflow-venv/bin/airflow standalone
```

## Arranque (Docker — requiere >2GB RAM)

```bash
docker compose -f airflow/docker-compose-airflow.yml up -d
```
