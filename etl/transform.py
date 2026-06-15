"""
transform.py
============
Transformación y limpieza de los datos del SIS.

Estructura real del CSV fuente (confirmada inspeccionando los archivos):
  AÑO, MES, REGION, PROVINCIA, UBIGEO_DISTRITO, DISTRITO,
  COD_UNIDAD_EJECUTORA, DESC_UNIDAD_EJECUTORA, COD_IPRESS, IPRESS,
  NIVEL_EESS, PLAN_SEGURO, COD_SERVICIO, DESC_SERVICIO,
  SEXO, GRUPO_EDAD, ATENCIONES

Los datos son agregados: cada fila es una combinación única de dimensiones
con el total de atenciones del período (AÑO+MES).
"""

import io
import re
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# ─── Mapas de normalización ───────────────────────────────────────────────────

MESES = {
    1: "ENERO", 2: "FEBRERO", 3: "MARZO", 4: "ABRIL",
    5: "MAYO", 6: "JUNIO", 7: "JULIO", 8: "AGOSTO",
    9: "SEPTIEMBRE", 10: "OCTUBRE", 11: "NOVIEMBRE", 12: "DICIEMBRE"
}

GRUPO_EDAD_META = {
    "00 - 04 AÑOS": {"min": 0,  "max": 4,  "etapa": "NIÑO"},
    "05 - 11 AÑOS": {"min": 5,  "max": 11, "etapa": "NIÑO"},
    "12 - 17 AÑOS": {"min": 12, "max": 17, "etapa": "ADOLESCENTE"},
    "18 - 29 AÑOS": {"min": 18, "max": 29, "etapa": "JOVEN"},
    "30 - 59 AÑOS": {"min": 30, "max": 59, "etapa": "ADULTO"},
    "60 - MAS AÑOS": {"min": 60, "max": 120, "etapa": "ADULTO MAYOR"},
}

NIVEL_IPRESS_META = {
    "I":   {"desc": "PRIMER NIVEL DE ATENCIÓN",  "categoria": "PRIMER NIVEL"},
    "II":  {"desc": "SEGUNDO NIVEL DE ATENCIÓN", "categoria": "SEGUNDO NIVEL"},
    "III": {"desc": "TERCER NIVEL DE ATENCIÓN",  "categoria": "TERCER NIVEL"},
    "0":   {"desc": "SIN NIVEL ASIGNADO",         "categoria": "NO APLICA"},
}

PLAN_SEGURO_META = {
    "SIS GRATUITO":      {"desc": "SIS GRATUITO",      "regimen": "SUBSIDIADO"},
    "SIS PARA TODOS":    {"desc": "SIS PARA TODOS",    "regimen": "SUBSIDIADO"},
    "SIS INDEPENDIENTE": {"desc": "SIS INDEPENDIENTE", "regimen": "CONTRIBUTIVO"},
    "SIS EMPRENDEDOR":   {"desc": "SIS EMPRENDEDOR",   "regimen": "SEMICONTRIBUTIVO"},
    "SIS MICROEMPRESA":  {"desc": "SIS MICROEMPRESA",  "regimen": "SEMICONTRIBUTIVO"},
}

SEXO_META = {
    "MASCULINO": "MASCULINO",
    "FEMENINO":  "FEMENINO",
}

# ─── Funciones auxiliares ─────────────────────────────────────────────────────

def _read_csv(stream: io.BytesIO, source_name: str) -> pd.DataFrame:
    """Lee el CSV del SIS desde un BytesIO, manejando encoding."""
    stream.seek(0)
    for enc in ["utf-8", "latin-1", "cp1252"]:
        try:
            stream.seek(0)
            df = pd.read_csv(stream, encoding=enc, low_memory=False)
            logger.info(f"{source_name}: {len(df):,} filas leídas (encoding={enc})")
            return df
        except UnicodeDecodeError:
            continue
    raise ValueError(f"No se pudo decodificar {source_name}")


