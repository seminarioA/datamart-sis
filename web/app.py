"""
DataMart SIS — Dashboard API
Cache en 3 capas: JSON en disco → memoria → PostgreSQL MV.
Reinicio = respuesta instantánea desde JSON (sin esperar re-build de MVs).

Invariante de disponibilidad del cache L3: el valor servido para una key
SIEMPRE debe existir (una vez calculado por primera vez) y solo se reemplaza
cuando el nuevo valor completo ya fue calculado con éxito. Nunca se borra
un valor cacheado antes de tener el reemplazo listo.
"""
import json
import logging
import os
import re
import threading
import time
from pathlib import Path

import math
import psycopg2
import psycopg2.extras
import psycopg2.pool
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("datamart_sis")


class DatabaseUnavailableError(Exception):
    """La BD no respondió correctamente a una query."""


DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL no está configurada. Define la variable de entorno "
        "antes de iniciar la app (ver .env.example). No hay default: "
        "conectarse silenciosamente a una BD equivocada es peor que fallar rápido."
    )

STATIC       = Path(__file__).parent / "static"
FRONTEND     = Path(__file__).parent / "frontend" / "dist"
CACHE_DIR    = Path(__file__).parent.parent / "cache"
CACHE_DIR.mkdir(exist_ok=True)

# ── Configuración operacional (todo vía env, nada hardcodeado) ────────────────
MEM_TTL              = int(os.environ.get("CACHE_MEM_TTL_SECONDS", "900"))
DISK_TTL             = int(os.environ.get("CACHE_DISK_TTL_SECONDS", "3600"))
MV_REFRESH_INTERVAL  = int(os.environ.get("MV_REFRESH_INTERVAL_SECONDS", "600"))
DB_CONNECT_TIMEOUT   = int(os.environ.get("DB_CONNECT_TIMEOUT_SECONDS", "10"))
DB_POOL_MIN          = int(os.environ.get("DB_POOL_MIN", "1"))
DB_POOL_MAX          = int(os.environ.get("DB_POOL_MAX", "10"))
TOP_SERVICIOS_LIMIT  = int(os.environ.get("TOP_SERVICIOS_LIMIT", "15"))

_WORK_MEM_RE = re.compile(r"^\d+(kB|MB|GB)$")


def _safe_work_mem(value: str, default: str) -> str:
    return value if _WORK_MEM_RE.match(value) else default


DB_WORK_MEM = _safe_work_mem(os.environ.get("DB_WORK_MEM", "256MB"), "256MB")

app = FastAPI(title="DataMart SIS")
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")
if (FRONTEND / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND / "assets")), name="assets")


@app.exception_handler(DatabaseUnavailableError)
async def _db_unavailable_handler(request: Request, exc: DatabaseUnavailableError):
    return JSONResponse(
        status_code=503,
        content={"error": "Database unavailable", "detail": str(exc)},
    )


# ── Connection pool ──────────────────────────────────────────────────────────────
_pool = psycopg2.pool.ThreadedConnectionPool(
    DB_POOL_MIN, DB_POOL_MAX, DATABASE_URL, connect_timeout=DB_CONNECT_TIMEOUT
)

# ── Cache en 3 capas ────────────────────────────────────────────────────────────
# L1: dict en memoria (sub-ms)
# L2: archivo JSON en disco (persiste entre reinicios, ms)
# L3: PostgreSQL MV (fuente de verdad, segundos)
_mem: dict = {}
_mem_lock = threading.Lock()


def _disk_read(key: str):
    p = CACHE_DIR / f"{key}.json"
    if not p.exists():
        return None
    if time.time() - p.stat().st_mtime > DISK_TTL:
        return None
    try:
        return json.loads(p.read_text())
    except Exception as e:
        log.warning("cache: no se pudo leer %s del disco: %s", key, e)
        return None


def _disk_write(key: str, data) -> None:
    """Escritura atómica: nunca deja el archivo en un estado a medio escribir."""
    final_path = CACHE_DIR / f"{key}.json"
    tmp_path = CACHE_DIR / f"{key}.json.tmp-{os.getpid()}"
    try:
        tmp_path.write_text(json.dumps(data, ensure_ascii=False, default=str))
        os.replace(tmp_path, final_path)  # atómico a nivel de SO
    except Exception as e:
        log.error("cache: no se pudo escribir %s en disco: %s", key, e)
        tmp_path.unlink(missing_ok=True)


