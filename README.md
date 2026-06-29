# DataMart de Atenciones de Salud — SIS

DataMart dimensional construido sobre datos abiertos del Seguro Integral de Salud (SIS) del Perú, disponibles en la [Plataforma Nacional de Datos Abiertos](https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis).

> **Dashboard & Airflow:** URLs públicas disponibles en el último [GitHub Release](https://github.com/seminarioA/datamart-sis/releases/latest) — se actualizan automáticamente en cada deploy.

## Infraestructura

| Componente | Detalle |
|------------|---------|
| **Proveedor** | Oracle Cloud Infrastructure (OCI) — Always Free Tier |
| **Instancia** | VM.Standard.E2.1.Micro |
| **CPU** | 2 vCPU AMD EPYC 7J13 |
| **RAM** | 1 GB DDR4 |
| **Almacenamiento** | 50 GB Block Volume (SSD) |
| **SO** | Ubuntu 24.04.4 LTS (x86_64) |
| **Red** | Oracle VCN — acceso público via Cloudflare Tunnel (sin puertos abiertos) |

## Integrantes

| Nombre | Código |
|--------|--------|
| Seminario Medina, Alejandro Valentino | U22247454 |
| Ortega Vilela, Sigidiego | U22323434 |

**Docente:** Balcazar Chumacero, Oscar Eduardo  
**Curso:** Inteligencia de Negocios  
**Universidad:** UTP — Ingeniería de Sistemas e Informática  
**Periodo:** 2025 — 2026

## Fuente de datos

- **Entidad:** Seguro Integral de Salud (SIS) — Ministerio de Salud del Perú
- **Portal:** https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis
- **Licencia:** Open Data Commons Attribution License (ODC-By)
- **Cobertura:** 2017 — 2025 (archivos anuales/semestrales en formato CSV comprimido ZIP)

## Tecnologías utilizadas

| Capa | Herramienta |
|------|-------------|
| Base de datos | PostgreSQL 16 (Docker) |
| ELT | Python 3.11 — psycopg2, COPY batches de 500K filas |
| Orquestación | Apache Airflow 2.9 (DAGs en `airflow/dags/`) |
| API | FastAPI — cache 3 capas (mem → JSON disco → MV PG) |
| Frontend | React 18 + Vite + ApexCharts + Leaflet |
| Infraestructura | Oracle VPS Ubuntu 24.04 — CI/CD via GitHub Actions |

## Estructura del proyecto

```
datamart-sis/
├── etl/
│   ├── extract.py          # Descarga y extracción de ZIPs desde datosabiertos.gob.pe
│   ├── transform.py        # Limpieza, normalización y construcción de dimensiones
│   ├── load.py             # Carga batch a PostgreSQL (Supabase)
│   └── main.py             # Orquestador principal del pipeline ETL
├── sql/
│   ├── 01_create_schema.sql    # Creación del esquema datamart_sis
│   ├── 02_create_tables.sql    # DDL de tablas de hechos y dimensiones
│   ├── 03_indexes.sql          # Índices para optimización de consultas
│   └── 04_validaciones.sql     # Script de validación y pruebas de calidad
├── tests/
│   └── test_transform.py   # Pruebas unitarias de transformaciones
├── docs/
│   └── modelo_estrella.md  # Documentación del modelo dimensional
├── data/
│   ├── raw/                # CSVs originales descargados (no versionados)
│   └── processed/          # Datos transformados listos para carga
├── .env.example            # Plantilla de variables de entorno
├── requirements.txt        # Dependencias Python
└── README.md
```

## Modelo dimensional (Star Schema)

![Star Schema — DataMart SIS](docs/star_schema.png)

**Tabla de hechos:** `FACT_ATENCIONES_SIS`  
**Medidas:** `CANTIDAD_ATENCIONES` (suma de atenciones)  
**Granularidad:** Una fila = combinación única de (año, mes, región, provincia, distrito, IPRESS, nivel, plan seguro, servicio, sexo, grupo edad)

| Dimensión | PK | Descripción |
|-----------|-----|-------------|
| `DIM_TIEMPO` | `id_tiempo` | Año, mes, trimestre, semestre |
| `DIM_UBICACION` | `cod_ubigeo` | Región, provincia, distrito (ubigeo 6 dígitos) |
| `DIM_IPRESS` | `cod_ipress` | Establecimiento de salud y unidad ejecutora |
| `DIM_NIVEL_IPRESS` | `nivel_eess` | Nivel I / II / III de complejidad |
| `DIM_PLAN_SEGURO` | `cod_plan_seguro` | SIS Gratuito, Independiente, Emprendedor… |
| `DIM_SERVICIO` | `cod_servicio` | Tipo de atención (Consulta Externa, CRED…) |
| `DIM_SEXO` | `sexo` | MASCULINO / FEMENINO |
| `DIM_GRUPO_EDAD` | `grupo_edad` | 00-04, 05-11, 12-17, 18-29, 30-59, 60+…|

## Instalación y uso

Ambos métodos parten del mismo `git clone`. La diferencia es qué se levanta después:

| | Método A — Docker | Método B — Desarrollo local |
|---|---|---|
| Requiere | Docker | Python 3.12, Docker |
| Usa | Imagen pre-construida de GHCR | Código fuente directamente |
| Ideal para | Demo, producción, onboarding | Contribuir, modificar el código |

> **¿Cómo llega la imagen a GHCR?** El workflow `.github/workflows/docker-publish.yml` la construye y publica automáticamente en cada push a `main` que modifique el backend. No hay que hacer nada manual.

---

### 🐳 Método A — Contenedores desde GHCR

**1. Clonar el repositorio**

```bash
git clone https://github.com/seminarioA/datamart-sis.git
cd datamart-sis
```

**2. Configurar variables de entorno**

```bash
cp .env.example .env
# Opcional: editar .env para cambiar la contraseña de PostgreSQL
```

**3. Levantar todo con Docker**

```bash
docker compose -f docker-compose.simple.yml up -d
```

Docker descarga automáticamente desde GHCR:
- `ghcr.io/seminarioa/datamart-sis/api:latest` — FastAPI + uvicorn
- `postgres:16-alpine` — base de datos

**4. Abrir el dashboard**

```
http://localhost:8080
```

**5. Actualizar a la última versión**

```bash
docker compose -f docker-compose.simple.yml pull   # descarga imagen más reciente
docker compose -f docker-compose.simple.yml up -d  # reinicia con la nueva imagen
```

**6. Bajar los servicios**

```bash
docker compose -f docker-compose.simple.yml down      # conserva datos
docker compose -f docker-compose.simple.yml down -v   # elimina datos
```

---

### 💻 Método B — Desarrollo local

**1. Clonar el repositorio**

```bash
git clone https://github.com/seminarioA/datamart-sis.git
cd datamart-sis
```

**2. Levantar PostgreSQL**

```bash
cd docker && docker compose up -d
cd ..
```

**3. Crear entorno virtual e instalar dependencias**

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**4. Configurar variables de entorno**

```bash
cp .env.example .env
# Editar .env — DATABASE_URL apunta a localhost:5433 por defecto
```

**5. Levantar el servidor de desarrollo**

```bash
cd web
DATABASE_URL=postgresql://datamart:datamart2024@localhost:5433/datamart_sis \
  uvicorn app:app --reload --port 8080
```

**6. (Opcional) Ejecutar el pipeline ELT**

```bash
# Descargar datos desde el portal SIS
python download_sis_data.py

# Cargar un archivo específico (idempotente)
DATABASE_URL=... python elt_load.py --file OPENDATA_DS_01_2019_ATENCIONES_0.zip

# O vía Airflow (interfaz visual en http://localhost:8082)
# Ver docs/ELT.md para instrucciones completas
```

## Archivos disponibles en el portal SIS

| Archivo | Periodo | Tamaño aprox. |
|---------|---------|---------------|
| OPENDATA_DS_01_2017_ATENCIONES_0.zip | Ene–Dic 2017 | 92 MB |
| OPENDATA_DS_01_2018_ATENCIONES_0.zip | Ene–Dic 2018 | 94 MB |
| OPENDATA_DS_01_2019_ATENCIONES_0.zip | Ene–Dic 2019 | 97 MB |
| OPENDATA_DS_01_2020_ATENCIONES_0.zip | Ene–Dic 2020 | 55 MB |
| OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip | Ene–Jun 2021 | ~70 MB |
| OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip | Jul–Dic 2021 | ~70 MB |
| OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip | Ene–Jun 2022 | ~80 MB |
| OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip | Jul–Dic 2022 | ~80 MB |
| OPENDATA_DS_01_2023_ATENCIONES.zip | Ene–Dic 2023 | ~7 MB |
| OPENDATA_DS_01_2024_ATENCIONES.zip | Ene–Dic 2024 | ~7 MB |
| OPENDATA_DS_01_2025_07_12_ATENCIONES.zip | Jul–Dic 2025 | ~7 MB |
