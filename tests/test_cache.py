"""
test_cache.py
=============
Pruebas unitarias de la capa de cache en 3 niveles (memoria / disco / BD) y
del registro de estado de materialized views de web/app.py.

No requiere una base de datos real: psycopg2 (pool y connect) se mockea por
completo, tanto para la conexión usada por `_q()` como para la usada por
`_build_mvs()`.

Ejecutar:
  python -m pytest tests/test_cache.py -v
"""
import importlib
import os
import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# DATABASE_URL debe existir ANTES de importar web.app: el módulo levanta
# RuntimeError en import-time si no está definida.
os.environ.setdefault("DATABASE_URL", "postgresql://fake:fake@localhost:5432/fake")

sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2  # noqa: E402  (después de fijar DATABASE_URL, antes de importar web.app)


@pytest.fixture(scope="module")
def app_module(tmp_path_factory):
    """Importa web.app con psycopg2 completamente mockeado.

    Al importarse, el módulo lanza dos threading.Thread(daemon=True) en
    background (_build_mvs y _warm_cache) que corren de inmediato y pueden
    escribir en CACHE_DIR antes de que el test alcance a redirigirlo a un
    tmp_path — eso ensuciaría el directorio `cache/` real del repo. Para
    evitarlo, se neutraliza `Thread.start()` únicamente durante el import:
    ningún hilo de background llega a correr, y los tests que necesitan
    ejercitar `_build_mvs` lo invocan explícita y sincrónicamente.
    """
    patcher_pool = patch("psycopg2.pool.ThreadedConnectionPool")
    patcher_connect = patch("psycopg2.connect")
    mock_pool_cls = patcher_pool.start()
    mock_connect = patcher_connect.start()

    mock_pool_cls.return_value = MagicMock()

    fake_conn = MagicMock()
    fake_cur = MagicMock()
    fake_conn.cursor.return_value.__enter__.return_value = fake_cur
    fake_conn.cursor.return_value.__exit__.return_value = False
    fake_cur.fetchone.return_value = [True]
    mock_connect.return_value = fake_conn

    with patch("threading.Thread.start"):
        if "web.app" in sys.modules:
            module = importlib.reload(sys.modules["web.app"])
        else:
            module = importlib.import_module("web.app")

    # CACHE_DIR por defecto para todo el módulo de test: SIEMPRE un
    # directorio temporal, nunca el `cache/` real del repo (el test autouse
    # de abajo lo vuelve a redirigir, a un tmp_path propio, en cada test).
    module.CACHE_DIR = tmp_path_factory.mktemp("cache_default")

    yield module

    patcher_connect.stop()
    patcher_pool.stop()


@pytest.fixture(autouse=True)
def _isolate_cache_state(app_module, tmp_path, monkeypatch):
    """Cada test arranca con L1 vacío y L2 apuntando a un directorio temporal,
    para no pisar el cache real del repo ni contaminar tests entre sí."""
    with app_module._mem_lock:
        app_module._mem.clear()
    monkeypatch.setattr(app_module, "CACHE_DIR", tmp_path)
    yield
    with app_module._mem_lock:
        app_module._mem.clear()


# ─── L1 (memoria) ──────────────────────────────────────────────────────────

def test_cached_serves_from_memory_before_calling_fn_again(app_module):
    calls = []

    def fn():
        calls.append(1)
        return {"value": 1}

    first = app_module._cached("mem_key", fn)
    second = app_module._cached("mem_key", fn)

    assert first == {"value": 1}
    assert second == {"value": 1}
    assert len(calls) == 1  # la 2da vez sirvió desde L1, no volvió a llamar fn


def test_cached_falls_back_to_disk_after_mem_ttl_expires(app_module, monkeypatch):
    monkeypatch.setattr(app_module, "MEM_TTL", 0.05)
    calls = []

    def fn():
        calls.append(1)
        return {"n": len(calls)}

    app_module._cached("mem_ttl_key", fn)
    time.sleep(0.12)
    result = app_module._cached("mem_ttl_key", fn)

    assert len(calls) == 1  # expiró L1 pero sirvió desde L2 (disco), no llamó fn
    assert result == {"n": 1}


# ─── L2 (disco) ────────────────────────────────────────────────────────────

def test_cached_serves_from_disk_before_calling_fn_when_memory_empty(app_module):
    calls = []

    def fn():
        calls.append(1)
        return {"value": "desde_disco"}

    app_module._cached("disk_key", fn)
    assert len(calls) == 1

    # Simular reinicio del proceso: se pierde L1, L2 sigue en disco.
    with app_module._mem_lock:
        del app_module._mem["disk_key"]

    result = app_module._cached("disk_key", fn)

    assert result == {"value": "desde_disco"}
    assert len(calls) == 1  # no debió volver a llamar fn: sirvió desde L2
    with app_module._mem_lock:
        assert "disk_key" in app_module._mem  # y repobló L1


def test_cached_calls_fn_again_after_disk_ttl_expires(app_module, monkeypatch):
    monkeypatch.setattr(app_module, "MEM_TTL", 0)
    monkeypatch.setattr(app_module, "DISK_TTL", 0)
    calls = []

    def fn():
        calls.append(1)
        return {"n": len(calls)}

    app_module._cached("disk_ttl_key", fn)
    with app_module._mem_lock:
        app_module._mem.pop("disk_ttl_key", None)
    time.sleep(0.02)

    result = app_module._cached("disk_ttl_key", fn)

    assert len(calls) == 2  # tanto L1 como L2 habían expirado -> llamó fn de nuevo
    assert result == {"n": 2}


# ─── No cachear resultados con forma de error ──────────────────────────────