def _is_error_shaped(value) -> bool:
    return isinstance(value, dict) and "error" in value


def _cached(key: str, fn):
    now = time.time()
    # L1 — memoria
    with _mem_lock:
        entry = _mem.get(key)
    if entry is not None and now - entry["ts"] < MEM_TTL:
        return entry["data"]
    # L2 — disco
    disk = _disk_read(key)
    if disk is not None:
        with _mem_lock:
            _mem[key] = {"ts": now, "data": disk}
        return disk
    # L3 — base de datos. Si fn() lanza, propaga (no cachear una excepción)
    # y NO se pisa ningún valor previo — el llamador decide qué responder.
    result = fn()
    if _is_error_shaped(result):
        # No cachear respuestas de error: la próxima request debe reintentar,
        # no quedar "pegada" a un error transitorio hasta que expire el TTL.
        log.warning("cache: %s devolvió un resultado de error, no se cachea: %s", key, result)
        return result
    with _mem_lock:
        _mem[key] = {"ts": now, "data": result}
    _disk_write(key, result)
    return result


def _swap_cache(key: str, value) -> None:
    """Reemplaza el valor cacheado por uno YA CALCULADO Y COMPLETO.
    Nunca borra el valor anterior antes de tener este listo — swap atómico."""
    if _is_error_shaped(value):
        log.error("cache: se intentó swap de %s con un resultado de error, se descarta", key)
        return
    now = time.time()
    with _mem_lock:
        _mem[key] = {"ts": now, "data": value}
    _disk_write(key, value)


