# DataMart de Atenciones de Salud — SIS

DataMart dimensional construido sobre datos abiertos del Seguro Integral de Salud (SIS) del Perú, disponibles en la [Plataforma Nacional de Datos Abiertos](https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis).

> **Dashboard:** desplegado en `http://170.9.4.149:8080` (VPS Oracle Cloud)

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

```
                    DIM_TIEMPO
                        |
DIM_UBICACION ——— FACT_ATENCIONES_SIS ——— DIM_SERVICIO
                        |
        DIM_PLAN_SEGURO | DIM_NIVEL_IPRESS
                        |
              DIM_SEXO  |  DIM_GRUPO_EDAD
```

**Tabla de hechos:** `FACT_ATENCIONES_SIS`  
**Medidas:** `CANTIDAD_ATENCIONES` (suma de atenciones)  
**Granularidad:** Una fila = combinación única de (año, mes, región, provincia, distrito, IPRESS, nivel, plan seguro, servicio, sexo, grupo edad)

## Instalación y uso

### 1. Clonar el repositorio

```bash
git clone https://github.com/seminarioA/datamart-sis.git
cd datamart-sis
```

### 2. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tu connection string de Supabase
```

### 4. Ejecutar el pipeline ETL completo

```bash
python etl/main.py --years 2017 2018 2019 2020 2021 2022 2023 2024 2025
```

### 5. Ejecutar solo una etapa

```bash
python etl/main.py --step extract --years 2023 2024
python etl/main.py --step transform
python etl/main.py --step load
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
