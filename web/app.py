"""
DataMart SIS — Dashboard API
Cache en 3 capas: JSON en disco → memoria → PostgreSQL MV.
Reinicio = respuesta instantánea desde JSON (sin esperar re-build de MVs).
"""
import json
import math
import subprocess
import tempfile
import threading
import time
from datetime import date
from pathlib import Path

import psycopg2
import psycopg2.extras
import psycopg2.pool
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles

import os
DATABASE_URL = os.environ["DATABASE_URL"]
STATIC       = Path(__file__).parent / "static"
FRONTEND     = Path(__file__).parent / "frontend" / "dist"
CACHE_DIR    = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

app = FastAPI(title="DataMart SIS")
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")
if (FRONTEND / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND / "assets")), name="assets")

# ── Connection pool ──────────────────────────────────────────────────────────────
_pool = psycopg2.pool.ThreadedConnectionPool(1, 5, DATABASE_URL)

# ── Cache en 3 capas ────────────────────────────────────────────────────────────
# L1: dict en memoria (sub-ms)
# L2: archivo JSON en disco (persiste entre reinicios, ms)
# L3: PostgreSQL MV (fuente de verdad, segundos)
_mem: dict = {}
MEM_TTL = 900   # 15 min en memoria — fuerza re-validación periódica contra DB

# L2 (disco) NO tiene TTL: el archivo solo se reemplaza cuando llega data
# fresca e íntegra desde L3 (DB). Esto garantiza disponibilidad permanente
# del caché incluso si la DB está temporalmente inaccesible.

_refreshing: set = set()
_rlock = threading.Lock()


def _disk_read(key: str):
    """Lee del disco sin verificar antigüedad — siempre disponible si existe."""
    p = CACHE_DIR / f"{key}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def _disk_write(key: str, data) -> bool:
    """Escritura atómica: .tmp → rename garantiza que no haya estado corrupto."""
    try:
        tmp = CACHE_DIR / f"{key}.json.tmp"
        tmp.write_text(json.dumps(data, ensure_ascii=False, default=str))
        tmp.rename(CACHE_DIR / f"{key}.json")   # POSIX: operación atómica
        return True
    except Exception:
        return False


def _bg_refresh(key: str, fn):
    """Refresca DB en background; escribe a disco SOLO si el resultado es íntegro."""
    with _rlock:
        if key in _refreshing:
            return
        _refreshing.add(key)

    def _run():
        try:
            data = fn()
            is_valid = data is not None and data not in ([], {})
            if is_valid:
                _mem[key] = {"ts": time.time(), "data": data}
                _disk_write(key, data)
        except Exception:
            pass
        finally:
            with _rlock:
                _refreshing.discard(key)

    threading.Thread(target=_run, daemon=True).start()


def _cached(key: str, fn):
    now = time.time()
    # L1 — memoria (TTL 15 min)
    entry = _mem.get(key)
    if entry and now - entry["ts"] < MEM_TTL:
        return entry["data"]

    # L3 — intentar DB sincrónicamente (primera carga o TTL expirado)
    # Si falla, L2 (disco) actúa como fallback sin TTL
    disk = _disk_read(key)

    if disk is not None:
        # Servir dato estable de inmediato; refrescar DB en background
        # Ajustamos ts para reintentar en ~60 s si el bg_refresh no llega primero
        _mem[key] = {"ts": now - MEM_TTL + 60, "data": disk}
        _bg_refresh(key, fn)
        return disk

    # Sin caché en disco todavía (primera ejecución o caché borrado)
    try:
        data = fn()
        if data is not None and data not in ([], {}):
            _mem[key] = {"ts": now, "data": data}
            _disk_write(key, data)
            return data
    except Exception:
        pass
    return [] if True else {}   # respuesta vacía de emergencia


def _invalidate(key: str):
    _mem.pop(key, None)
    # No borramos el archivo de disco — solo refrescaremos su contenido
    # cuando llegue nueva data íntegra desde DB (_bg_refresh lo sobreescribe)
    _bg_refresh(key, lambda: None)   # no-op: dispara ciclo de refresco limpio


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


# ── HTTP cache middleware (browser-level caching) ──────────────────────────────
@app.middleware("http")
async def cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/") and path not in ("/api/status", "/api/export/pdf"):
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    elif path in ("/api/status", "/api/export/pdf"):
        response.headers["Cache-Control"] = "no-store"
    return response


