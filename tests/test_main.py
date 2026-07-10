"""
test_main.py
============
Prueba de integración liviana del orquestador etl/main.py::run_full_pipeline.

extract / transform / load se mockean por completo (unittest.mock.patch)
para no tocar red ni BD real. Verifica:
  - El orden de llamadas es extract -> transform -> load.
  - Si extract no encuentra archivos, el pipeline aborta (sys.exit(1)) y
    nunca llega a transform/load.
  - Una excepción en transform (o load) NO queda silenciada: se propaga
    hacia afuera de run_full_pipeline en vez de ser atrapada y descartada.
  - `--dry-run` (dry_run=True) corre extract+transform pero nunca llama a
    load.run().

Ejecutar:
  python -m pytest tests/test_main.py -v
"""
import io
import sys
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl import main  # noqa: E402


def _fake_streams():
    return [("OPENDATA_DS_01_2023_ATENCIONES.zip", io.BytesIO(b"col1,col2\n1,2\n"))]


def _fake_tables():
    return {
        "dim_tiempo": pd.DataFrame({"ID_TIEMPO": [202301]}),
        "fact": pd.DataFrame({"CANTIDAD_ATENCIONES": [10]}),
    }


def test_pipeline_calls_extract_transform_load_in_order():
    order = []

    def fake_extract_run(years=None):
        order.append("extract")
        return _fake_streams()

    def fake_transform_run(streams):
        order.append("transform")
        assert len(streams) == 1  # recibió lo que devolvió extract.run()
        return _fake_tables()

    def fake_load_run(tables):
        order.append("load")
        assert set(tables.keys()) == {"dim_tiempo", "fact"}

    with patch("etl.main.extract.run", side_effect=fake_extract_run), \
         patch("etl.main.transform.run", side_effect=fake_transform_run), \
         patch("etl.main.load.run", side_effect=fake_load_run):
        main.run_full_pipeline(years=[2023], dry_run=False)

    assert order == ["extract", "transform", "load"]


def test_pipeline_aborts_when_extract_finds_no_files():
    with patch("etl.main.extract.run", return_value=[]) as mock_extract, \
         patch("etl.main.transform.run") as mock_transform, \
         patch("etl.main.load.run") as mock_load:
        with pytest.raises(SystemExit) as exc_info:
            main.run_full_pipeline(years=[2099], dry_run=False)

    assert exc_info.value.code == 1
    mock_extract.assert_called_once()
    mock_transform.assert_not_called()
    mock_load.assert_not_called()


def test_transform_exception_propagates_uncaught():
    """Una excepción en transform.run() no debe quedar silenciada: debe
    propagar fuera de run_full_pipeline (no hay try/except que la trague)."""
    def failing_transform_run(streams):
        raise ValueError("transform explotó")

    with patch("etl.main.extract.run", return_value=_fake_streams()), \
         patch("etl.main.transform.run", side_effect=failing_transform_run), \
         patch("etl.main.load.run") as mock_load:
        with pytest.raises(ValueError, match="transform explotó"):
            main.run_full_pipeline(years=[2023], dry_run=False)

    mock_load.assert_not_called()


def test_load_exception_propagates_uncaught():
    """Ídem para load.run(): un error de carga no debe silenciarse."""
    with patch("etl.main.extract.run", return_value=_fake_streams()), \
         patch("etl.main.transform.run", return_value=_fake_tables()), \
         patch("etl.main.load.run", side_effect=RuntimeError("carga falló")):
        with pytest.raises(RuntimeError, match="carga falló"):
            main.run_full_pipeline(years=[2023], dry_run=False)


def test_dry_run_never_calls_load():
    with patch("etl.main.extract.run", return_value=_fake_streams()), \
         patch("etl.main.transform.run", return_value=_fake_tables()), \
         patch("etl.main.load.run") as mock_load:
        main.run_full_pipeline(years=[2023], dry_run=True)

    mock_load.assert_not_called()