def test_cached_does_not_persist_error_shaped_result(app_module):
    responses = [{"error": "transient boom"}, {"ok": True}]
    calls = []

    def fn():
        calls.append(1)
        return responses[len(calls) - 1]

    first = app_module._cached("err_key", fn)
    assert first == {"error": "transient boom"}
    with app_module._mem_lock:
        assert "err_key" not in app_module._mem
    assert not (app_module.CACHE_DIR / "err_key.json").exists()

    # Segunda llamada: si el error se hubiese cacheado, fn NO se invocaría de
    # nuevo y seguiríamos viendo el error. Debe invocarse fn y devolver el
    # resultado real.
    second = app_module._cached("err_key", fn)
    assert second == {"ok": True}
    assert len(calls) == 2


def test_swap_cache_refuses_error_shaped_value(app_module):
    app_module._swap_cache("swap_key", {"ok": 1})
    with app_module._mem_lock:
        assert app_module._mem["swap_key"]["data"] == {"ok": 1}

    app_module._swap_cache("swap_key", {"error": "no debería pisar el valor bueno"})

    with app_module._mem_lock:
        # El valor previo (bueno) se preserva: swap con error-shaped se descarta.
        assert app_module._mem["swap_key"]["data"] == {"ok": 1}


# ─── _q() propaga DatabaseUnavailableError, nunca devuelve [] silenciosamente ──

def test_q_raises_database_unavailable_on_execute_error(app_module):
    fake_cur = MagicMock()
    # 1ra llamada a execute: `SET work_mem`. 2da: la query real -> falla.
    fake_cur.execute.side_effect = [None, psycopg2.OperationalError("connection lost")]
    fake_conn = MagicMock()
    fake_conn.cursor.return_value.__enter__.return_value = fake_cur
    fake_conn.cursor.return_value.__exit__.return_value = False

    with patch.object(app_module._pool, "getconn", return_value=fake_conn), \
         patch.object(app_module._pool, "putconn") as mock_putconn:
        with pytest.raises(app_module.DatabaseUnavailableError):
            app_module._q("SELECT 1")
        # La conexión se devuelve al pool incluso si la query falló.
        mock_putconn.assert_called_once_with(fake_conn)


def test_cached_propagates_database_unavailable_error_uncaught(app_module):
    def fn():
        raise app_module.DatabaseUnavailableError("db down")

    with pytest.raises(app_module.DatabaseUnavailableError):
        app_module._cached("db_err_key", fn)

    # No se cachea nada (ni memoria ni disco) cuando fn() explota.
    with app_module._mem_lock:
        assert "db_err_key" not in app_module._mem
    assert not (app_module.CACHE_DIR / "db_err_key.json").exists()


# ─── _disk_write / _disk_read ──────────────────────────────────────────────

def test_disk_write_read_roundtrip_no_leftover_tmp_file(app_module, tmp_path):
    data = {"a": 1, "b": [1, 2, 3], "c": "áéí"}
    app_module._disk_write("roundtrip_key", data)

    read_back = app_module._disk_read("roundtrip_key")
    assert read_back == data

    assert (tmp_path / "roundtrip_key.json").exists()
    assert list(tmp_path.glob("roundtrip_key.json.tmp-*")) == []


def test_disk_read_returns_none_when_missing(app_module):
    assert app_module._disk_read("nunca_escrita") is None


def test_disk_read_respects_disk_ttl(app_module, monkeypatch):
    monkeypatch.setattr(app_module, "DISK_TTL", 0)
    app_module._disk_write("expira_ya", {"x": 1})
    time.sleep(0.02)
    assert app_module._disk_read("expira_ya") is None


# ─── _build_mvs: una MV que falla no queda marcada como lista ──────────────

def test_build_mvs_does_not_mark_failed_mv_as_ready(app_module, monkeypatch):
    fail_mv = "mv_por_sexo"
    assert fail_mv in app_module._MV_SQLS

    # Evitar que _build_mvs programe un threading.Timer real (no-daemon si se
    # llama desde el hilo principal de pytest, lo que colgaría el proceso).
    monkeypatch.setattr(app_module.threading, "Timer", lambda *a, **k: MagicMock())

    # Aislar el estado global de este test: todas las MVs "no existen todavía".
    for name in app_module._MV_SQLS:
        app_module._MV_READY[name] = False
        app_module._MV_LAST_ERROR[name] = None

    class FakeCursor:
        def execute(self, sql, params=None):
            if "pg_matviews" in sql:
                return
            if f"datamart_sis.{fail_mv}" in sql and "CREATE MATERIALIZED VIEW" in sql:
                raise RuntimeError(f"boom building {fail_mv}")

        def fetchone(self):
            return [False]  # "todavía no existe" -> fuerza el camino de CREATE

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class FakeConn:
        def cursor(self):
            return FakeCursor()

        def close(self):
            pass

    monkeypatch.setattr(app_module.psycopg2, "connect", lambda *a, **k: FakeConn())

    try:
        app_module._build_mvs(refresh=False)

        assert app_module._MV_READY[fail_mv] is False
        assert app_module._MV_LAST_ERROR[fail_mv] is not None
        assert "boom" in app_module._MV_LAST_ERROR[fail_mv]

        otras_mvs = [n for n in app_module._MV_SQLS if n != fail_mv]
        assert all(app_module._MV_READY[n] for n in otras_mvs)
    finally:
        # Restaurar estado "todo listo" para no afectar el orden de otros tests.
        for name in app_module._MV_SQLS:
            app_module._MV_READY[name] = True
            app_module._MV_LAST_ERROR[name] = None
