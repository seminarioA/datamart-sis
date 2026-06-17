"""
DataMart SIS — Dashboard API
Usa vistas materializadas para consultas instantáneas.
Las MVs se crean en background al iniciar y se refrescan cada 10 minutos.
"""
import threading
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import psycopg2.pool
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

DATABASE_URL = "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@localhost:5433/datamart_sis"
TEMPLATES = Path(__file__).parent / "templates"

app = FastAPI(title="DataMart SIS")

# ── Connection pool: máx 5 conexiones para el web app (ELT usa 1 aparte) ──────
_pool = psycopg2.pool.ThreadedConnectionPool(1, 5, DATABASE_URL)

# ── Cache ──────────────────────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 900  # 15 min


def _cached(key: str, fn):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["data"]
    result = fn()
    _cache[key] = {"ts": now, "data": result}
    return result


def _q(sql: str, params=None) -> list[dict]:
    c = _pool.getconn()
    try:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET work_mem = '256MB'")
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    except Exception:
        return []
    finally:
        _pool.putconn(c)


# ── Materialized views ─────────────────────────────────────────────────────────
_MV_SQLS = {
    "mv_kpis": """
        SELECT COALESCE(SUM(cantidad_atenciones), 0) AS total_atenciones,
               COUNT(*) AS total_registros
        FROM datamart_sis.fact_atenciones_sis
    """,
    "mv_por_anio": """
        SELECT t.anio, SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        JOIN datamart_sis.dim_tiempo t ON t.id_tiempo = f.id_tiempo
        GROUP BY t.anio ORDER BY t.anio
    """,
    "mv_por_region": """
        SELECT u.region,
               SUM(f.cantidad_atenciones)    AS atenciones,
               COUNT(DISTINCT f.cod_ipress)  AS ipress
        FROM datamart_sis.fact_atenciones_sis f
        JOIN datamart_sis.dim_ubicacion u ON u.cod_ubigeo = f.cod_ubigeo
        GROUP BY u.region ORDER BY atenciones DESC
    """,
    "mv_por_edad": """
        SELECT f.grupo_edad, g.etapa_vida,
               SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        LEFT JOIN datamart_sis.dim_grupo_edad g ON g.grupo_edad = f.grupo_edad
        GROUP BY f.grupo_edad, g.etapa_vida ORDER BY atenciones DESC
    """,
    "mv_por_sexo": """
        SELECT f.sexo, SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        GROUP BY f.sexo ORDER BY atenciones DESC
    """,
    "mv_top_servicios": """
        SELECT f.cod_servicio,
               COALESCE(s.desc_servicio, f.cod_servicio) AS servicio,
               SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        LEFT JOIN datamart_sis.dim_servicio s ON s.cod_servicio = f.cod_servicio
        GROUP BY f.cod_servicio, s.desc_servicio ORDER BY atenciones DESC LIMIT 15
    """,
    "mv_por_nivel": """
        SELECT f.nivel_eess,
               COALESCE(n.desc_nivel_eess, f.nivel_eess) AS nivel,
               SUM(f.cantidad_atenciones)   AS atenciones,
               COUNT(DISTINCT f.cod_ipress)  AS ipress
        FROM datamart_sis.fact_atenciones_sis f
        LEFT JOIN datamart_sis.dim_nivel_ipress n ON n.nivel_eess = f.nivel_eess
        GROUP BY f.nivel_eess, n.desc_nivel_eess ORDER BY atenciones DESC
    """,
    "mv_por_plan": """
        SELECT p.cod_plan_seguro, p.desc_plan_seguro, p.regimen_financiamiento,
               SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        JOIN datamart_sis.dim_plan_seguro p ON p.cod_plan_seguro = f.cod_plan_seguro
        GROUP BY p.cod_plan_seguro, p.desc_plan_seguro, p.regimen_financiamiento
        ORDER BY atenciones DESC
    """,
}

