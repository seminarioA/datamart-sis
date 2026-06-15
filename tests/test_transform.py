"""
test_transform.py
=================
Pruebas unitarias del módulo de transformación ETL.

Ejecutar:
  python -m pytest tests/ -v
"""

import io
import sys
import pandas as pd
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl.transform import (
    _clean_raw, build_dim_tiempo, build_dim_ubicacion,
    build_dim_ipress, build_dim_nivel_ipress,
    build_dim_plan_seguro, build_dim_servicio,
    build_dim_sexo, build_dim_grupo_edad, build_fact
)

# ─── Fixture: DataFrame mínimo que simula el CSV real del SIS ────────────────

@pytest.fixture
def sample_df():
    data = {
        "ANIO": [2023, 2023, 2024],
        "MES":  [1, 6, 3],
        "REGION":    ["PIURA", "LIMA METROPOLITANA", "CAJAMARCA"],
        "PROVINCIA": ["PIURA", "LIMA", "CAJAMARCA"],
        "UBIGEO_DISTRITO": ["200101", "150101", "060101"],
        "DISTRITO":  ["PIURA", "LIMA", "CAJAMARCA"],
        "COD_UNIDAD_EJECUTORA": ["1015", "1684", "0788"],
        "DESC_UNIDAD_EJECUTORA": ["REGION PIURA", "DIRIS LIMA NORTE", "REGION CAJAMARCA"],
        "COD_IPRESS": ["0001234567", "0009876543", "0005551234"],
        "IPRESS":    ["HOSPITAL III JOSE CAYETANO HEREDIA", "C.S. LOS LIBERTADORES", "HOSPITAL II CAJAMARCA"],
        "NIVEL_EESS": ["I", "II", "III"],
        "PLAN_SEGURO": ["SIS GRATUITO", "SIS PARA TODOS", "SIS GRATUITO"],
        "COD_SERVICIO": ["056", "001", "071"],
        "DESC_SERVICIO": ["CONSULTA EXTERNA", "CONTROL CRED", "APOYO AL DIAGNOSTICO"],
        "SEXO":      ["FEMENINO", "MASCULINO", "FEMENINO"],
        "GRUPO_EDAD": ["18 - 29 AÑOS", "00 - 04 AÑOS", "60 - MAS AÑOS"],
        "ATENCIONES": [150, 80, 45],
    }
    return pd.DataFrame(data)


# ─── Tests de limpieza ────────────────────────────────────────────────────────

def test_clean_removes_zero_atenciones(sample_df):
    sample_df.loc[0, "ATENCIONES"] = 0
    cleaned = _clean_raw(sample_df.copy(), "test")
    assert 0 not in cleaned["ATENCIONES"].values


def test_clean_removes_null_atenciones(sample_df):
    sample_df.loc[1, "ATENCIONES"] = None
    cleaned = _clean_raw(sample_df.copy(), "test")
    assert cleaned["ATENCIONES"].isna().sum() == 0


def test_clean_ubigeo_zfill(sample_df):
    sample_df.loc[0, "UBIGEO_DISTRITO"] = "10101"  # 5 dígitos
    cleaned = _clean_raw(sample_df.copy(), "test")
    assert cleaned.loc[0, "UBIGEO_DISTRITO"] == "010101"


# ─── Tests de dimensiones ─────────────────────────────────────────────────────

def test_dim_tiempo_id_format(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    dim = build_dim_tiempo(cleaned)
    assert set(dim["ID_TIEMPO"]) == {202301, 202306, 202403}


def test_dim_tiempo_semestre(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    dim = build_dim_tiempo(cleaned)
    row = dim[dim["MES"] == 6].iloc[0]
    assert row["SEMESTRE"] == 1
    row2 = dim[dim["MES"] == 1].iloc[0]
    assert row2["SEMESTRE"] == 1


def test_dim_ubicacion_cod_region(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    dim = build_dim_ubicacion(cleaned)
    piura_row = dim[dim["DISTRITO"] == "PIURA"]
    assert not piura_row.empty
    assert piura_row.iloc[0]["COD_REGION"] == "20"


def test_dim_ipress_unique_per_cod(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    dim = build_dim_ipress(cleaned)
    assert dim["COD_IPRESS"].nunique() == len(dim)


def test_dim_nivel_ipress_all_levels():
    dim = build_dim_nivel_ipress()
    niveles = set(dim["NIVEL_EESS"].tolist())
    assert "I" in niveles
    assert "II" in niveles
    assert "III" in niveles


def test_dim_plan_seguro_regimen(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    dim = build_dim_plan_seguro(cleaned)
    gratuito = dim[dim["COD_PLAN_SEGURO"] == "SIS GRATUITO"]
    assert not gratuito.empty
    assert gratuito.iloc[0]["REGIMEN_FINANCIAMIENTO"] == "SUBSIDIADO"


def test_dim_sexo_values():
    dim = build_dim_sexo()
    assert set(dim["SEXO"]) == {"MASCULINO", "FEMENINO"}


def test_dim_grupo_edad_count():
    dim = build_dim_grupo_edad()
    assert len(dim) == 6  # 6 grupos definidos por el SIS


# ─── Tests de tabla de hechos ─────────────────────────────────────────────────

def test_fact_id_tiempo(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    fact = build_fact(cleaned, "test_file.zip")
    assert set(fact["ID_TIEMPO"]) == {202301, 202306, 202403}


def test_fact_cantidad_atenciones_positive(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    fact = build_fact(cleaned, "test_file.zip")
    assert (fact["CANTIDAD_ATENCIONES"] > 0).all()


def test_fact_fuente_archivo(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    fact = build_fact(cleaned, "OPENDATA_DS_01_2023.zip")
    assert (fact["FUENTE_ARCHIVO"] == "OPENDATA_DS_01_2023.zip").all()


def test_fact_total_atenciones(sample_df):
    cleaned = _clean_raw(sample_df.copy(), "test")
    fact = build_fact(cleaned, "test")
    assert fact["CANTIDAD_ATENCIONES"].sum() == 275  # 150+80+45
