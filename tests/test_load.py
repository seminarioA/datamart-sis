"""
test_load.py
============
Pruebas unitarias del módulo de carga ETL (etl/load.py), en particular de la
idempotencia de `_insert_fact()`: correr el pipeline dos veces con el mismo
DataFrame (mismo FUENTE_ARCHIVO) no debe duplicar filas, porque antes de
insertar se borran las filas previas de esa(s) fuente(s).

No requiere una base de datos real: se usa un engine falso (fake) que
registra las llamadas a `execute()` y una lista Python que simula el
contenido de la tabla, y se mockea `pandas.DataFrame.to_sql` (el código real
usa sintaxis `ANY(:fuentes)` específica de PostgreSQL para el DELETE, que no
corre contra sqlite, así que un engine sqlite real no serviría aquí).

Ejecutar:
  python -m pytest tests/test_load.py -v
"""
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl import load  # noqa: E402


@pytest.fixture
def fake_fact_backend(monkeypatch):
    """Simula el backend de la tabla de hechos: una lista de dicts en memoria
    ("table_rows") más un registro ordenado de llamadas ("calls") para poder
    verificar que el DELETE ocurre antes que el INSERT/to_sql en cada corrida."""
    table_rows = []
    calls = []

    def fake_execute(stmt, params=None):
        sql_text = str(stmt)
        calls.append(("execute", sql_text, params))
        if "DELETE FROM" in sql_text and params and "fuentes" in params:
            fuentes = set(params["fuentes"])
            before = len(table_rows)
            table_rows[:] = [
                r for r in table_rows
                if r.get("FUENTE_ARCHIVO") not in fuentes
                and r.get("fuente_archivo") not in fuentes
            ]
            removed = before - len(table_rows)
            return SimpleNamespace(rowcount=removed)
        return SimpleNamespace(rowcount=0)

    fake_conn = SimpleNamespace(execute=fake_execute)

    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=fake_conn)
    ctx.__exit__ = MagicMock(return_value=False)

    engine = MagicMock()
    engine.begin.return_value = ctx

    def fake_to_sql(self, name, con, schema=None, if_exists="fail", index=True, method=None, **kwargs):
        calls.append(("to_sql", name, schema, len(self)))
        table_rows.extend(self.to_dict("records"))

    monkeypatch.setattr(pd.DataFrame, "to_sql", fake_to_sql)

    return SimpleNamespace(engine=engine, table_rows=table_rows, calls=calls)


def _sample_fact_df(fuente="OPENDATA_DS_01_2023_ATENCIONES.zip", n=3):
    return pd.DataFrame({
        "FUENTE_ARCHIVO": [fuente] * n,
        "CANTIDAD_ATENCIONES": list(range(1, n + 1)),
        "COD_SERVICIO": ["056"] * n,
    })


def test_insert_fact_twice_does_not_duplicate_rows(fake_fact_backend):
    df = _sample_fact_df(n=3)

    load._insert_fact(fake_fact_backend.engine, df, "FACT_ATENCIONES_SIS")
    assert len(fake_fact_backend.table_rows) == 3

    # Rerun del pipeline con exactamente los mismos datos (misma fuente).
    load._insert_fact(fake_fact_backend.engine, df, "FACT_ATENCIONES_SIS")

    assert len(fake_fact_backend.table_rows) == 3, (
        "El segundo _insert_fact() con la misma FUENTE_ARCHIVO duplicó filas: "
        "el borrado previo a la carga no está funcionando."
    )


def test_insert_fact_deletes_before_inserting_each_run(fake_fact_backend):
    df = _sample_fact_df(n=2)

    load._insert_fact(fake_fact_backend.engine, df, "FACT_ATENCIONES_SIS")
    load._insert_fact(fake_fact_backend.engine, df, "FACT_ATENCIONES_SIS")

    calls = fake_fact_backend.calls
    delete_idx = [i for i, c in enumerate(calls) if c[0] == "execute" and "DELETE FROM" in c[1]]
    to_sql_idx = [i for i, c in enumerate(calls) if c[0] == "to_sql"]

    assert len(delete_idx) == 2, "Se esperaba un DELETE por cada corrida de _insert_fact"
    assert len(to_sql_idx) == 2, "Se esperaba un to_sql (INSERT) por cada corrida"

    # En cada corrida, el DELETE debe preceder al to_sql correspondiente.
    assert delete_idx[0] < to_sql_idx[0]
    assert delete_idx[1] < to_sql_idx[1]


def test_insert_fact_different_sources_coexist(fake_fact_backend):
    """Cargar un archivo distinto no debe borrar los datos de otras fuentes."""
    df1 = _sample_fact_df(fuente="OPENDATA_DS_01_2023_ATENCIONES.zip", n=2)
    df2 = _sample_fact_df(fuente="OPENDATA_DS_01_2024_ATENCIONES.zip", n=4)

    load._insert_fact(fake_fact_backend.engine, df1, "FACT_ATENCIONES_SIS")
    load._insert_fact(fake_fact_backend.engine, df2, "FACT_ATENCIONES_SIS")

    assert len(fake_fact_backend.table_rows) == 6

    # Recargar 2023 (rerun) no debe afectar las filas de 2024.
    load._insert_fact(fake_fact_backend.engine, df1, "FACT_ATENCIONES_SIS")

    assert len(fake_fact_backend.table_rows) == 6
    fuentes_presentes = {r["FUENTE_ARCHIVO"] for r in fake_fact_backend.table_rows}
    assert fuentes_presentes == {
        "OPENDATA_DS_01_2023_ATENCIONES.zip",
        "OPENDATA_DS_01_2024_ATENCIONES.zip",
    }


def test_insert_fact_empty_dataframe_is_noop(fake_fact_backend):
    empty = pd.DataFrame(columns=["FUENTE_ARCHIVO", "CANTIDAD_ATENCIONES"])
    load._insert_fact(fake_fact_backend.engine, empty, "FACT_ATENCIONES_SIS")
    assert fake_fact_backend.table_rows == []
    assert fake_fact_backend.calls == []


def test_get_engine_raises_without_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(EnvironmentError):
        load.get_engine()
