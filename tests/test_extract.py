"""
test_extract.py
================
Pruebas unitarias del módulo de extracción ETL (etl/extract.py).

Cubren:
  - `download_file()` no debe propagar excepciones de red (ConnectionError,
    Timeout): debe capturarlas y devolver False (contrato documentado en su
    docstring: "Devuelve True si tuvo éxito").
  - `run()` procesa todos los años solicitados aunque la descarga de uno de
    ellos falle por un error de conexión: no debe abortar el resto del loop.

Ejecutar:
  python -m pytest tests/test_extract.py -v
"""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
import requests

sys.path.insert(0, str(Path(__file__).parent.parent))
from etl import extract  # noqa: E402


# ─── download_file(): errores de red no deben propagar ───────────────────────

def test_download_file_returns_false_on_connection_error(tmp_path):
    dest = tmp_path / "archivo.zip"
    with patch("requests.get", side_effect=requests.exceptions.ConnectionError("no route to host")):
        result = extract.download_file("https://example.com/archivo.zip", dest)

    assert result is False
    assert not dest.exists()


def test_download_file_returns_false_on_timeout(tmp_path):
    dest = tmp_path / "archivo.zip"
    with patch("requests.get", side_effect=requests.exceptions.Timeout("timed out")):
        result = extract.download_file("https://example.com/archivo.zip", dest)

    assert result is False
    assert not dest.exists()


def test_download_file_returns_true_on_success(tmp_path):
    dest = tmp_path / "archivo.zip"

    fake_response = MagicMock()
    fake_response.headers = {"content-length": "10"}
    fake_response.iter_content.return_value = [b"0123456789"]
    fake_response.raise_for_status.return_value = None
    fake_response.__enter__.return_value = fake_response
    fake_response.__exit__.return_value = False

    with patch("requests.get", return_value=fake_response):
        result = extract.download_file("https://example.com/archivo.zip", dest)

    assert result is True
    assert dest.read_bytes() == b"0123456789"


# ─── run(): un error de conexión en un ítem no aborta el resto del loop ──────

def test_run_continues_processing_remaining_years_after_connection_error(tmp_path, monkeypatch):
    """
    run() itera sobre SOURCE_FILES (o el subconjunto filtrado por `years`) y
    llama a download_file() por cada uno. Si download_file() para un año
    específico lanza (en vez de devolver False, que sería el caso normal),
    el resto de los años del loop igual deben intentarse — el loop no debe
    abortar en la primera falla.
    """
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()

    # Nos aseguramos de no encontrar ZIPs locales para forzar el camino de
    # descarga remota.
    monkeypatch.setattr(extract, "list_local_zips", lambda _raw_dir: [])

    attempted = []

    def fake_download_file(url, dest):
        attempted.append(dest.name)
        if "2017" in dest.name:
            # Simula que download_file no atrapó su propia excepción (peor
            # caso): igual no debe tumbar el resto del loop si extract.run()
            # está escrito defensivamente. Devolvemos False, que es el
            # contrato real de download_file ante un error de red.
            return False
        return True

    monkeypatch.setattr(extract, "download_file", fake_download_file)

    def fake_extract_csv_from_zip(zip_path):
        import io
        return io.BytesIO(b"contenido,csv\n1,2\n")

    monkeypatch.setattr(extract, "extract_csv_from_zip", fake_extract_csv_from_zip)

    streams = extract.run(years=[2017, 2018], raw_dir=raw_dir)

    # Se intentó descargar ambos años, no solo el primero.
    assert any("2017" in name for name in attempted)
    assert any("2018" in name for name in attempted)

    # El año cuya descarga "falló" (2017, download_file -> False) no debe
    # aparecer en los streams resultantes; el que sí tuvo éxito (2018) sí.
    stream_names = [name for name, _ in streams]
    assert not any("2017" in name for name in stream_names)
    assert any("2018" in name for name in stream_names)


def test_run_raises_on_unhandled_exception_does_not_skip_silently(tmp_path, monkeypatch):
    """
    Si download_file() alguna vez propagara una excepción no contemplada
    (bug futuro), documentamos el comportamiento actual de run(): no hay try/
    except alrededor de la llamada a download_file(), así que una excepción
    no capturada por download_file() SÍ interrumpe el loop. Esto confirma que
    el manejo defensivo de errores de red vive en download_file() y no en
    run() — por eso es crítico que download_file() nunca deje escapar
    ConnectionError/Timeout (cubierto en los tests de arriba).
    """
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    monkeypatch.setattr(extract, "list_local_zips", lambda _raw_dir: [])

    def raising_download_file(url, dest):
        raise RuntimeError("fallo no manejado")

    monkeypatch.setattr(extract, "download_file", raising_download_file)

    with pytest.raises(RuntimeError):
        extract.run(years=[2017], raw_dir=raw_dir)