def _clean_raw(df: pd.DataFrame, source_name: str) -> pd.DataFrame:
    """Limpieza general del DataFrame crudo."""
    original_len = len(df)

    # Normalizar nombres de columnas
    # IMPORTANTE: reemplazar "AÑO" → "ANIO" ANTES de quitar la Ñ genérica
    df.columns = [
        c.strip().upper().replace("AÑO", "ANIO").replace("Ñ", "N")
        for c in df.columns
    ]

    # Renombrar variantes con encoding roto
    df = df.rename(columns={"AÃO": "ANIO", "ANO": "ANIO"})

    # Eliminar filas donde ATENCIONES es nulo o no numérico
    df["ATENCIONES"] = pd.to_numeric(df["ATENCIONES"], errors="coerce")
    df = df.dropna(subset=["ATENCIONES"])
    df["ATENCIONES"] = df["ATENCIONES"].astype(int)
    df = df[df["ATENCIONES"] > 0]

    # Limpiar strings: strip, upper
    str_cols = ["REGION", "PROVINCIA", "DISTRITO", "IPRESS", "DESC_UNIDAD_EJECUTORA",
                "DESC_SERVICIO", "SEXO", "GRUPO_EDAD", "PLAN_SEGURO", "NIVEL_EESS"]
    for col in str_cols:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip().str.upper()

    # Normalizar UBIGEO a 6 dígitos con cero a la izquierda
    df["UBIGEO_DISTRITO"] = (
        df["UBIGEO_DISTRITO"].astype(str).str.zfill(6)
    )

    # COD_IPRESS: strip y uppercase
    df["COD_IPRESS"] = df["COD_IPRESS"].astype(str).str.strip().str.zfill(10)

    # COD_SERVICIO: strip
    df["COD_SERVICIO"] = df["COD_SERVICIO"].astype(str).str.strip().str.zfill(3)

    # COD_UNIDAD_EJECUTORA
    df["COD_UNIDAD_EJECUTORA"] = df["COD_UNIDAD_EJECUTORA"].astype(str).str.strip()

    # Filtrar NIVEL_EESS inválido → conservar I, II, III (algunos tienen "0")
    df["NIVEL_EESS"] = df["NIVEL_EESS"].str.strip()
    df["NIVEL_EESS"] = df["NIVEL_EESS"].replace({"0": "0"})  # mantener para mapear

    dropped = original_len - len(df)
    if dropped:
        logger.info(f"{source_name}: {dropped} filas eliminadas en limpieza")

    return df


# ─── Constructores de tablas dimensionales ───────────────────────────────────

