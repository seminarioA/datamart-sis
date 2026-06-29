# Arquitectura del Proyecto — DataMart SIS

## Visión general

```
Browser
  │
  ├─► https://datamart-sis.vercel.app  (Vercel CDN — React SPA)
  │         │
  │    /api/* rewrites
  │         │
  └─► http://192.9.159.35:8080  (Oracle VPS — FastAPI)
            │
      PostgreSQL 16 (Docker)
      │  host: 170.9.4.149:5433  (VPS vieja — solo DB)
      │  user: datamart | db: datamart_sis | db: airflow_db
      │
      Apache Airflow 2.9.3 (pip, no Docker)
      │  AIRFLOW_HOME: /home/ubuntu/datamart-sis/airflow
      │  Metadata DB: airflow_db (PostgreSQL)
      │  DAGs: airflow/dags/
      │
      Cloudflare Tunnels (cloudflared — URLs temporales en cada restart)
         Dashboard: lee de /home/ubuntu/public_url.txt
         Airflow:   lee de /home/ubuntu/airflow_url.txt
```

## Servidores

| VPS | IP | Rol | RAM |
|-----|-----|-----|-----|
| Nueva (app) | 192.9.159.35 | FastAPI + Airflow + tunnels | 1 GB |
| Vieja (DB)  | 170.9.4.149  | PostgreSQL 16 (Docker)      | 1 GB |

### Puertos abiertos (Oracle VCN)
- VPS nueva: 22 (SSH), 8080 (FastAPI), 8082 (Airflow)
- VPS vieja: 22 (SSH), 5433 (PostgreSQL)
- OS-level iptables: igual que VCN

### Swap
- VPS nueva: `/swapfile` (2 GB) + `/swapfile2` (2 GB) = 4 GB total
- `vm.swappiness=10` — swap solo en emergencia

## Stack tecnológico

| Capa | Tecnología | Detalles |
|------|-----------|---------|
| Frontend | React 18 + Vite 5 | SPA, ApexCharts, Leaflet, Signika/Montserrat |
| Hosting frontend | Vercel (Free) | URL fija: datamart-sis.vercel.app |
| Backend API | FastAPI (Python 3.12) | uvicorn 1 worker, puerto 8080 |
| PDF | ReportLab + matplotlib | `/api/pdf` endpoint, ~11s, server-side |
| Base de datos | PostgreSQL 16 (Docker) | Puerto 5433 externo |
| Orquestación | Apache Airflow 2.9.3 | pip install, LocalExecutor, Puerto 8082 |
| ELT | Python 3.12 | elt_load.py, batches 500K filas, idempotente |
| Tunnels | cloudflared (quick tunnel) | URLs cambian en cada restart |
| CI/CD | GitHub Actions | Smart deploy: solo backend si cambia backend |

## Variables de entorno críticas

```bash
# En VPS nueva (192.9.159.35)
DATABASE_URL=postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@170.9.4.149:5433/datamart_sis

# Airflow
AIRFLOW_HOME=/home/ubuntu/datamart-sis/airflow
AIRFLOW__CORE__EXECUTOR=LocalExecutor
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN=postgresql+psycopg2://datamart:FTNIdAQSBTZ5zloaSGl11L4@170.9.4.149:5433/airflow_db
AIRFLOW__WEBSERVER__WORKERS=1
AIRFLOW__WEBSERVER__WORKER_CLASS=sync
AIRFLOW__API__AUTH_BACKENDS=airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session

# PostgreSQL (en VPS vieja)
POSTGRES_USER=datamart
POSTGRES_PASSWORD=FTNIdAQSBTZ5zloaSGl11L4
POSTGRES_DB=datamart_sis
```

## GitHub Secrets

| Secret | Valor | Uso |
|--------|-------|-----|
| `VPS_HOST` | 192.9.159.35 | SSH para deploy backend |
| `VPS_SSH_KEY` | Contenido de ssh-key-2026-06-24.key | SSH auth |
| `GH_PAT` | ghp_n3XsS... | Crear releases, actualizar homepage |

## Archivos clave

```
/home/ubuntu/
├── start_airflow.sh          # Script para iniciar Airflow (usa env vars correctas)
├── restart_tunnels.sh        # Script para reiniciar cloudflared tunnels
├── public_url.txt            # URL actual del Dashboard (trycloudflare.com)
├── airflow_url.txt           # URL actual de Airflow
├── web.log                   # Log de uvicorn
├── airflow-web.log           # Log del webserver de Airflow
├── airflow-sched.log         # Log del scheduler de Airflow
└── datamart-sis/
    ├── web/
    │   ├── app.py            # FastAPI backend
    │   ├── pdf_generator.py  # ReportLab+matplotlib PDF
    │   ├── frontend/         # React SPA (Vite)
    │   └── static/           # GeoJSON Perú, logo SIS
    ├── airflow/
    │   ├── dags/             # DAGs de Airflow
    │   └── airflow.db        # (obsoleto, ahora usa PostgreSQL)
    ├── data/raw/             # ZIPs descargados (14 archivos, ~1.5 GB)
    ├── cache/                # JSON cache L2 (kpis.json, por_region.json, etc.)
    ├── deploy.sh             # Script de deploy (invocado por CI/CD)
    └── .venv/                # Python venv con todas las dependencias
```
