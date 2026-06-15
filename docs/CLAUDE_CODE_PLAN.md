# Plan de ejecución — Claude Code
# DataMart SIS: Descarga + ETL + Carga a Supabase
# ============================================================
# Ejecutar desde la raíz del proyecto clonado:
#   git clone https://github.com/seminarioA/datamart-sis.git
#   cd datamart-sis
#   Pegar el contenido de este archivo como prompt en Claude Code
# ============================================================

## CONTEXTO

Estoy trabajando en un DataMart dimensional de atenciones de salud del SIS (Seguro Integral de Salud del Perú).

El repo ya existe: https://github.com/seminarioA/datamart-sis
Estructura: etl/ (extract.py, transform.py, load.py, main.py), sql/, tests/

Los datos vienen de: https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis
Son ZIPs de entre 92-172 MB cada uno. El WAF del portal bloquea User-Agents de servidores,
pero acepta headers de navegador Chrome (confirmado con prueba exitosa en 2017).

La BD destino es PostgreSQL en Supabase, org: otlypgkschhrgemgfuof
Necesito que crees el proyecto, apliques el schema y cargues los datos.

---

## PASO 1 — Setup

```bash
pip install pandas sqlalchemy psycopg2-binary python-dotenv requests tqdm loguru
```

---

## PASO 2 — Crear proyecto en Supabase

Usa el MCP de Supabase (que en Claude Code sí tiene acceso a tu cuenta):

1. Listar organizaciones disponibles
2. Crear proyecto "datamart-sis" en la org otlypgkschhrgemgfuof, región sa-east-1 (São Paulo, más cerca de Perú)
3. Esperar que el proyecto esté ACTIVE_HEALTHY
4. Obtener la connection string (URI de PostgreSQL)
5. Crear archivo .env con DATABASE_URL=<connection_string>

---

## PASO 3 — Aplicar schema SQL

```bash
# Ejecutar los 3 scripts DDL en orden:
psql $DATABASE_URL -f sql/01_create_schema.sql
psql $DATABASE_URL -f sql/02_create_tables.sql
psql $DATABASE_URL -f sql/03_indexes.sql
```

O usar el MCP de Supabase con apply_migration para cada archivo.

---

## PASO 4 — Descargar los archivos faltantes

El ETL busca ZIPs en data/raw/. Los que ya tenemos subidos al repo como artifacts NO están
(GitHub Actions no pudo descargar por bloqueo de IP).

Descargar con estos headers exactos (bypassean el WAF):

```python
import requests, os
from pathlib import Path

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
REF = "https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis"

HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
    "Referer": REF,
    "Connection": "keep-alive",
}

FILES = {
    "2018": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2018_ATENCIONES_0.zip",
    "2019": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2019_ATENCIONES_0.zip",
    "2020": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2020_ATENCIONES_0.zip",
    "2021s1": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip",
    "2021s2": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip",
    "2022s2": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip",
    "2023s2": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip",
    "2024s1": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2024_01_06_ATENCIONES.zip",
    "2024s2": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2024_07_12_ATENCIONES.zip",
    "2025s1": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2025_01_06_ATENCIONES.zip",
}

Path("data/raw").mkdir(parents=True, exist_ok=True)

for key, url in FILES.items():
    filename = url.split("/")[-1]
    dest = Path("data/raw") / filename
    if dest.exists() and dest.stat().st_size > 10_000_000:
        print(f"Ya existe: {filename} ({dest.stat().st_size/1e6:.0f} MB)")
        continue
    print(f"Descargando {key}...")
    with requests.get(url, headers=HEADERS, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024*1024):
                f.write(chunk)
    size_mb = dest.stat().st_size / 1e6
    print(f"  OK: {filename} ({size_mb:.0f} MB)")
```

NOTA: Los que ya tenemos (copiarlos a data/raw/ si los tienes localmente):
- OPENDATA_DS_01_2017_ATENCIONES_0.zip
- OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip
- OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip
- OPENDATA_DS_01_2025_07_12_ATENCIONES.zip

---

## PASO 5 — Ejecutar ETL completo

El ETL procesa en chunks de 50k filas para no explotar la RAM con los CSVs de 1+ GB.
Actualizar transform.py para usar chunksize:

```python
# En transform.py, cambiar _read_csv para usar chunks:
def _read_csv_chunked(stream, source_name, chunksize=50000):
    stream.seek(0)
    chunks = []
    for enc in ["utf-8", "latin-1"]:
        try:
            stream.seek(0)
            reader = pd.read_csv(stream, encoding=enc, chunksize=chunksize, low_memory=False)
            for chunk in reader:
                chunks.append(chunk)
            df = pd.concat(chunks, ignore_index=True)
            logger.info(f"{source_name}: {len(df):,} filas (encoding={enc})")
            return df
        except UnicodeDecodeError:
            chunks = []
            continue
    raise ValueError(f"No se pudo decodificar {source_name}")
```

Ejecutar:
```bash
python etl/main.py --step all
```

O si la RAM es limitada, archivo por archivo:
```bash
for zip in data/raw/*.zip; do
    python etl/main.py --step all  # el ETL procesa todos los ZIPs de data/raw/
done
```

---

## PASO 6 — Verificar carga

```bash
psql $DATABASE_URL -c "
SELECT tabla, COUNT(*) as registros FROM (
  SELECT 'FACT' as tabla FROM datamart_sis.fact_atenciones_sis
  UNION ALL SELECT 'DIM_TIEMPO' FROM datamart_sis.dim_tiempo
  UNION ALL SELECT 'DIM_UBICACION' FROM datamart_sis.dim_ubicacion
) t GROUP BY tabla;
"

psql $DATABASE_URL -c "
SELECT SUM(cantidad_atenciones) as total_atenciones
FROM datamart_sis.fact_atenciones_sis;
"
```

---

## PASO 7 — Tomar capturas para el informe

Con el proyecto activo en Supabase Dashboard, tomar screenshots de:
1. Table Editor → cada tabla dimension con sus datos
2. SQL Editor → ejecutar sql/04_validaciones.sql y capturar resultados
3. Dashboard principal mostrando el proyecto activo

---

## NOTAS TÉCNICAS

- La estructura real del CSV NO tiene: COD_DIAGNOSTICO, MONTO_PRESTACION, EDAD exacta, ID_ATENCION
- Los datos son AGREGADOS: cada fila = combinación única de dimensiones con suma de ATENCIONES
- El modelo del Avance 1 fue ajustado en el Avance 2 para reflejar los datos reales
- Total estimado de filas en FACT con todos los archivos: ~50-60 millones de registros
- Usar BATCH_SIZE=5000 en .env para la carga (ajustar según RAM disponible)
