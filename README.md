# DataMart SIS — Atenciones de Salud

Sistema de inteligencia de negocios sobre datos abiertos del Seguro Integral de Salud (SIS) del Perú.
Dashboard interactivo disponible en **[datamart-sis.vercel.app](https://datamart-sis.vercel.app)**.

> URLs de Airflow y estado del deploy en el último [GitHub Release](https://github.com/seminarioA/datamart-sis/releases/latest).

## Integrantes

| Nombre | Código |
|--------|--------|
| Seminario Medina, Alejandro Valentino | U22247454 |
| Ortega Vilela, Sigidiego | U22323434 |
| Mena Delgado, Sergio | U22323434 |

**Docente:** Balcazar Chumacero, Oscar Eduardo
**Curso:** Inteligencia de Negocios
**Universidad:** UTP — Ingeniería de Sistemas e Informática
**Periodo:** 2025 — 2026

## Arquitectura

```
Browser
  |
  +-- https://datamart-sis.vercel.app   (Vercel CDN — React SPA)
  |         |
  |    /api/* rewrites
  |         |
  +-- http://192.9.159.35:8080          (Oracle VPS — FastAPI + Airflow)
            |
      PostgreSQL 16 (Docker)
            host: 170.9.4.149:5433
            db: datamart_sis / airflow_db
```

| Componente | Detalle |
|------------|---------|
| Frontend | React 18 + Vite — Vercel (URL fija: datamart-sis.vercel.app) |
| Backend API | FastAPI + uvicorn — Oracle VPS 192.9.159.35:8080 |
| Base de datos | PostgreSQL 16 (Docker) — Oracle VPS 170.9.4.149:5433 |
| Orquestación | Apache Airflow 2.9 — pip install, LocalExecutor |
| Acceso público | Cloudflare Tunnel (cloudflared) — URLs en cada Release |
| CI/CD | GitHub Actions — smart deploy (backend solo si cambia backend) |
| Imagen Docker | ghcr.io/seminarioa/datamart-sis/api:latest — publicada en GHCR |

### VPS

| VPS | IP | Rol | RAM |
|-----|-----|-----|-----|
| App | 192.9.159.35 | FastAPI + Airflow + Cloudflared | 1 GB |
| DB  | 170.9.4.149  | PostgreSQL 16 (Docker)          | 1 GB |

## Fuente de datos

- **Entidad:** Seguro Integral de Salud (SIS) — Ministerio de Salud del Perú
- **Portal:** https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis
- **Licencia:** Open Data Commons Attribution License (ODC-By)
- **Cobertura:** 2017 — 2025 (archivos anuales/semestrales, ZIP/CSV)

## Tecnologías

| Capa | Herramienta |
|------|-------------|
| Base de datos | PostgreSQL 16 (Docker) |
| ELT | Python 3.12 — psycopg2, COPY batches 500K filas, idempotente |
| Orquestación | Apache Airflow 2.9 (DAGs en `airflow/dags/`) |
| API | FastAPI — cache 3 capas (memoria → JSON disco → MV PostgreSQL) |
| PDF server-side | ReportLab + matplotlib (`/api/pdf`) |
| Frontend | React 18 + Vite + ApexCharts + Leaflet |
| CI/CD | GitHub Actions — smart deploy por paths |
| Contenedores | Docker + GHCR (github.com/seminarioA/datamart-sis/pkgs/container) |

## Estructura del proyecto

```
datamart-sis/
├── web/
│   ├── app.py               # FastAPI backend (cache 3 capas, MVs, PDF)
│   ├── pdf_generator.py     # Generador PDF server-side (ReportLab)
│   ├── frontend/            # React SPA (Vite, ApexCharts, Leaflet)
│   └── static/              # GeoJSON Peru, logo SIS
├── airflow/
│   └── dags/
│       ├── elt_sis_dag.py         # Carga incremental de ZIPs SIS
│       └── refresh_mvs_dag.py     # Refresco hourly de vistas materializadas
├── sql/
│   ├── 01_create_schema.sql
│   ├── 02_create_tables.sql
│   ├── 03_indexes.sql
│   ├── 05_staging_and_elt.sql     # fn_load_staging con COALESCE fixes
│   └── 06_seed_dims.sql
├── docker/
│   └── docker-compose.yml         # PostgreSQL para desarrollo local
├── docs/
│   ├── star_schema.png
│   ├── ARQUITECTURA.md
│   ├── CACHE.md
│   ├── ELT.md
│   └── CICD.md
├── tests/
│   └── test_dashboard_modules.py  # 24 tests de integración (pytest)
├── Dockerfile                     # Imagen API para GHCR
├── docker-compose.simple.yml      # Instalacion via contenedores
├── deploy.sh                      # Script de deploy en VPS
├── elt_load.py                    # ELT incremental por batches
├── download_sis_data.py           # Descarga ZIPs desde portal SIS
├── requirements.txt
└── .env.example
```

## Modelo dimensional (Star Schema)

![Star Schema — DataMart SIS](docs/star_schema.png)

**Tabla de hechos:** `FACT_ATENCIONES_SIS`
**Medida:** `CANTIDAD_ATENCIONES` — suma de atenciones por combinación dimensional
**Granularidad:** Una fila = (año, mes, región, provincia, distrito, IPRESS, nivel, plan, servicio, sexo, grupo edad)

| Dimensión | PK | Descripción |
|-----------|-----|-------------|
| `DIM_TIEMPO` | `id_tiempo` | Año, mes, trimestre, semestre |
| `DIM_UBICACION` | `cod_ubigeo` | Región, provincia, distrito (ubigeo 6 dígitos) |
| `DIM_IPRESS` | `cod_ipress` | Establecimiento de salud y unidad ejecutora |
| `DIM_NIVEL_IPRESS` | `nivel_eess` | Nivel I / II / III de complejidad EESS |
| `DIM_PLAN_SEGURO` | `cod_plan_seguro` | SIS Gratuito, Independiente, Emprendedor, Microempresa |
| `DIM_SERVICIO` | `cod_servicio` | Tipo de atención (Consulta Externa, CRED, etc.) |
| `DIM_SEXO` | `sexo` | MASCULINO / FEMENINO |
| `DIM_GRUPO_EDAD` | `grupo_edad` | 00-04, 05-11, 12-17, 18-29, 30-59, 60+ |

## Instalación y uso

Ambos métodos parten de `git clone`. La diferencia es qué se levanta después.

| | Metodo A — Contenedores | Metodo B — Desarrollo local |
|---|---|---|
| Requiere | Docker | Python 3.12, Docker |
| Usa | Imagen pre-construida de GHCR | Código fuente directamente |
| Ideal para | Demo, producción, onboarding | Contribuir, modificar código |

La imagen se publica automáticamente en GHCR en cada push a `main` que modifique el backend (`.github/workflows/docker-publish.yml`). No hay nada que hacer manualmente.

---

### Metodo A — Contenedores desde GHCR

```bash
git clone https://github.com/seminarioA/datamart-sis.git
cd datamart-sis
cp .env.example .env
docker compose -f docker-compose.simple.yml up -d
```

Abrir en `http://localhost:8080`.

Actualizar a la ultima version:

```bash
docker compose -f docker-compose.simple.yml pull
docker compose -f docker-compose.simple.yml up -d
```

Bajar los servicios:

```bash
docker compose -f docker-compose.simple.yml down      # conserva datos
docker compose -f docker-compose.simple.yml down -v   # elimina datos
```

---

### Metodo B — Desarrollo local

```bash
git clone https://github.com/seminarioA/datamart-sis.git
cd datamart-sis

# Base de datos
cd docker && docker compose up -d && cd ..

# Entorno Python
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Variables de entorno
cp .env.example .env

# Servidor de desarrollo
cd web
DATABASE_URL=postgresql://datamart:datamart2024@localhost:5433/datamart_sis \
  uvicorn app:app --reload --port 8080
```

Pipeline ELT (opcional):

```bash
python download_sis_data.py                                             # descarga ZIPs
DATABASE_URL=... python elt_load.py --file OPENDATA_DS_01_2019_ATENCIONES_0.zip
# O via Airflow en http://localhost:8082 — ver docs/ELT.md
```

## Archivos disponibles en el portal SIS

| Archivo | Periodo | Tamano ZIP |
|---------|---------|-----------|
| OPENDATA_DS_01_2017_ATENCIONES_0.zip | Ene–Dic 2017 | 93 MB |
| OPENDATA_DS_01_2018_ATENCIONES_0.zip | Ene–Dic 2018 | 11 MB |
| OPENDATA_DS_01_2019_ATENCIONES_0.zip | Ene–Dic 2019 | 98 MB |
| OPENDATA_DS_01_2020_ATENCIONES_0.zip | Ene–Dic 2020 | 56 MB |
| OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip | Ene–Jun 2021 | 34 MB |
| OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip | Jul–Dic 2021 | 51 MB |
| OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip | Ene–Jun 2022 | 126 MB |
| OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip | Jul–Dic 2022 | 131 MB |
| OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip | Ene–Jun 2023 | 148 MB |
| OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip | Jul–Dic 2023 | 148 MB |
| OPENDATA_DS_01_2024_01_06_ATENCIONES.zip | Ene–Jun 2024 | 158 MB |
| OPENDATA_DS_01_2024_07_12_ATENCIONES.zip | Jul–Dic 2024 | 157 MB |
| OPENDATA_DS_01_2025_01_06_ATENCIONES.zip | Ene–Jun 2025 | 168 MB |
| OPENDATA_DS_01_2025_07_12_ATENCIONES.zip | Jul–Dic 2025 | 165 MB |
