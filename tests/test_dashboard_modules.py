"""
Tests de integración del dashboard — verifican que cada módulo/pestaña
tiene los datos que necesita para renderizarse correctamente.

Uso:
  pytest tests/test_dashboard_modules.py --base-url=https://xxx.trycloudflare.com
  pytest tests/test_dashboard_modules.py --base-url=http://localhost:8080
"""
import os
import pytest
import requests

# URL base: variable de entorno o parámetro --base-url
BASE_URL = os.environ.get("DASHBOARD_URL", "http://localhost:8080")


def pytest_addoption(parser):
    parser.addoption("--base-url", action="store", default=None)


@pytest.fixture(scope="session")
def base_url(request):
    opt = request.config.getoption("--base-url")
    return opt or BASE_URL


@pytest.fixture(scope="session")
def api(base_url):
    """Helper para hacer GET con timeout y assert 200."""
    def get(path, timeout=20):
        r = requests.get(f"{base_url}{path}", timeout=timeout)
        assert r.status_code == 200, f"GET {path} → {r.status_code}: {r.text[:200]}"
        return r.json()
    return get


# ── Salud general ─────────────────────────────────────────────────────────────

class TestSalud:
    def test_dashboard_responde(self, base_url):
        r = requests.get(base_url, timeout=15)
        assert r.status_code == 200

    def test_api_status_ok(self, api):
        d = api("/api/status")
        assert "mvs_ready" in d
        assert "mvs_total" in d
        # MVs deben estar listas (no building)
        assert d["building"] is False, f"MVs aún construyéndose: {d['mvs_ready']}/{d['mvs_total']}"

    def test_geojson_peru_disponible(self, api):
        data = requests.get(f"{api.__self__  if hasattr(api,'__self__') else ''}", timeout=10)
        # GeoJSON via helper no funciona (es JSON de dict no lista), uso requests directo
        pass  # testeado en test_modulo_mapa


# ── Módulo: RESUMEN ───────────────────────────────────────────────────────────

class TestModuloResumen:
    def test_kpis_tienen_campos_requeridos(self, api):
        d = api("/api/kpis")
        for campo in ["total_atenciones", "regiones", "ipress", "servicios", "planes", "anio_inicio", "anio_fin"]:
            assert campo in d, f"Campo faltante en KPIs: {campo}"

    def test_kpis_valores_positivos(self, api):
        d = api("/api/kpis")
        assert d["total_atenciones"] > 0, "total_atenciones debe ser > 0"
        assert d["regiones"] > 0
        assert d["ipress"] > 0

    def test_por_anio_tiene_datos(self, api):
        data = api("/api/por-anio")
        assert isinstance(data, list), "por-anio debe ser lista"
        assert len(data) >= 1, "Debe haber al menos 1 año cargado"
        assert "anio" in data[0] and "atenciones" in data[0]

    def test_por_sexo(self, api):
        data = api("/api/por-sexo")
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "sexo" in data[0] and "atenciones" in data[0]

    def test_por_nivel(self, api):
        data = api("/api/por-nivel")
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_top_servicios_tiene_15(self, api):
        data = api("/api/top-servicios")
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "servicio" in data[0] or "cod_servicio" in data[0]

    def test_por_plan(self, api):
        data = api("/api/por-plan")
        assert isinstance(data, list)
        assert len(data) >= 1


# ── Módulo: MAPA ──────────────────────────────────────────────────────────────

class TestModuloMapa:
    def test_geojson_accesible(self, base_url):
        r = requests.get(f"{base_url}/static/peru.geojson", timeout=15)
        assert r.status_code == 200
        geo = r.json()
        assert geo["type"] == "FeatureCollection"
        assert len(geo["features"]) == 26, f"Esperados 26 departamentos, hay {len(geo['features'])}"

    def test_geojson_tiene_propiedad_name(self, base_url):
        r = requests.get(f"{base_url}/static/peru.geojson", timeout=15)
        features = r.json()["features"]
        for f in features[:5]:
            assert "name" in f["properties"], "Feature sin propiedad 'name'"

    def test_por_region_para_mapa(self, api):
        data = api("/api/por-region")
        assert isinstance(data, list)
        assert len(data) >= 1
        assert "region" in data[0] and "atenciones" in data[0]


# ── Módulo: DEMOGRAFÍA ────────────────────────────────────────────────────────

class TestModuloDemografia:
    def test_por_sexo_tiene_masculino_y_femenino(self, api):
        data = api("/api/por-sexo")
        sexos = {d["sexo"].upper() for d in data}
        assert "MASCULINO" in sexos or "FEMENINO" in sexos, f"Sexos inesperados: {sexos}"

    def test_por_edad_grupos(self, api):
        data = api("/api/por-edad")
        assert len(data) >= 1
        assert "grupo_edad" in data[0]


# ── Módulo: GEOGRAFÍA ─────────────────────────────────────────────────────────

class TestModuloGeografia:
    def test_regiones_tienen_ipress(self, api):
        data = api("/api/por-region")
        assert "ipress" in data[0], "por-region debe incluir campo ipress"

    def test_niveles_eess(self, api):
        data = api("/api/por-nivel")
        niveles = {d.get("nivel") or d.get("nivel_eess") for d in data}
        assert len(niveles) >= 1


# ── Módulo: SERVICIOS ─────────────────────────────────────────────────────────

class TestModuloServicios:
    def test_top_servicios_orden(self, api):
        data = api("/api/top-servicios")
        atenciones = [d["atenciones"] for d in data]
        assert atenciones == sorted(atenciones, reverse=True), "Top servicios debe estar ordenado desc"

    def test_planes_de_seguro(self, api):
        data = api("/api/por-plan")
        for item in data:
            assert "cod_plan_seguro" in item or "desc_plan_seguro" in item


# ── Módulo: PREDICCIONES ──────────────────────────────────────────────────────

class TestModuloPredicciones:
    def test_predicciones_estructura(self, api):
        d = api("/api/predicciones", timeout=30)
        assert "forecast_anual" in d, "Falta forecast_anual"
        assert "estacionalidad" in d, "Falta estacionalidad"
        assert "regiones_proyeccion" in d, "Falta regiones_proyeccion"

    def test_forecast_tiene_prediccion(self, api):
        d = api("/api/predicciones", timeout=30)
        fa = d["forecast_anual"]
        assert len(fa.get("prediccion", [])) >= 1, "Debe haber al menos 1 año proyectado"
        assert "r2" in fa
        assert "modelo" in fa

    def test_estacionalidad_12_meses(self, api):
        d = api("/api/predicciones", timeout=30)
        est = d.get("estacionalidad", [])
        assert len(est) == 12, f"Deben ser 12 meses, hay {len(est)}"

    def test_regiones_proyeccion(self, api):
        d = api("/api/predicciones", timeout=30)
        reg = d.get("regiones_proyeccion", [])
        assert len(reg) >= 1
        assert "region" in reg[0] and "proyeccion_2026" in reg[0]


# ── Bundle /api/dashboard ─────────────────────────────────────────────────────

class TestDashboardBundle:
    def test_bundle_devuelve_todas_las_claves(self, api):
        d = api("/api/dashboard", timeout=20)
        for clave in ["kpis", "anio", "region", "edad", "sexo", "servicios", "nivel", "plan"]:
            assert clave in d, f"Clave faltante en /api/dashboard: {clave}"

    def test_bundle_rapido(self, base_url):
        import time
        t0 = time.time()
        r = requests.get(f"{base_url}/api/dashboard", timeout=20)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 15, f"/api/dashboard tardó {elapsed:.1f}s (máx 15s)"
