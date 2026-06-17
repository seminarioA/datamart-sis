"""
DataMart SIS — Dashboard API
FastAPI backend con cache TTL de 5 minutos para KPIs y datos analíticos.
"""
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse

DATABASE_URL = "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@localhost:5433/datamart_sis"
TEMPLATES = Path(__file__).parent / "templates"

app = FastAPI(title="DataMart SIS")

# ── Simple in-memory cache con TTL ─────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 300  # segundos


def _cached(key: str, fn):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["data"]
    result = fn()
    _cache[key] = {"ts": now, "data": result}
    return result


def _conn():
    c = psycopg2.connect(DATABASE_URL)
    with c.cursor() as cur:
        cur.execute("SET work_mem = '256MB'")
        cur.execute("SET statement_timeout = '60000'")
    return c


def _q(sql: str, params=None) -> list[dict]:
    c = _conn()
    try:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    finally:
        c.close()


@app.get("/", response_class=HTMLResponse)
def index():
    return (TEMPLATES / "index.html").read_text()


@app.get("/api/kpis")
def kpis():
    def _fetch():
        rows = _q("""
            SELECT
                COALESCE(SUM(f.cantidad_atenciones), 0)          AS total_atenciones,
                COUNT(*)                                          AS total_registros,
                COUNT(DISTINCT u.cod_region)                      AS regiones,
                COUNT(DISTINCT f.cod_ipress)                      AS ipress,
                COUNT(DISTINCT f.cod_servicio)                    AS servicios,
                COUNT(DISTINCT f.cod_plan_seguro)                 AS planes,
                MIN(t.anio)                                       AS anio_inicio,
                MAX(t.anio)                                       AS anio_fin
            FROM datamart_sis.fact_atenciones_sis f
            JOIN datamart_sis.dim_tiempo    t ON t.id_tiempo  = f.id_tiempo
            JOIN datamart_sis.dim_ubicacion u ON u.cod_ubigeo = f.cod_ubigeo
        """)
        return rows[0] if rows else {}
    return _cached("kpis", _fetch)


@app.get("/api/por-anio")
def por_anio():
    def _fetch():
        return _q("""
            SELECT t.anio, SUM(f.cantidad_atenciones) AS atenciones
            FROM datamart_sis.fact_atenciones_sis f
            JOIN datamart_sis.dim_tiempo t ON t.id_tiempo = f.id_tiempo
            GROUP BY t.anio ORDER BY t.anio
        """)
    return _cached("por_anio", _fetch)


@app.get("/api/por-region")
def por_region():
    def _fetch():
        return _q("""
            SELECT u.region,
                   SUM(f.cantidad_atenciones)    AS atenciones,
                   COUNT(DISTINCT f.cod_ipress)  AS ipress
            FROM datamart_sis.fact_atenciones_sis f
            JOIN datamart_sis.dim_ubicacion u ON u.cod_ubigeo = f.cod_ubigeo
            GROUP BY u.region ORDER BY atenciones DESC
        """)
    return _cached("por_region", _fetch)


@app.get("/api/por-edad")
def por_edad():
    def _fetch():
        return _q("""
            SELECT f.grupo_edad,
                   g.etapa_vida,
                   SUM(f.cantidad_atenciones) AS atenciones
            FROM datamart_sis.fact_atenciones_sis f
            LEFT JOIN datamart_sis.dim_grupo_edad g ON g.grupo_edad = f.grupo_edad
            GROUP BY f.grupo_edad, g.etapa_vida
            ORDER BY atenciones DESC LIMIT 20
        """)
    return _cached("por_edad", _fetch)


@app.get("/api/por-sexo")
def por_sexo():
    def _fetch():
        return _q("""
            SELECT f.sexo, SUM(f.cantidad_atenciones) AS atenciones
            FROM datamart_sis.fact_atenciones_sis f
            GROUP BY f.sexo ORDER BY atenciones DESC
        """)
    return _cached("por_sexo", _fetch)


@app.get("/api/top-servicios")
def top_servicios(limit: int = Query(default=15, le=50)):
    def _fetch():
        return _q("""
            SELECT f.cod_servicio,
                   COALESCE(s.desc_servicio, f.cod_servicio) AS servicio,
                   SUM(f.cantidad_atenciones) AS atenciones
            FROM datamart_sis.fact_atenciones_sis f
            LEFT JOIN datamart_sis.dim_servicio s ON s.cod_servicio = f.cod_servicio
            GROUP BY f.cod_servicio, s.desc_servicio
            ORDER BY atenciones DESC LIMIT 15
        """)
    return _cached("top_servicios", _fetch)


@app.get("/api/por-nivel")
def por_nivel():
    def _fetch():
        return _q("""
            SELECT f.nivel_eess,
                   COALESCE(n.desc_nivel_eess, f.nivel_eess) AS nivel,
                   SUM(f.cantidad_atenciones)   AS atenciones,
                   COUNT(DISTINCT f.cod_ipress)  AS ipress
            FROM datamart_sis.fact_atenciones_sis f
            LEFT JOIN datamart_sis.dim_nivel_ipress n ON n.nivel_eess = f.nivel_eess
            GROUP BY f.nivel_eess, n.desc_nivel_eess
            ORDER BY atenciones DESC
        """)
    return _cached("por_nivel", _fetch)


@app.get("/api/por-plan")
def por_plan():
    def _fetch():
        return _q("""
            SELECT p.cod_plan_seguro,
                   p.desc_plan_seguro,
                   p.regimen_financiamiento,
                   SUM(f.cantidad_atenciones) AS atenciones
            FROM datamart_sis.fact_atenciones_sis f
            JOIN datamart_sis.dim_plan_seguro p ON p.cod_plan_seguro = f.cod_plan_seguro
            GROUP BY p.cod_plan_seguro, p.desc_plan_seguro, p.regimen_financiamiento
            ORDER BY atenciones DESC
        """)
    return _cached("por_plan", _fetch)