# Tracks which MVs currently exist and are queryable
_MV_READY: dict[str, bool] = {k: False for k in _MV_SQLS}
_MV_LAST_REFRESH: float = 0.0


def _build_mvs(refresh: bool = False):
    """Crea o refresca las MVs secuencialmente. Corre en thread de background."""
    global _MV_LAST_REFRESH
    try:
        c = psycopg2.connect(DATABASE_URL)
        c.autocommit = True
        with c.cursor() as cur:
            cur.execute("SET work_mem = '256MB'")
            for name, sql in _MV_SQLS.items():
                try:
                    if refresh:
                        cur.execute(f"REFRESH MATERIALIZED VIEW datamart_sis.{name}")
                    else:
                        cur.execute(
                            f"CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.{name} AS {sql}"
                        )
                    _MV_READY[name] = True
                    # Invalidate the relevant cache key so next request re-queries the MV
                    cache_key = name[3:]  # strip "mv_"
                    _cache.pop(cache_key, None)
                except Exception:
                    pass
        c.close()
        _MV_LAST_REFRESH = time.time()
    except Exception:
        pass
    finally:
        # Re-schedule refresh every 10 minutes
        threading.Timer(600, _build_mvs, kwargs={"refresh": True}).start()


def _qmv(mv_name: str) -> list[dict]:
    """Query un MV si está listo, o devuelve [] si aún se está construyendo."""
    if not _MV_READY.get(mv_name):
        return []
    return _q(f"SELECT * FROM datamart_sis.{mv_name}")


# ── Startup: crear MVs en background ──────────────────────────────────────────
threading.Thread(target=_build_mvs, kwargs={"refresh": False}, daemon=True).start()


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def index():
    return (TEMPLATES / "index.html").read_text()


@app.get("/api/status")
def api_status():
    ready_count = sum(_MV_READY.values())
    total = len(_MV_READY)
    return {
        "mvs_ready": ready_count,
        "mvs_total": total,
        "building": ready_count < total,
        "last_refresh": int(_MV_LAST_REFRESH) or None,
        "detail": _MV_READY,
    }


@app.get("/api/kpis")
def kpis():
    def _fetch():
        fact = _qmv("mv_kpis")
        dim = _q("""
            SELECT
                (SELECT COUNT(DISTINCT cod_region) FROM datamart_sis.dim_ubicacion) AS regiones,
                (SELECT COUNT(*) FROM datamart_sis.dim_ipress)                      AS ipress,
                (SELECT COUNT(*) FROM datamart_sis.dim_servicio)                    AS servicios,
                (SELECT COUNT(*) FROM datamart_sis.dim_plan_seguro)                 AS planes,
                (SELECT MIN(anio) FROM datamart_sis.dim_tiempo)                     AS anio_inicio,
                (SELECT MAX(anio) FROM datamart_sis.dim_tiempo)                     AS anio_fin
        """)
        return {**(fact[0] if fact else {}), **(dim[0] if dim else {})}
    return _cached("kpis", _fetch)


@app.get("/api/por-anio")
def por_anio():
    return _cached("por_anio", lambda: _qmv("mv_por_anio"))


@app.get("/api/por-region")
def por_region():
    return _cached("por_region", lambda: _qmv("mv_por_region"))


@app.get("/api/por-edad")
def por_edad():
    return _cached("por_edad", lambda: _qmv("mv_por_edad"))


@app.get("/api/por-sexo")
def por_sexo():
    return _cached("por_sexo", lambda: _qmv("mv_por_sexo"))


@app.get("/api/top-servicios")
def top_servicios():
    return _cached("top_servicios", lambda: _qmv("mv_top_servicios"))


@app.get("/api/por-nivel")
def por_nivel():
    return _cached("por_nivel", lambda: _qmv("mv_por_nivel"))


@app.get("/api/por-plan")
def por_plan():
    return _cached("por_plan", lambda: _qmv("mv_por_plan"))