def build_dim_tiempo(df: pd.DataFrame) -> pd.DataFrame:
    """Construye DIM_TIEMPO a partir de los pares AÑO-MES del dataset."""
    periodos = df[["ANIO", "MES"]].drop_duplicates().copy()
    periodos["ID_TIEMPO"]       = periodos["ANIO"] * 100 + periodos["MES"]
    periodos["DESC_MES"]        = periodos["MES"].map(MESES)
    periodos["TRIMESTRE"]       = ((periodos["MES"] - 1) // 3 + 1).astype(int)
    periodos["SEMESTRE"]        = ((periodos["MES"] - 1) // 6 + 1).astype(int)
    periodos["NOMBRE_SEMESTRE"] = periodos["SEMESTRE"].map({1: "PRIMER SEMESTRE", 2: "SEGUNDO SEMESTRE"})
    periodos["DESC_TRIMESTRE"]  = periodos["TRIMESTRE"].map({
        1: "PRIMER TRIMESTRE", 2: "SEGUNDO TRIMESTRE",
        3: "TERCER TRIMESTRE", 4: "CUARTO TRIMESTRE"
    })
    return periodos.sort_values("ID_TIEMPO").reset_index(drop=True)


def build_dim_ubicacion(df: pd.DataFrame) -> pd.DataFrame:
    """Construye DIM_UBICACION desde los campos geográficos del CSV."""
    geo = df[["UBIGEO_DISTRITO", "DISTRITO", "PROVINCIA", "REGION"]].drop_duplicates()
    geo = geo.rename(columns={"UBIGEO_DISTRITO": "COD_UBIGEO"})
    geo["COD_PROVINCIA"] = geo["COD_UBIGEO"].str[:4]
    geo["COD_REGION"]    = geo["COD_UBIGEO"].str[:2]
    return geo.reset_index(drop=True)


def build_dim_ipress(df: pd.DataFrame) -> pd.DataFrame:
    """Construye DIM_IPRESS con el catálogo de establecimientos."""
    ipress = df[[
        "COD_IPRESS", "IPRESS", "COD_UNIDAD_EJECUTORA", "DESC_UNIDAD_EJECUTORA"
    ]].drop_duplicates(subset=["COD_IPRESS"])
    ipress = ipress.rename(columns={
        "IPRESS": "NOMBRE_IPRESS",
        "COD_UNIDAD_EJECUTORA": "COD_UNIDAD_EJECUTORA",
        "DESC_UNIDAD_EJECUTORA": "DESC_UNIDAD_EJECUTORA"
    })
    return ipress.reset_index(drop=True)


def build_dim_nivel_ipress() -> pd.DataFrame:
    """Construye DIM_NIVEL_IPRESS desde el mapa estático."""
    rows = []
    for nivel, meta in NIVEL_IPRESS_META.items():
        rows.append({
            "NIVEL_EESS":       nivel,
            "DESC_NIVEL_EESS":  meta["desc"],
            "CATEGORIA_ATENCION": meta["categoria"]
        })
    return pd.DataFrame(rows)


def build_dim_plan_seguro(df: pd.DataFrame) -> pd.DataFrame:
    """Construye DIM_PLAN_SEGURO desde los valores únicos del CSV."""
    planes = df[["PLAN_SEGURO"]].drop_duplicates().copy()
    planes = planes.rename(columns={"PLAN_SEGURO": "COD_PLAN_SEGURO"})
    planes["DESC_PLAN_SEGURO"] = planes["COD_PLAN_SEGURO"].map(
        lambda x: PLAN_SEGURO_META.get(x, {}).get("desc", x)
    )
    planes["REGIMEN_FINANCIAMIENTO"] = planes["COD_PLAN_SEGURO"].map(
        lambda x: PLAN_SEGURO_META.get(x, {}).get("regimen", "OTRO")
    )
    return planes.reset_index(drop=True)


def build_dim_servicio(df: pd.DataFrame) -> pd.DataFrame:
    """Construye DIM_SERVICIO desde el catálogo de servicios del CSV."""
    srv = df[["COD_SERVICIO", "DESC_SERVICIO"]].drop_duplicates(subset=["COD_SERVICIO"])
    return srv.reset_index(drop=True)


def build_dim_sexo() -> pd.DataFrame:
    return pd.DataFrame([
        {"SEXO": "MASCULINO", "DESC_SEXO": "MASCULINO"},
        {"SEXO": "FEMENINO",  "DESC_SEXO": "FEMENINO"},
    ])


def build_dim_grupo_edad() -> pd.DataFrame:
    rows = []
    for grupo, meta in GRUPO_EDAD_META.items():
        rows.append({
            "GRUPO_EDAD": grupo,
            "EDAD_MIN":   meta["min"],
            "EDAD_MAX":   meta["max"],
            "ETAPA_VIDA": meta["etapa"]
        })
    return pd.DataFrame(rows)


# ─── Constructor de tabla de hechos ──────────────────────────────────────────

def build_fact(df: pd.DataFrame, source_name: str) -> pd.DataFrame:
    """Construye la tabla de hechos con claves foráneas y medidas."""
    fact = df[[
        "ANIO", "MES",
        "UBIGEO_DISTRITO",
        "COD_IPRESS",
        "NIVEL_EESS",
        "PLAN_SEGURO",
        "COD_SERVICIO",
        "SEXO",
        "GRUPO_EDAD",
        "ATENCIONES"
    ]].copy()

    fact["ID_TIEMPO"]        = fact["ANIO"] * 100 + fact["MES"]
    fact["COD_UBIGEO"]       = fact["UBIGEO_DISTRITO"]
    fact["COD_PLAN_SEGURO"]  = fact["PLAN_SEGURO"]
    fact["CANTIDAD_ATENCIONES"] = fact["ATENCIONES"]
    fact["FUENTE_ARCHIVO"]   = source_name

    fact = fact[[
        "ID_TIEMPO", "COD_UBIGEO", "COD_IPRESS", "NIVEL_EESS",
        "COD_PLAN_SEGURO", "COD_SERVICIO", "SEXO", "GRUPO_EDAD",
        "CANTIDAD_ATENCIONES", "FUENTE_ARCHIVO"
    ]]

    return fact.reset_index(drop=True)


# ─── Función principal ────────────────────────────────────────────────────────

def run(streams: list) -> dict:
    """
    Recibe lista de (nombre, BytesIO) del módulo extract.
    Devuelve dict con DataFrames listos para cargar:
      {
        'dim_tiempo', 'dim_ubicacion', 'dim_ipress', 'dim_nivel_ipress',
        'dim_plan_seguro', 'dim_servicio', 'dim_sexo', 'dim_grupo_edad',
        'fact'
      }
    """
    all_dfs = []

    for source_name, stream in streams:
        logger.info(f"Transformando: {source_name}")
        raw = _read_csv(stream, source_name)
        cleaned = _clean_raw(raw, source_name)
        all_dfs.append((source_name, cleaned))

    if not all_dfs:
        raise ValueError("No hay datos para transformar.")

    # Concatenar todos los años
    combined = pd.concat([df for _, df in all_dfs], ignore_index=True)
    logger.info(f"Total combinado: {len(combined):,} filas de {len(all_dfs)} archivo(s)")

    # Construir dimensiones (catálogos únicos del dataset completo)
    result = {
        "dim_tiempo":       build_dim_tiempo(combined),
        "dim_ubicacion":    build_dim_ubicacion(combined),
        "dim_ipress":       build_dim_ipress(combined),
        "dim_nivel_ipress": build_dim_nivel_ipress(),
        "dim_plan_seguro":  build_dim_plan_seguro(combined),
        "dim_servicio":     build_dim_servicio(combined),
        "dim_sexo":         build_dim_sexo(),
        "dim_grupo_edad":   build_dim_grupo_edad(),
    }

    # Construir tabla de hechos por archivo (para trazabilidad)
    facts = []
    for source_name, df in all_dfs:
        facts.append(build_fact(df, source_name))
    result["fact"] = pd.concat(facts, ignore_index=True)

    # Log resumen
    for name, df in result.items():
        logger.info(f"  {name}: {len(df):,} registros")

    return result


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

    # Test rápido con un archivo local
    if len(sys.argv) > 1:
        zip_path = sys.argv[1]
        import zipfile, io
        with zipfile.ZipFile(zip_path) as z:
            csv_name = [n for n in z.namelist() if n.endswith(".csv")][0]
            buf = io.BytesIO(z.read(csv_name))
        tables = run([(zip_path, buf)])
        for name, df in tables.items():
            print(f"\n{name.upper()} — {len(df)} filas")
            print(df.head(3).to_string())