def _q(sql: str, params=None) -> list[dict]:
    c = _pool.getconn()
    try:
        with c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(f"SET work_mem = '{DB_WORK_MEM}'")
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
    except Exception as e:
        log.error("query falló (%s): %.300s", type(e).__name__, sql, exc_info=True)
        raise DatabaseUnavailableError(f"{type(e).__name__}: {e}") from e
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
# Cada MV tiene una(s) columna(s) únicas para poder usar REFRESH ... CONCURRENTLY,
# que no toma lock exclusivo: los lectores siguen viendo la versión anterior
# completa mientras se calcula la nueva, y el swap final es atómico. Esto es lo
# que garantiza que el cache L3 esté siempre disponible durante un refresh.
_MV_SQLS = {
    "mv_kpis": """
        SELECT 1 AS mv_row_id,
               COALESCE(SUM(cantidad_atenciones),0) AS total_atenciones,
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
    "mv_top_servicios": f"""
        SELECT f.cod_servicio,
               COALESCE(s.desc_servicio, f.cod_servicio) AS servicio,
               SUM(f.cantidad_atenciones) AS atenciones
        FROM datamart_sis.fact_atenciones_sis f
        LEFT JOIN datamart_sis.dim_servicio s ON s.cod_servicio = f.cod_servicio
        GROUP BY f.cod_servicio, s.desc_servicio
        ORDER BY atenciones DESC LIMIT {TOP_SERVICIOS_LIMIT}
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

# Columnas que identifican unívocamente cada fila de la MV — requerido por
# REFRESH MATERIALIZED VIEW CONCURRENTLY.
_MV_UNIQUE_COLS = {
    "mv_kpis": ["mv_row_id"],
    "mv_por_anio": ["anio"],
    "mv_por_region": ["region"],
    "mv_por_edad": ["grupo_edad"],
    "mv_por_sexo": ["sexo"],
    "mv_top_servicios": ["cod_servicio"],
    "mv_por_nivel": ["nivel_eess"],
    "mv_por_plan": ["cod_plan_seguro"],
    "mv_por_mes": ["anio", "mes"],
}

_MV_READY: dict[str, bool] = {k: False for k in _MV_SQLS}
_MV_LAST_ERROR: dict[str, str | None] = {k: None for k in _MV_SQLS}
_MV_LAST_REFRESH: float = 0.0

# ── Registro único de "cómo se calcula cada key de cache" ─────────────────────
# Reutilizado por las rutas HTTP, por _build_mvs() (para recalcular tras un
# refresh exitoso, sin dejar nunca una ventana sin valor) y por _warm_cache().
_DIM_SUMMARY_SQL = """
    SELECT
        (SELECT COUNT(DISTINCT cod_region) FROM datamart_sis.dim_ubicacion) AS regiones,
        (SELECT COUNT(*) FROM datamart_sis.dim_ipress)                      AS ipress,
        (SELECT COUNT(*) FROM datamart_sis.dim_servicio)                    AS servicios,
        (SELECT COUNT(*) FROM datamart_sis.dim_plan_seguro)                 AS planes,
        (SELECT MIN(anio) FROM datamart_sis.dim_tiempo)                     AS anio_inicio,
        (SELECT MAX(anio) FROM datamart_sis.dim_tiempo)                     AS anio_fin
"""


def _qmv(mv_name: str) -> list[dict]:
    if not _MV_READY.get(mv_name):
        return []
    return _q(f"SELECT * FROM datamart_sis.{mv_name}")


def _fetch_kpis():
    fact = _qmv("mv_kpis")
    dim = _q(_DIM_SUMMARY_SQL)
    return {**(fact[0] if fact else {}), **(dim[0] if dim else {})}


def _fetch_dashboard():
    return {
        "kpis":      _fetch_kpis(),
        "anio":      _qmv("mv_por_anio"),
        "region":    _qmv("mv_por_region"),
        "edad":      _qmv("mv_por_edad"),
        "sexo":      _qmv("mv_por_sexo"),
        "servicios": _qmv("mv_top_servicios"),
        "nivel":     _qmv("mv_por_nivel"),
        "plan":      _qmv("mv_por_plan"),
    }


_CACHE_FETCHERS = {
    "kpis":           _fetch_kpis,
    "por_anio":       lambda: _qmv("mv_por_anio"),
    "por_region":     lambda: _qmv("mv_por_region"),
    "por_edad":       lambda: _qmv("mv_por_edad"),
    "por_sexo":       lambda: _qmv("mv_por_sexo"),
    "top_servicios":  lambda: _qmv("mv_top_servicios"),
    "por_nivel":      lambda: _qmv("mv_por_nivel"),
    "por_plan":       lambda: _qmv("mv_por_plan"),
    "dashboard":      _fetch_dashboard,
}


def _refresh_cache_key(key: str) -> None:
    """Recalcula una key y hace swap atómico. Si falla, el valor anterior
    sigue sirviendo intacto — nunca se borra sin tener el reemplazo listo."""
    fetcher = _CACHE_FETCHERS.get(key)
    if fetcher is None:
        return
    try:
        new_value = fetcher()
    except DatabaseUnavailableError as e:
        log.error("cache: no se pudo recalcular '%s' tras refresh de MV: %s", key, e)
        return
    _swap_cache(key, new_value)


def _build_mvs(refresh: bool = False):
    global _MV_LAST_REFRESH
    any_refreshed = False
    try:
        c = psycopg2.connect(DATABASE_URL, connect_timeout=DB_CONNECT_TIMEOUT)
        c.autocommit = True
        with c.cursor() as cur:
            cur.execute(f"SET work_mem = '{DB_WORK_MEM}'")
            for name, sql in _MV_SQLS.items():
                started = time.time()
                try:
                    if refresh:
                        try:
                            cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY datamart_sis.{name}")
                        except Exception as e:
                            # CONCURRENTLY puede fallar si aún no existe el índice único
                            # (ej. MV creada por una versión anterior del código).
                            # Recrear el índice y reintentar antes de degradar.
                            log.warning(
                                "MV %s: REFRESH CONCURRENTLY falló (%s), "
                                "reintentando tras asegurar índice único", name, e
                            )
                            cols = ", ".join(_MV_UNIQUE_COLS[name])
                            cur.execute(
                                f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{name} "
                                f"ON datamart_sis.{name} ({cols})"
                            )
                            cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY datamart_sis.{name}")
                        _MV_READY[name] = True
                        _MV_LAST_ERROR[name] = None
                        any_refreshed = True
                        log.info("MV %s refrescada en %.2fs", name, time.time() - started)
                        _refresh_cache_key(name[3:])
                    else:
                        cur.execute(
                            "SELECT EXISTS(SELECT FROM pg_matviews "
                            "WHERE schemaname='datamart_sis' AND matviewname=%s)",
                            (name,)
                        )
                        if cur.fetchone()[0]:
                            _MV_READY[name] = True
                            _MV_LAST_ERROR[name] = None
                            log.info("MV %s ya existía, lista de inmediato", name)
                        else:
                            cur.execute(
                                f"CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.{name} AS {sql}"
                            )
                            cols = ", ".join(_MV_UNIQUE_COLS[name])
                            cur.execute(
                                f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{name} "
                                f"ON datamart_sis.{name} ({cols})"
                            )
                            _MV_READY[name] = True
                            _MV_LAST_ERROR[name] = None
                            log.info("MV %s creada en %.2fs", name, time.time() - started)
                except Exception as e:
                    _MV_LAST_ERROR[name] = f"{type(e).__name__}: {e}"
                    log.error("MV %s falló (%s): %s", name, type(e).__name__, e, exc_info=True)
        c.close()
        _MV_LAST_REFRESH = time.time()
        if any_refreshed:
            # El bundle "dashboard" se recalcula UNA sola vez al final del ciclo,
            # no una vez por cada MV — evita thundering herd y cold-cache 8x/9x.
            _refresh_cache_key("dashboard")
    except Exception as e:
        log.error("_build_mvs: no se pudo conectar/operar sobre la BD: %s", e, exc_info=True)
    finally:
        threading.Timer(MV_REFRESH_INTERVAL, _build_mvs, kwargs={"refresh": True}).start()


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
        "errors": {k: v for k, v in _MV_LAST_ERROR.items() if v},
    }


