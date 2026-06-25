"""
DataMart SIS — Dashboard API
Cache en 3 capas: JSON en disco → memoria → PostgreSQL MV.
Reinicio = respuesta instantánea desde JSON (sin esperar re-build de MVs).
"""
import json
import math
import threading
import time
from pathlib import Path

import psycopg2
import psycopg2.extras
import psycopg2.pool
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

import os
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://datamart:FTNIdAQSBTZ5zloaSGl11L4@localhost:5433/datamart_sis"
)
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
MEM_TTL  = 900   # 15 min en memoria
DISK_TTL = 3600  # 1 h en disco


def _disk_read(key: str):
    p = CACHE_DIR / f"{key}.json"
    if not p.exists():
        return None
    if time.time() - p.stat().st_mtime > DISK_TTL:
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def _disk_write(key: str, data):
    try:
        (CACHE_DIR / f"{key}.json").write_text(
            json.dumps(data, ensure_ascii=False, default=str)
        )
    except Exception:
        pass


def _cached(key: str, fn):
    now = time.time()
    # L1 — memoria
    if key in _mem and now - _mem[key]["ts"] < MEM_TTL:
        return _mem[key]["data"]
    # L2 — disco
    disk = _disk_read(key)
    if disk is not None:
        _mem[key] = {"ts": now, "data": disk}
        return disk
    # L3 — base de datos
    result = fn()
    _mem[key] = {"ts": now, "data": result}
    _disk_write(key, result)
    return result


def _invalidate(key: str):
    _mem.pop(key, None)
    (CACHE_DIR / f"{key}.json").unlink(missing_ok=True)


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
    if path.startswith("/api/") and path not in ("/api/status",):
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    elif path == "/api/status":
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
            from sklearn.linear_model import LinearRegression
            from sklearn.metrics import r2_score, mean_squared_error
            from sklearn.preprocessing import PolynomialFeatures
            from sklearn.pipeline import make_pipeline
        except ImportError:
            return {"error": "numpy/sklearn no instalados"}

        # ── 1. Forecast anual (Regresión Lineal OLS) ─────────────────────────
        anio_data = _qmv("mv_por_anio")
        if not anio_data:
            return {"error": "Datos no disponibles aún"}

        X = np.array([int(d["anio"]) for d in anio_data]).reshape(-1, 1)
        y = np.array([float(d["atenciones"]) for d in anio_data])

        # Regresión lineal simple (robusta con 9 puntos)
        lin = LinearRegression().fit(X, y)
        y_pred_hist = lin.predict(X)
        r2   = r2_score(y, y_pred_hist)
        rmse = math.sqrt(mean_squared_error(y, y_pred_hist))
        std  = float(np.std(y - y_pred_hist))

        max_anio = int(max(d["anio"] for d in anio_data))
        future_years = list(range(max_anio + 1, max_anio + 4))
        X_fut = np.array(future_years).reshape(-1, 1)
        y_fut = lin.predict(X_fut)

        historico = [
            {"anio": int(d["anio"]), "atenciones": int(d["atenciones"]),
             "tendencia": round(float(p)), "tipo": "real"}
            for d, p in zip(anio_data, y_pred_hist)
        ]
        prediccion_anual = [
            {"anio": yr, "atenciones": round(float(v)),
             "lower": round(max(0.0, float(v) - 1.645 * std)),
             "upper": round(float(v) + 1.645 * std),
             "tipo": "prediccion"}
            for yr, v in zip(future_years, y_fut)
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
            nombres = ["","Ene","Feb","Mar","Abr","May","Jun",
                       "Jul","Ago","Sep","Oct","Nov","Dic"]
            estacionalidad = [
                {
                    "mes": m, "nombre": nombres[m],
                    "promedio": round(promedios[m]),
                    "indice": round(promedios[m] / media_global * 100),
                }
                for m in sorted(promedios)
            ]

        # ── 3. Proyección regional (top 10) ──────────────────────────────────
        region_data = _qmv("mv_por_region")
        regiones_proy = []
        if region_data:
            total = sum(float(d["atenciones"]) for d in region_data) or 1
            # Tasa de crecimiento anual compuesta del modelo global
            cagr = float(lin.coef_[0]) / float(np.mean(y))
            regiones_proy = [
                {
                    "region": d["region"],
                    "atenciones": int(float(d["atenciones"])),
                    "proyeccion_2026": round(float(d["atenciones"]) * (1 + cagr)),
                    "crecimiento_pct": round(cagr * 100, 1),
                    "share_pct": round(float(d["atenciones"]) / total * 100, 1),
                }
                for d in region_data[:10]
            ]

        # ── 4. Resumen del modelo ─────────────────────────────────────────────
        slope = float(lin.coef_[0])
        return {
            "forecast_anual": {
                "historico": historico,
                "prediccion": prediccion_anual,
                "modelo": "Regresion Lineal OLS",
                "r2": round(r2, 3),
                "rmse": round(rmse),
                "pendiente_anual": round(slope),
                "tendencia": "creciente" if slope > 0 else "decreciente",
                "interpretacion": (
                    f"El modelo explica el {round(r2*100,1)}% de la varianza histórica. "
                    f"Se proyecta un {'aumento' if slope > 0 else 'descenso'} de "
                    f"{abs(round(slope/1e6,2))}M atenciones por año."
                ),
            },
            "estacionalidad": estacionalidad,
            "regiones_proyeccion": regiones_proy,
        }
    return _cached("predicciones", _fetch)


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
