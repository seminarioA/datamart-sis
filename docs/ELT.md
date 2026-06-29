# Pipeline ELT — DataMart SIS

## Flujo

```
Portal SIS (datosabiertos.gob.pe)
  → download_sis_data.py (descarga ZIPs)
  → data/raw/*.zip (14 archivos, ~1.5 GB comprimidos)
  → elt_load.py --file <nombre>.zip
      → extract_csv() → data/raw/_tmp/<nombre>.csv
      → load_file() → batches 500K filas
          → COPY stg_atenciones
          → fn_load_staging(p_fuente)  [SQL function en PostgreSQL]
              → tmp_norm (normalización)
              → INSERT dims (ON CONFLICT DO NOTHING)
              → INSERT fact_atenciones_sis
          → COMMIT por batch
      → DELETE tmp CSV
```

## Idempotencia

`elt_load.py --file X` verifica si el archivo ya fue cargado:
```python
SELECT COUNT(*) FROM fact_atenciones_sis WHERE fuente_archivo = 'X.zip'
```
Si > 0 → skip. Con `--force` → recarga.

## Archivos disponibles

| Archivo | Período | Tamaño ZIP | Filas ~|
|---------|---------|-----------|--------|
| OPENDATA_DS_01_2017_ATENCIONES_0.zip | 2017 | 93 MB | 7.1M |
| OPENDATA_DS_01_2018_ATENCIONES_0.zip | 2018 | 11 MB | 7.2M |
| OPENDATA_DS_01_2019_ATENCIONES_0.zip | 2019 | 98 MB | ~8M |
| OPENDATA_DS_01_2020_ATENCIONES_0.zip | 2020 | 56 MB | ~5M |
| OPENDATA_DS_01_2021_*.zip (x2) | H1+H2 2021 | ~50 MB c/u | ~5M c/u |
| OPENDATA_DS_01_2022_*.zip (x2) | H1+H2 2022 | ~130 MB c/u | ~8M c/u |
| OPENDATA_DS_01_2023_*.zip (x2) | H1+H2 2023 | ~148 MB c/u | ~9M c/u |
| OPENDATA_DS_01_2024_*.zip (x2) | H1+H2 2024 | ~158 MB c/u | ~10M c/u |
| OPENDATA_DS_01_2025_*.zip (x2) | H1+H2 2025 | ~167 MB c/u | ~10M c/u |

**Estado actual:** 2017 y 2018 cargados (14,354,543 filas). 2019 en proceso.

## Problema: CSV 2019 es 1.4 GB

El CSV descomprimido de 2019 es muy grande para el VPS de 1 GB RAM.
El proceso usa hasta 866 MB de swap. Tarda ~3-4 horas.

## Función SQL fn_load_staging

Normaliza y carga datos de `stg_atenciones` al esquema star.
Incluye COALESCE en todos los campos texto para manejar NULLs:
```sql
COALESCE(NULLIF(UPPER(TRIM(plan_seguro)), ''), 'SIN ESPECIFICAR') AS cod_plan_seguro
```
**Importante:** si se recrean las tablas, hay que re-ejecutar `sql/05_staging_and_elt.sql`.

## DAG de Airflow: elt_sis

- **Schedule:** Manual (no tiene cron)
- **Tasks:** verificar_entorno → [14 archivos secuenciales] → refresh_vistas_materializadas
- **timeout:** 8 horas por archivo
- **retries:** 1
- **Idempotente:** sí (skip si ya cargado)
