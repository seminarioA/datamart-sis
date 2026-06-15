"""
load.py
=======
Carga de los DataFrames transformados a PostgreSQL (Supabase).
Usa SQLAlchemy + psycopg2. Carga en lotes (batch) para eficiencia.

Orden de carga (respeta FK constraints):
  1. Dimensiones (sin dependencias entre sí)
  2. FACT_ATENCIONES_SIS (depende de todas las dimensiones)
"""

import os
import logging
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

SCHEMA = os.getenv("DB_SCHEMA", "datamart_sis")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "5000"))

# Mapeo: nombre interno → (tabla PostgreSQL, clave primaria para upsert)
TABLE_MAP = {
    "dim_tiempo":       ("DIM_TIEMPO",       "ID_TIEMPO"),
    "dim_ubicacion":    ("DIM_UBICACION",    "COD_UBIGEO"),
    "dim_ipress":       ("DIM_IPRESS",       "COD_IPRESS"),
    "dim_nivel_ipress": ("DIM_NIVEL_IPRESS", "NIVEL_EESS"),
    "dim_plan_seguro":  ("DIM_PLAN_SEGURO",  "COD_PLAN_SEGURO"),
    "dim_servicio":     ("DIM_SERVICIO",     "COD_SERVICIO"),
    "dim_sexo":         ("DIM_SEXO",         "SEXO"),
    "dim_grupo_edad":   ("DIM_GRUPO_EDAD",   "GRUPO_EDAD"),
    "fact":             ("FACT_ATENCIONES_SIS", None),  # BIGSERIAL, no upsert
}

LOAD_ORDER = [
    "dim_tiempo", "dim_ubicacion", "dim_ipress", "dim_nivel_ipress",
    "dim_plan_seguro", "dim_servicio", "dim_sexo", "dim_grupo_edad",
    "fact"
]


def get_engine():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise EnvironmentError(
            "DATABASE_URL no está definida. "
            "Copia .env.example como .env y completa la connection string de Supabase."
        )
    engine = create_engine(url, pool_pre_ping=True)
    logger.info("Conexión a PostgreSQL establecida.")
    return engine


def _upsert_dimension(engine, df: pd.DataFrame, table: str, pk: str):
    """
    Upsert para tablas dimensionales.
    Inserta filas nuevas; si la PK ya existe, actualiza las columnas restantes.
    """
    if df.empty:
        logger.warning(f"{table}: DataFrame vacío, saltando.")
        return

    qualified = f"{SCHEMA}.{table}"
    cols = list(df.columns)
    non_pk_cols = [c for c in cols if c != pk]

    # Construir SQL de upsert (INSERT ... ON CONFLICT DO UPDATE)
    col_list     = ", ".join(f'"{c}"' for c in cols)
    placeholder  = ", ".join(f":{c}" for c in cols)
    update_set   = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in non_pk_cols)

    sql = text(f"""
        INSERT INTO {qualified} ({col_list})
        VALUES ({placeholder})
        ON CONFLICT ("{pk}") DO UPDATE SET {update_set}
    """)

    records = df.where(pd.notna(df), None).to_dict(orient="records")
    inserted = 0

    with engine.begin() as conn:
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i:i + BATCH_SIZE]
            conn.execute(sql, batch)
            inserted += len(batch)

    logger.info(f"{table}: {inserted} registros insertados/actualizados")


def _insert_fact(engine, df: pd.DataFrame, table: str):
    """
    Carga la tabla de hechos en batches usando pandas to_sql.
    Usa 'append' porque la PK es BIGSERIAL auto-incremental.
    """
    if df.empty:
        logger.warning(f"{table}: DataFrame de hechos vacío.")
        return

    qualified = f"{SCHEMA}.{table}".lower()
    total = len(df)
    loaded = 0

    # Nombre de tabla en minúsculas para pandas (PostgreSQL es case-insensitive)
    for i in range(0, total, BATCH_SIZE):
        chunk = df.iloc[i:i + BATCH_SIZE]
        chunk.to_sql(
            name=table.lower(),
            schema=SCHEMA.lower(),
            con=engine,
            if_exists="append",
            index=False,
            method="multi"
        )
        loaded += len(chunk)
        logger.info(f"{table}: {loaded:,}/{total:,} filas cargadas")

    logger.info(f"{table}: carga completa — {total:,} registros")


def run(tables: dict):
    """
    Recibe el dict de DataFrames del módulo transform y los carga a PostgreSQL.
    """
    engine = get_engine()

    # Verificar que el schema existe
    with engine.begin() as conn:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        logger.info(f"Schema '{SCHEMA}' verificado.")

    for key in LOAD_ORDER:
        if key not in tables:
            logger.warning(f"'{key}' no está en los datos transformados, saltando.")
            continue

        df = tables[key]
        table_name, pk = TABLE_MAP[key]

        logger.info(f"Cargando {table_name} ({len(df):,} registros)...")

        try:
            if key == "fact":
                _insert_fact(engine, df, table_name)
            else:
                _upsert_dimension(engine, df, table_name, pk)
        except SQLAlchemyError as e:
            logger.error(f"Error cargando {table_name}: {e}")
            raise

    logger.info("Carga completa exitosamente.")


if __name__ == "__main__":
    import sys, json
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")

    # Verificar conexión
    try:
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            print(f"Conectado: {result.fetchone()[0][:60]}")
    except Exception as e:
        print(f"Error de conexión: {e}")
        sys.exit(1)