@app.get("/api/kpis")
def kpis():
    return _cached("kpis", _fetch_kpis)


@app.get("/api/por-anio")
def por_anio():
    return _cached("por_anio", _CACHE_FETCHERS["por_anio"])


@app.get("/api/por-region")
def por_region():
    return _cached("por_region", _CACHE_FETCHERS["por_region"])


@app.get("/api/por-edad")
def por_edad():
    return _cached("por_edad", _CACHE_FETCHERS["por_edad"])


@app.get("/api/por-sexo")
def por_sexo():
    return _cached("por_sexo", _CACHE_FETCHERS["por_sexo"])


@app.get("/api/top-servicios")
def top_servicios():
    return _cached("top_servicios", _CACHE_FETCHERS["top_servicios"])


@app.get("/api/por-nivel")
def por_nivel():
    return _cached("por_nivel", _CACHE_FETCHERS["por_nivel"])


@app.get("/api/por-plan")
def por_plan():
    return _cached("por_plan", _CACHE_FETCHERS["por_plan"])


# ── Endpoint bundled: devuelve todo en 1 llamada (evita 8 round-trips por cloudflared) ──
@app.get("/api/dashboard")
def dashboard():
    """Todos los datos del dashboard en una sola respuesta."""
    return _cached("dashboard", _fetch_dashboard)


# ── Pre-calentar cache al inicio (en background, después de que las MVs estén listas) ──
def _warm_cache():
    """Ejecuta todas las queries una vez para poblar L1+L2 cache."""
    log.info("cache warmup: esperando a que las MVs estén listas...")
    waited = 0
    for _ in range(60):
        if all(_MV_READY.values()):
            break
        time.sleep(10)
        waited += 10
    if not any(_MV_READY.values()):
        log.warning("cache warmup: timeout tras %ss esperando MVs, ninguna lista", waited)
        return
    log.info("cache warmup: MVs listas tras %ss, poblando cache...", waited)
    ok, failed = 0, []
    for key, fetcher in _CACHE_FETCHERS.items():
        try:
            _cached(key, fetcher)
            ok += 1
        except DatabaseUnavailableError as e:
            failed.append(key)
            log.error("cache warmup: falló '%s': %s", key, e)
    log.info("cache warmup terminado: %d/%d keys pobladas (fallaron: %s)",
              ok, len(_CACHE_FETCHERS), failed or "ninguna")


threading.Thread(target=_warm_cache, daemon=True).start()


# ── Analítica predictiva ──────────────────────────────────────────────────────
@app.get("/api/predicciones")
def predicciones():
    def _fetch():
        try:
            import numpy as np
            from sklearn.linear_model import LinearRegression
            from sklearn.metrics import r2_score, mean_squared_error
        except ImportError:
            log.error("predicciones: numpy/sklearn no instalados")
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
    frontend_root = FRONTEND.resolve()
    target = (FRONTEND / full_path).resolve()
    if target.is_relative_to(frontend_root) and target.is_file():
        return FileResponse(str(target))
    idx = FRONTEND / "index.html"
    if idx.exists():
        return FileResponse(str(idx))
    return HTMLResponse("<h1>Frontend not built</h1>", status_code=503)