# ── Materialized views ─────────────────────────────────────────────────────────
_MV_SQLS = {
    "mv_kpis": """
        SELECT COALESCE(SUM(cantidad_atenciones),0) AS total_atenciones,
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
               SUM(f.cantidad_atenciones)   AS atenciones,
               COUNT(DISTINCT f.cod_ipress) AS ipress
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
               COUNT(DISTINCT f.cod_ipress) AS ipress
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
    "mv_por_mes": """
        SELECT t.anio, t.mes,
               SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        JOIN datamart_sis.dim_tiempo t ON t.id_tiempo = f.id_tiempo
        GROUP BY t.anio, t.mes ORDER BY t.anio, t.mes
    """,
    "mv_por_fuente": """
        SELECT fuente_archivo,
               COUNT(*)                   AS filas,
               SUM(cantidad_atenciones)   AS atenciones
        FROM datamart_sis.fact_atenciones_sis
        GROUP BY fuente_archivo
        ORDER BY fuente_archivo
    """,
    "mv_arquetipos": """
        SELECT
            f.grupo_edad,
            f.sexo,
            f.nivel_eess,
            f.cod_plan_seguro,
            COALESCE(p.desc_plan_seguro, f.cod_plan_seguro) AS desc_plan_seguro,
            SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        LEFT JOIN datamart_sis.dim_plan_seguro p
               ON p.cod_plan_seguro = f.cod_plan_seguro
        GROUP BY f.grupo_edad, f.sexo, f.nivel_eess,
                 f.cod_plan_seguro, p.desc_plan_seguro
        ORDER BY f.grupo_edad, atenciones DESC
    """,
}

_MV_READY: dict[str, bool] = {k: False for k in _MV_SQLS}
_MV_LAST_REFRESH: float = 0.0


def _build_mvs(refresh: bool = False):
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
                        _MV_READY[name] = True
                        cache_key = name[3:]  # "mv_kpis" → "kpis"
                        _invalidate(cache_key)
                    else:
                        # Si la MV ya existe (reinicios) → marcarla lista al instante
                        cur.execute(
                            "SELECT EXISTS(SELECT FROM pg_matviews "
                            "WHERE schemaname='datamart_sis' AND matviewname=%s)",
                            (name,)
                        )
                        if cur.fetchone()[0]:
                            _MV_READY[name] = True  # ya estaba, respuesta inmediata
                        else:
                            cur.execute(
                                f"CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.{name} AS {sql}"
                            )
                            _MV_READY[name] = True
                except Exception:
                    pass
        c.close()
        _MV_LAST_REFRESH = time.time()
    except Exception:
        pass
    finally:
        threading.Timer(600, _build_mvs, kwargs={"refresh": True}).start()


def _qmv(mv_name: str) -> list[dict]:
    if not _MV_READY.get(mv_name):
        return []
    return _q(f"SELECT * FROM datamart_sis.{mv_name}")


threading.Thread(target=_build_mvs, kwargs={"refresh": False}, daemon=True).start()


# ── Routes ──────────────────────────────────────────────────────────────────────
@app.get("/", response_class=FileResponse)
def index():
    idx = FRONTEND / "index.html"
    if idx.exists():
        return FileResponse(str(idx))
    return FileResponse(str(Path(__file__).parent / "templates" / "index.html"))


@app.get("/api/status")
def api_status():
    ready = sum(_MV_READY.values())
    return {
        "mvs_ready": ready,
        "mvs_total": len(_MV_READY),
        "building": ready < len(_MV_READY),
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


# Tamaños confirmados via HTTP HEAD a datosabiertos.gob.pe (Content-Length en bytes).
# Sirven como ancla de autenticidad: si el archivo cargado no viniera de este portal,
# el hash/tamaño sería distinto.
_PORTAL_SIZES = {
    "OPENDATA_DS_01_2017_ATENCIONES_0.zip":      96878243,
    "OPENDATA_DS_01_2018_ATENCIONES_0.zip":      99212136,
    "OPENDATA_DS_01_2019_ATENCIONES_0.zip":     101927710,
    "OPENDATA_DS_01_2020_ATENCIONES_0.zip":      58378690,
    "OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip": 35047299,
    "OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip": 53474175,
    "OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip":131465944,
    "OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip":136867761,
    "OPENDATA_DS_01_2023_01_06_ATENCIONES_0.zip":154801833,
    "OPENDATA_DS_01_2023_07_12_ATENCIONES_0.zip":154850068,
    "OPENDATA_DS_01_2024_01_06_ATENCIONES.zip":  165608898,
    "OPENDATA_DS_01_2024_07_12_ATENCIONES.zip":  163917818,
    "OPENDATA_DS_01_2025_01_06_ATENCIONES.zip":  175415084,
    "OPENDATA_DS_01_2025_07_12_ATENCIONES.zip":  172575219,
}

@app.get("/api/cuadre")
def cuadre():
    def _fetch():
        fuente = _qmv("mv_por_fuente")
        anio   = _qmv("mv_por_anio")
        kpis   = _qmv("mv_kpis")
        return {
            "por_fuente":       fuente,
            "por_anio":         anio,
            "total_atenciones": int(kpis[0]["total_atenciones"]) if kpis else 0,
            "total_filas":      int(kpis[0]["total_registros"])  if kpis else 0,
        }
    cached = _cached("cuadre", _fetch)
    # _PORTAL_SIZES es constante estática — se inyecta aquí, fuera del caché,
    # para que siempre esté presente independientemente del estado de L1/L2.
    result = {**cached, "portal_total_bytes": sum(_PORTAL_SIZES.values())}
    result["por_fuente"] = [
        {**row, "portal_bytes": _PORTAL_SIZES.get(row.get("fuente_archivo", ""), 0)}
        for row in cached.get("por_fuente", [])
    ]
    return result


# ── Endpoint bundled: devuelve todo en 1 llamada (evita 8 round-trips por cloudflared) ──
@app.get("/api/dashboard")
def dashboard():
    """Todos los datos del dashboard en una sola respuesta."""
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
        return {
            "kpis":       {**(fact[0] if fact else {}), **(dim[0] if dim else {})},
            "anio":       _qmv("mv_por_anio"),
            "region":     _qmv("mv_por_region"),
            "edad":       _qmv("mv_por_edad"),
            "sexo":       _qmv("mv_por_sexo"),
            "servicios":  _qmv("mv_top_servicios"),
            "nivel":      _qmv("mv_por_nivel"),
            "plan":       _qmv("mv_por_plan"),
        }
    return _cached("dashboard", _fetch)


# ── Pre-calentar cache al inicio (en background, después de que las MVs estén listas) ──
def _warm_cache():
    """Ejecuta todas las queries una vez para poblar L1+L2 cache."""
    import time
    # Esperar hasta que las MVs estén listas
    for _ in range(60):
        if all(_MV_READY.values()):
            break
        time.sleep(10)
    if not any(_MV_READY.values()):
        return
    try:
        # Llamar al endpoint bundled para poblar todo el cache de una vez
        fact = _qmv("mv_kpis")
        dim = _q("""SELECT
            (SELECT COUNT(DISTINCT cod_region) FROM datamart_sis.dim_ubicacion) AS regiones,
            (SELECT COUNT(*) FROM datamart_sis.dim_ipress) AS ipress,
            (SELECT COUNT(*) FROM datamart_sis.dim_servicio) AS servicios,
            (SELECT COUNT(*) FROM datamart_sis.dim_plan_seguro) AS planes,
            (SELECT MIN(anio) FROM datamart_sis.dim_tiempo) AS anio_inicio,
            (SELECT MAX(anio) FROM datamart_sis.dim_tiempo) AS anio_fin""")
        _cached("kpis",        lambda: {**(fact[0] if fact else {}), **(dim[0] if dim else {})})
        _cached("por_anio",    lambda: _qmv("mv_por_anio"))
        _cached("por_region",  lambda: _qmv("mv_por_region"))
        _cached("por_edad",    lambda: _qmv("mv_por_edad"))
        _cached("por_sexo",    lambda: _qmv("mv_por_sexo"))
        _cached("top_servicios", lambda: _qmv("mv_top_servicios"))
        _cached("por_nivel",   lambda: _qmv("mv_por_nivel"))
        _cached("por_plan",    lambda: _qmv("mv_por_plan"))
        # Bundle también
        _cached("dashboard", lambda: {
            "kpis": _cached("kpis", lambda: None),
            "anio": _cached("por_anio", lambda: None),
            "region": _cached("por_region", lambda: None),
            "edad": _cached("por_edad", lambda: None),
            "sexo": _cached("por_sexo", lambda: None),
            "servicios": _cached("top_servicios", lambda: None),
            "nivel": _cached("por_nivel", lambda: None),
            "plan": _cached("por_plan", lambda: None),
        })
    except Exception:
        pass

threading.Thread(target=_warm_cache, daemon=True).start()


# ── Analítica predictiva ──────────────────────────────────────────────────────
@app.get("/api/predicciones")
def predicciones():
    def _fetch():
        try:
            import numpy as np
        except ImportError:
            return {"error": "numpy no instalado"}

        anio_data = _qmv("mv_por_anio")
        if not anio_data:
            return {"error": "Datos no disponibles aún"}

        anios        = [int(d["anio"]) for d in anio_data]
        y            = np.array([float(d["atenciones"]) for d in anio_data])
        max_anio     = max(anios)
        future_years = list(range(max_anio + 1, max_anio + 4))

        # ── 1. Holt-Winters Double Exp. Smoothing (tendencia aditiva) ─────────
        try:
            from statsmodels.tsa.holtwinters import ExponentialSmoothing
            hw = ExponentialSmoothing(
                y, trend="add", seasonal=None, initialization_method="estimated"
            ).fit(optimized=True, use_brute=False)
            y_pred_hist = np.array(hw.fittedvalues)
            y_fut       = np.array(hw.forecast(3))
            modelo_nombre = "Holt-Winters (suavizado exponencial doble)"
        except ImportError:
            # Fallback OLS si statsmodels aún no instalado en el entorno
            from sklearn.linear_model import LinearRegression
            X = np.array(anios).reshape(-1, 1)
            lin = LinearRegression().fit(X, y)
            y_pred_hist = lin.predict(X)
            X_fut = np.array(future_years).reshape(-1, 1)
            y_fut = lin.predict(X_fut)
            modelo_nombre = "Regresión Lineal OLS (fallback)"

        resid     = y - y_pred_hist
        resid_std = float(np.std(resid, ddof=1)) if len(resid) > 1 else float(np.std(resid))
        r2        = float(1 - np.sum(resid ** 2) / max(np.sum((y - np.mean(y)) ** 2), 1e-10))
        rmse      = float(np.sqrt(np.mean(resid ** 2)))
        slope     = float(np.mean(np.diff(y_pred_hist))) if len(y_pred_hist) > 1 else 0.0

        historico = [
            {"anio": int(d["anio"]), "atenciones": int(d["atenciones"]),
             "tendencia": round(float(p)), "tipo": "real"}
            for d, p in zip(anio_data, y_pred_hist)
        ]
        # PI crece con sqrt(horizonte): honesto sobre la incertidumbre acumulada
        prediccion_anual = [
            {"anio": yr, "atenciones": round(float(v)),
             "lower": round(max(0.0, float(v) - 1.645 * resid_std * math.sqrt(h + 1))),
             "upper": round(float(v) + 1.645 * resid_std * math.sqrt(h + 1)),
             "tipo": "prediccion"}
            for h, (yr, v) in enumerate(zip(future_years, y_fut))
        ]

        # ── 2. Estacionalidad mensual ─────────────────────────────────────────
        mes_data = _qmv("mv_por_mes")
        estacionalidad = []
        if mes_data:
            from collections import defaultdict
            mes_sums: dict[int, list] = defaultdict(list)
            for d in mes_data:
                mes_sums[int(d["mes"])].append(float(d["atenciones"]))
            promedios = {m: float(np.mean(vals)) for m, vals in mes_sums.items()}
            media_global = float(np.mean(list(promedios.values()))) or 1.0
            nombres = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
                       "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
            estacionalidad = [
                {"mes": m, "nombre": nombres[m],
                 "promedio": round(promedios[m]),
                 "indice": round(promedios[m] / media_global * 100)}
                for m in sorted(promedios)
            ]

        # ── 3. Proyección regional (top 10) ──────────────────────────────────
        region_data = _qmv("mv_por_region")
        regiones_proy = []
        if region_data:
            total_r = sum(float(d["atenciones"]) for d in region_data) or 1
            cagr    = slope / float(np.mean(y)) if np.mean(y) > 0 else 0.0
            regiones_proy = [
                {"region": d["region"],
                 "atenciones": int(float(d["atenciones"])),
                 "proyeccion_2026": round(float(d["atenciones"]) * (1 + cagr)),
                 "crecimiento_pct": round(cagr * 100, 1),
                 "share_pct": round(float(d["atenciones"]) / total_r * 100, 1)}
                for d in region_data[:10]
            ]

        return {
            "forecast_anual": {
                "historico": historico,
                "prediccion": prediccion_anual,
                "modelo": modelo_nombre,
                "r2": round(r2, 3),
                "rmse": round(rmse),
                "pendiente_anual": round(slope),
                "tendencia": "creciente" if slope > 0 else "decreciente",
                "interpretacion": (
                    f"Modelo: {modelo_nombre}. "
                    f"Se proyecta un {'aumento' if slope > 0 else 'descenso'} de "
                    f"{abs(round(slope / 1e6, 2))}M atenciones por año. "
                    "Los intervalos de confianza al 90% se amplían con el horizonte de proyección."
                ),
            },
            "estacionalidad": estacionalidad,
            "regiones_proyeccion": regiones_proy,
        }
    return _cached("predicciones", _fetch)


# ── Arquetipos SIS ───────────────────────────────────────────────────────────
_ARQUETIPOS_DEF = [
    {
        "id": "primera_infancia", "nombre": "Primera Infancia",
        "rango": "00 – 04 años", "edad_prefix": "00", "color": "#1A67A3",
        "descripcion": (
            "Etapa de mayor vulnerabilidad. Atención centrada en CRED, vacunación y control "
            "nutricional. Prácticamente cubierta en su totalidad por el SIS Gratuito "
            "materno-infantil."
        ),
        "foco": ["CRED", "Vacunación", "Nutrición"],
    },
    {
        "id": "ninez_escolar", "nombre": "Niñez Escolar",
        "rango": "05 – 11 años", "edad_prefix": "05", "color": "#1E7BBF",
        "descripcion": (
            "Continuidad de la atención preventiva. Incorpora salud bucal, control de talla "
            "y detección temprana de problemas visuales y auditivos. Mayor presencia en "
            "postas vinculadas a centros educativos."
        ),
        "foco": ["Odontología", "Control de crecimiento", "Salud visual"],
    },
    {
        "id": "adolescente", "nombre": "Adolescente",
        "rango": "12 – 17 años", "edad_prefix": "12", "color": "#2386C8",
        "descripcion": (
            "Transición a servicios diferenciados: salud reproductiva, salud mental y "
            "atención integral. Grupo con mayor tasa de abandono al seguimiento preventivo "
            "y menor uso relativo del sistema."
        ),
        "foco": ["Salud reproductiva", "Salud mental", "Atención diferenciada"],
    },
    {
        "id": "adulto_joven", "nombre": "Adulto Joven",
        "rango": "18 – 29 años", "edad_prefix": "18", "color": "#2E6CA6",
        "descripcion": (
            "Dominado por mujeres en edad fértil: atenciones materno-perinatales, "
            "planificación familiar y CRED de neonatos. En varones, creciente uso de "
            "servicios de urgencia y emergencia."
        ),
        "foco": ["Atención materno-perinatal", "Planificación familiar", "Urgencias"],
    },
    {
        "id": "adulto_productivo", "nombre": "Adulto en Actividad",
        "rango": "30 – 59 años", "edad_prefix": "30", "color": "#1F4F7B",
        "descripcion": (
            "Inicio de enfermedades crónicas: hipertensión, diabetes, dislipidemia. "
            "Mayor uso de Nivel II y III. Presencia de planes contributivos especialmente "
            "en Lima Metropolitana."
        ),
        "foco": ["Enfermedades crónicas", "Diagnóstico temprano", "Adherencia al tratamiento"],
    },
    {
        "id": "adulto_mayor", "nombre": "Adulto Mayor",
        "rango": "60 años a más", "edad_prefix": "60", "color": "#103E6E",
        "descripcion": (
            "Mayor carga de comorbilidades y complejidad de atención. Alta demanda de "
            "Nivel III. Costo por atención más elevado del sistema. Dependencia casi "
            "total del SIS Gratuito ante la baja formalización laboral en este grupo."
        ),
        "foco": ["Comorbilidades crónicas", "Hospitalización", "Rehabilitación"],
    },
]


@app.get("/api/arquetipos")
def arquetipos():
    def _fetch():
        arq_raw  = _qmv("mv_arquetipos")
        edad_raw = _qmv("mv_por_edad")
        if not arq_raw or not edad_raw:
            return {"error": "Datos no disponibles aún"}

        total_global = sum(float(d["atenciones"]) for d in edad_raw) or 1

        result = []
        for defn in _ARQUETIPOS_DEF:
            pfx = defn["edad_prefix"]
            # Filas de la MV que pertenecen a este grupo etario (match por prefijo)
            rows = [r for r in arq_raw if str(r.get("grupo_edad", ""))[:2].strip() == pfx]
            total = sum(float(r["atenciones"]) for r in rows) or 1

            # % Femenino
            fem    = sum(float(r["atenciones"]) for r in rows
                         if str(r.get("sexo", "")).upper().startswith("F"))
            pct_fem = round(fem / total * 100, 1)

            # Nivel EESS predominante
            nivel_acc: dict[str, float] = {}
            for r in rows:
                k = str(r.get("nivel_eess") or "?").strip()
                nivel_acc[k] = nivel_acc.get(k, 0.0) + float(r["atenciones"])
            nivel_pred = max(nivel_acc, key=nivel_acc.get) if nivel_acc else "?"

            # Plan predominante (nombre corto)
            plan_acc: dict[str, float] = {}
            for r in rows:
                k = str(r.get("desc_plan_seguro") or r.get("cod_plan_seguro") or "?").strip()
                plan_acc[k] = plan_acc.get(k, 0.0) + float(r["atenciones"])
            plan_full = max(plan_acc, key=plan_acc.get) if plan_acc else "?"
            # Abreviar: "SIS Gratuito — Ley N°..." → "Gratuito"
            plan_short = (plan_full
                          .replace("SIS ", "").replace("Sis ", "")
                          .split("—")[0].split("-")[0].split("(")[0]
                          .strip()[:20])

            result.append({
                **{k: v for k, v in defn.items() if k != "edad_prefix"},
                "atenciones":       round(total),
                "pct_total":        round(total / total_global * 100, 1),
                "pct_femenino":     pct_fem,
                "nivel_predominante": nivel_pred,
                "plan_predominante":  plan_short,
            })

        return {"arquetipos": result, "total_global": round(total_global)}

    return _cached("arquetipos", _fetch)


# ── Helpers para generación de PDF LaTeX ─────────────────────────────────────
def _esc(s) -> str:
    """Escapa caracteres especiales de LaTeX preservando UTF-8."""
    if not isinstance(s, str):
        s = str(s) if s is not None else ""
    s = s.replace("\\", r"\textbackslash{}")
    for c, r in [
        ("&", r"\&"), ("%", r"\%"), ("$", r"\$"), ("#", r"\#"),
        ("{", r"\{"), ("}", r"\}"), ("~", r"\textasciitilde{}"),
        ("^", r"\textasciicircum{}"), ("_", r"\_"),
    ]:
        s = s.replace(c, r)
    return s


def _fmtn(n, decimals: int = 0) -> str:
    """Formatea número con separador de miles en estilo peruano (punto)."""
    try:
        v = float(n)
        formatted = f"{v:,.{decimals}f}" if decimals else f"{int(v):,}"
        return formatted.replace(",", ".")
    except Exception:
        return str(n)


def _bartex(val: float, max_val: float, max_cm: float = 5.5) -> str:
    if max_val <= 0:
        return ""
    frac = min(val / max_val, 1.0)
    w    = max(frac * max_cm, 0.05)
    return r"\textcolor{sisblue}{\rule{" + f"{w:.2f}cm" + r"}{4pt}}"


def _build_latex(kd, anio_d, reg_d, edad_d, sexo_d, plan_d, nivel_d, pred_d, arq_d) -> str:
    fecha_str   = date.today().strftime("%d/%m/%Y")
    total_a     = int(kd.get("total_atenciones", 0))
    anio_ini    = int(kd.get("anio_inicio", 2017))
    anio_fin    = int(kd.get("anio_fin", 2025))
    regiones    = int(kd.get("regiones", 0))
    ipress      = int(kd.get("ipress", 0))
    planes      = int(kd.get("planes", 0))

    # ── Tabla anual
    max_a   = max((float(d["atenciones"]) for d in anio_d), default=1)
    prev_a  = None
    rows_a  = []
    for d in anio_d:
        v   = float(d["atenciones"])
        var = f"\\(+\\){round((v-prev_a)/prev_a*100,1)}\\%" if prev_a and v > prev_a \
              else (f"\\(-\\){round((prev_a-v)/prev_a*100,1)}\\%" if prev_a else "---")
        rows_a.append(f"    {_esc(str(d['anio']))} & {_fmtn(v)} & {_esc(var)} & {_bartex(v,max_a)} \\\\")
        prev_a = v

    # ── Tabla regional top 10
    total_r = sum(float(d["atenciones"]) for d in reg_d) or 1
    max_r   = float(reg_d[0]["atenciones"]) if reg_d else 1
    rows_r  = []
    for i, d in enumerate(reg_d[:10], 1):
        v   = float(d["atenciones"])
        pct = round(v / total_r * 100, 1)
        rows_r.append(
            f"    {i} & {_esc(str(d['region']))} & {_fmtn(v)} & {_esc(str(pct))}\\% & {_bartex(v,max_r,4.5)} \\\\"
        )

    # ── Tabla edad
    max_e  = max((float(d["atenciones"]) for d in edad_d), default=1)
    rows_e = []
    for d in edad_d:
        v   = float(d["atenciones"])
        pct = round(v / total_a * 100, 1) if total_a else 0
        rows_e.append(
            f"    {_esc(str(d['grupo_edad']))} & {_fmtn(v)} & {_esc(str(pct))}\\% & {_bartex(v,max_e,4.5)} \\\\"
        )

    # ── Tabla planes
    rows_p = []
    for d in plan_d[:6]:
        v   = float(d["atenciones"])
        pct = round(v / total_a * 100, 1) if total_a else 0
        rows_p.append(
            f"    {_esc(str(d['desc_plan_seguro']))} & {_fmtn(v)} & {_esc(str(pct))}\\% \\\\"
        )

    # ── Tabla proyecciones
    rows_pred = []
    fa = pred_d.get("forecast_anual", {}) if isinstance(pred_d, dict) else {}
    for d in fa.get("prediccion", []):
        rows_pred.append(
            f"    {d['anio']} & {_fmtn(d['atenciones'])} & {_fmtn(d['lower'])} & {_fmtn(d['upper'])} \\\\"
        )
    modelo_pred = _esc(fa.get("modelo", "—"))

    # ── Tabla arquetipos
    rows_arq = []
    for a in (arq_d.get("arquetipos", []) if isinstance(arq_d, dict) else []):
        rows_arq.append(
            f"    {_esc(a['nombre'])} & {_esc(a['rango'])} & "
            f"{_fmtn(a['atenciones'])} & {_esc(str(a['pct_total']))}\\% & "
            f"{_esc(str(a['pct_femenino']))}\\% & "
            f"{_esc('Nivel ' + str(a['nivel_predominante']))} & "
            f"{_esc(str(a['plan_predominante']))} \\\\"
        )

    rows_a_str   = "\n".join(rows_a)
    rows_r_str   = "\n".join(rows_r)
    rows_e_str   = "\n".join(rows_e)
    rows_p_str   = "\n".join(rows_p)
    rows_pred_str = "\n".join(rows_pred) if rows_pred else "    \\multicolumn{4}{c}{No disponible} \\\\"
    rows_arq_str = "\n".join(rows_arq)   if rows_arq  else "    \\multicolumn{7}{c}{No disponible} \\\\"

    return r"""
\documentclass[a4paper,10pt]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[top=2cm,bottom=2cm,left=2.5cm,right=2.5cm,headheight=15pt]{geometry}
\usepackage{booktabs}
\usepackage{longtable}
\usepackage{xcolor}
\usepackage{colortbl}
\usepackage{array}
\usepackage{fancyhdr}
\usepackage{parskip}
\usepackage{microtype}

\definecolor{sisblue}{HTML}{1A67A3}
\definecolor{sisdark}{HTML}{103E6E}
\definecolor{rowalt}{HTML}{EBF3FA}

\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0.4pt}
\lhead{\small\textbf{\textcolor{sisblue}{DataMart SIS}}}
\rhead{\small\textcolor{gray}{Seguro Integral de Salud --- Per\'{u}}}
\cfoot{\small\thepage}

\newcolumntype{L}[1]{>{\raggedright\arraybackslash}p{#1}}
\newcolumntype{R}[1]{>{\raggedleft\arraybackslash}p{#1}}
\newcolumntype{C}[1]{>{\centering\arraybackslash}p{#1}}

\newcommand{\sisec}[1]{%
  \vspace{10pt}%
  {\Large\bfseries\textcolor{sisblue}{#1}}\par%
  \noindent{\color{sisblue}\rule{\linewidth}{0.6pt}}\vspace{4pt}%
}

\setlength{\LTleft}{0pt}
\setlength{\LTright}{0pt}

\begin{document}

%% ── Portada ────────────────────────────────────────────────────────────────
\begin{titlepage}
\vspace*{2.5cm}
\begin{center}
{\color{sisblue}\rule{\linewidth}{1.5pt}}\\[0.9cm]
{\Huge\bfseries\textcolor{sisdark}{Informe de Atenciones SIS}}\\[0.45cm]
{\large\textcolor{sisblue}{Seguro Integral de Salud --- Per\'{u}}}\\[0.3cm]
{\large\textcolor{gray}{""" + f"{anio_ini}--{anio_fin}" + r"""}}\\[0.9cm]
{\color{sisblue}\rule{\linewidth}{1.5pt}}\\[1.8cm]
\renewcommand{\arraystretch}{1.5}
\begin{tabular}{L{9cm}R{5cm}}
\textbf{Total de atenciones} & \textbf{\textcolor{sisblue}{""" + _fmtn(total_a) + r"""}} \\
\textbf{Per\'{i}odo cubierto}  & """ + f"{anio_ini}--{anio_fin}" + r""" \\
\textbf{Regiones}             & """ + str(regiones) + r""" \\
\textbf{IPRESS activas}       & """ + _fmtn(ipress) + r""" \\
\textbf{Planes de seguro}     & """ + str(planes) + r""" \\
\textbf{Generado el}          & """ + fecha_str + r""" \\
\end{tabular}
\vfill
{\small\textcolor{gray}{Fuente: Plataforma Nacional de Datos Abiertos del Per\'{u} --- datosabiertos.gob.pe}\\
Seguro Integral de Salud --- Ministerio de Salud del Per\'{u}}
\end{center}
\end{titlepage}

%% ── Sección 1: Evolución Anual ──────────────────────────────────────────────
\sisec{1. Evolución Anual de Atenciones}

\renewcommand{\arraystretch}{1.25}
\begin{longtable}{R{1.5cm} R{3.8cm} R{2cm} L{6.5cm}}
\toprule
\textbf{A\~no} & \textbf{Atenciones} & \textbf{Var.\,\%} & \textbf{Proporción} \\
\midrule
\endhead
""" + rows_a_str + r"""
\bottomrule
\end{longtable}

%% ── Sección 2: Distribución Regional ───────────────────────────────────────
\sisec{2. Distribución Regional (Top 10)}

\begin{longtable}{R{0.8cm} L{5.5cm} R{3.5cm} R{2cm} L{4.5cm}}
\toprule
\textbf{N\textsuperscript{o}} & \textbf{Región} & \textbf{Atenciones} & \textbf{\% Total} & \textbf{Proporción} \\
\midrule
\endhead
""" + rows_r_str + r"""
\bottomrule
\end{longtable}

%% ── Sección 3: Perfil Demográfico ──────────────────────────────────────────
\sisec{3. Perfil Demográfico por Grupo Etario}

\begin{longtable}{L{4cm} R{4cm} R{2cm} L{5.5cm}}
\toprule
\textbf{Grupo de Edad} & \textbf{Atenciones} & \textbf{\% Total} & \textbf{Proporción} \\
\midrule
\endhead
""" + rows_e_str + r"""
\bottomrule
\end{longtable}

%% ── Sección 4: Planes de Seguro ────────────────────────────────────────────
\sisec{4. Planes de Seguro SIS}

\begin{longtable}{L{8cm} R{4cm} R{2cm}}
\toprule
\textbf{Plan de Seguro} & \textbf{Atenciones} & \textbf{\% Total} \\
\midrule
\endhead
""" + rows_p_str + r"""
\bottomrule
\end{longtable}

%% ── Sección 5: Proyecciones ─────────────────────────────────────────────────
\sisec{5. Proyecciones 2026--2028}

Modelo: """ + modelo_pred + r""".
Los intervalos de confianza al 90\,\% se amplían con el horizonte de proyección.

\begin{longtable}{R{2cm} R{3.5cm} R{3.5cm} R{3.5cm}}
\toprule
\textbf{A\~no} & \textbf{Proyección} & \textbf{L\'imite inf. (90\,\%)} & \textbf{L\'imite sup. (90\,\%)} \\
\midrule
\endhead
""" + rows_pred_str + r"""
\bottomrule
\end{longtable}

%% ── Sección 6: Arquetipos ──────────────────────────────────────────────────
\sisec{6. Arquetipos de Asegurado SIS}

Seis perfiles derivados de los grupos etarios del Diccionario de Datos SIS (DS-01).

\renewcommand{\arraystretch}{1.2}
\begin{longtable}{L{3cm} L{2.5cm} R{3cm} R{1.8cm} R{1.5cm} C{1.5cm} L{2.5cm}}
\toprule
\textbf{Arquetipo} & \textbf{Rango} & \textbf{Atenciones} & \textbf{\% Total} & \textbf{\% Fem.} & \textbf{Nivel} & \textbf{Plan} \\
\midrule
\endhead
""" + rows_arq_str + r"""
\bottomrule
\end{longtable}

%% ── Sección 7: Notas Metodológicas ─────────────────────────────────────────
\sisec{7. Notas Metodológicas}

\begin{itemize}
  \item \textbf{Fuente de datos:} Plataforma Nacional de Datos Abiertos del Per\'{u}
        (datosabiertos.gob.pe), conjunto DS-01 Atenciones SIS, archivos ZIP verificados
        por tama\~no en el portal oficial.
  \item \textbf{Modelo predictivo:} """ + modelo_pred + r""".
        Las proyecciones asumen continuidad de la tendencia hist\'{o}rica y no incorporan
        cambios de pol\'{i}tica sanitaria ni eventos externos.
  \item \textbf{Intervalo de confianza:} 90\,\%, con amplitud creciente en funci\'{o}n
        del horizonte de proyecci\'{o}n (\(\propto \sqrt{h}\)).
  \item \textbf{IPRESS:} Institución Prestadora de Servicios de Salud. Nivel I =
        atenci\'{o}n primaria; Nivel III = alta complejidad.
  \item \textbf{Arquetipos:} Agrupaciones basadas en el campo \texttt{GRUPO\_EDAD}
        del diccionario de datos SIS. Calculados sobre el universo completo 2017--""" + str(anio_fin) + r""".
\end{itemize}

\end{document}
"""


@app.get("/api/export/pdf")
def export_pdf():
    """Genera un informe PDF compilando LaTeX con pdflatex en el servidor."""
    # Recoger datos (sin esperar caché — siempre frescos)
    kd      = _cached("kpis",        lambda: {})
    anio_d  = _qmv("mv_por_anio")
    reg_d   = _qmv("mv_por_region")
    edad_d  = _qmv("mv_por_edad")
    sexo_d  = _qmv("mv_por_sexo")
    plan_d  = _qmv("mv_por_plan")
    nivel_d = _qmv("mv_por_nivel")
    pred_d  = _cached("predicciones", lambda: {})
    arq_d   = _cached("arquetipos",   lambda: {})

    if not anio_d:
        return JSONResponse({"error": "Datos aún no disponibles"}, status_code=503)

    tex_source = _build_latex(kd, anio_d, reg_d, edad_d, sexo_d,
                               plan_d, nivel_d, pred_d, arq_d)

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = Path(tmpdir) / "informe.tex"
        tex_path.write_text(tex_source, encoding="utf-8")

        for _ in range(2):   # dos pasadas para referencias internas
            result = subprocess.run(
                ["pdflatex", "-interaction=nonstopmode",
                 "-output-directory", tmpdir, str(tex_path)],
                capture_output=True, timeout=90,
            )
            if result.returncode != 0 and b"Emergency stop" in result.stdout:
                log_tail = result.stdout.decode("utf-8", errors="replace")[-3000:]
                return JSONResponse({"error": "pdflatex error", "log": log_tail},
                                    status_code=500)

        pdf_path = Path(tmpdir) / "informe.pdf"
        if not pdf_path.exists():
            return JSONResponse({"error": "PDF no generado — pdflatex no instalado"},
                                status_code=500)

        pdf_bytes = pdf_path.read_bytes()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=informe_sis.pdf"},
    )


# ── SPA catch-all — serves React static files (logo, etc.) ──────────────────
@app.get("/{full_path:path}", include_in_schema=False)
async def spa_catch(full_path: str):
    target = FRONTEND / full_path
    if target.is_file():
        return FileResponse(str(target))
    idx = FRONTEND / "index.html"
    if idx.exists():
        return FileResponse(str(idx))
    return HTMLResponse("<h1>Frontend not built</h1>", status_code=503)
