"""
Tests de integración del dashboard — verifican que cada módulo/pestaña
tiene los datos necesarios para renderizarse correctamente.

Uso local:
  pytest tests/ --base-url=https://xxx.trycloudflare.com -v
  DASHBOARD_URL=https://xxx.trycloudflare.com pytest tests/ -v
"""
import requests


# ── Salud general ─────────────────────────────────────────────────────────────

class TestSalud:
    def test_landing_page_responde(self, base_url):
        r = requests.get(base_url, timeout=15, allow_redirects=True)
        assert r.status_code == 200

    def test_api_status_mvs_listas(self, api):
        d = api("/api/status")
        assert "mvs_ready" in d and "mvs_total" in d
        assert d["building"] is False, (
            f"MVs aún construyéndose: {d['mvs_ready']}/{d['mvs_total']}"
        )


# ── Módulo: RESUMEN ───────────────────────────────────────────────────────────

class TestModuloResumen:
    def test_kpis_campos_requeridos(self, api):
        d = api("/api/kpis")
        for campo in ["total_atenciones", "regiones", "ipress", "servicios",
                      "planes", "anio_inicio", "anio_fin"]:
            assert campo in d, f"Campo faltante en KPIs: {campo}"

    def test_kpis_valores_positivos(self, api):
        d = api("/api/kpis")
        assert int(d["total_atenciones"]) > 0
        assert int(d["regiones"]) > 0
        assert int(d["ipress"]) > 0

    def test_por_anio(self, api):
        data = api("/api/por-anio")
        assert isinstance(data, list) and len(data) >= 1
        assert "anio" in data[0] and "atenciones" in data[0]

    def test_por_sexo(self, api):
        data = api("/api/por-sexo")
        assert isinstance(data, list) and len(data) >= 1
        assert "sexo" in data[0] and "atenciones" in data[0]

    def test_por_nivel(self, api):
        data = api("/api/por-nivel")
        assert isinstance(data, list) and len(data) >= 1

    def test_top_servicios(self, api):
        data = api("/api/top-servicios")
        assert isinstance(data, list) and len(data) >= 1
        assert "servicio" in data[0] or "cod_servicio" in data[0]

    def test_por_plan(self, api):
        data = api("/api/por-plan")
        assert isinstance(data, list) and len(data) >= 1


# ── Módulo: MAPA ──────────────────────────────────────────────────────────────

class TestModuloMapa:
    def test_geojson_accesible(self, base_url):
        r = requests.get(f"{base_url}/static/peru.geojson", timeout=15)
        assert r.status_code == 200
        geo = r.json()
        assert geo["type"] == "FeatureCollection"
        assert len(geo["features"]) == 26, (
            f"Esperados 26 departamentos, hay {len(geo['features'])}"
        )

    def test_geojson_propiedad_name(self, base_url):
        r = requests.get(f"{base_url}/static/peru.geojson", timeout=15)
        for f in r.json()["features"][:5]:
            assert "name" in f["properties"]

    def test_por_region(self, api):
        data = api("/api/por-region")
        assert isinstance(data, list) and len(data) >= 1
        assert "region" in data[0] and "atenciones" in data[0]
        assert "ipress" in data[0], "por-region debe incluir campo ipress"


# ── Módulo: DEMOGRAFÍA ────────────────────────────────────────────────────────

class TestModuloDemografia:
    def test_sexo_tiene_generos(self, api):
        data = api("/api/por-sexo")
        sexos = {d["sexo"].upper() for d in data}
        assert "MASCULINO" in sexos or "FEMENINO" in sexos, f"Sexos inesperados: {sexos}"

    def test_edad_grupos(self, api):
        data = api("/api/por-edad")
        assert len(data) >= 1 and "grupo_edad" in data[0]


# ── Módulo: GEOGRAFÍA ─────────────────────────────────────────────────────────

class TestModuloGeografia:
    def test_niveles_eess(self, api):
        data = api("/api/por-nivel")
        niveles = {d.get("nivel") or d.get("nivel_eess") for d in data}
        assert len(niveles) >= 1


# ── Módulo: SERVICIOS ─────────────────────────────────────────────────────────

class TestModuloServicios:
    def test_servicios_ordenados_desc(self, api):
        data = api("/api/top-servicios")
        atenciones = [int(d["atenciones"]) for d in data]
        assert atenciones == sorted(atenciones, reverse=True)

    def test_planes_campos(self, api):
        data = api("/api/por-plan")
        for item in data:
            assert "cod_plan_seguro" in item or "desc_plan_seguro" in item


# ── Módulo: TENDENCIA ─────────────────────────────────────────────────────────

class TestModuloTendencia:
    def test_anio_tiene_atenciones(self, api):
        data = api("/api/por-anio")
        for item in data:
            assert int(item["atenciones"]) > 0, f"Año {item['anio']} sin atenciones"


# ── Módulo: PREDICCIONES ──────────────────────────────────────────────────────

class TestModuloPredicciones:
    def test_estructura(self, api):
        d = api("/api/predicciones", timeout=30)
        for clave in ["forecast_anual", "estacionalidad", "regiones_proyeccion"]:
            assert clave in d, f"Falta {clave} en /api/predicciones"

    def test_forecast_tiene_prediccion(self, api):
        d = api("/api/predicciones", timeout=30)
        fa = d["forecast_anual"]
        assert len(fa.get("prediccion", [])) >= 1
        assert "r2" in fa and "modelo" in fa

    def test_estacionalidad_12_meses(self, api):
        d = api("/api/predicciones", timeout=30)
        assert len(d.get("estacionalidad", [])) == 12

    def test_regiones_proyeccion_campos(self, api):
        d = api("/api/predicciones", timeout=30)
        reg = d.get("regiones_proyeccion", [])
        assert len(reg) >= 1
        assert "region" in reg[0] and "proyeccion_2026" in reg[0]


# ── Bundle /api/dashboard ─────────────────────────────────────────────────────

class TestDashboardBundle:
    def test_bundle_tiene_todas_las_claves(self, api):
        d = api("/api/dashboard", timeout=20)
        for clave in ["kpis", "anio", "region", "edad", "sexo", "servicios", "nivel", "plan"]:
            assert clave in d, f"Clave faltante en /api/dashboard: {clave}"

    def test_bundle_tiempo_menor_15s(self, base_url):
        import time
        t0 = time.time()
        r = requests.get(f"{base_url}/api/dashboard", timeout=20)
        elapsed = time.time() - t0
        assert r.status_code == 200
        assert elapsed < 15, f"/api/dashboard tardó {elapsed:.1f}s (máx 15s)"


# ── PDF export ────────────────────────────────────────────────────────────────

class TestPDF:
    def test_export_pdf_valido(self, base_url):
        """El endpoint retorna un PDF binario válido generado por pdflatex."""
        import pytest
        r = requests.get(f"{base_url}/api/export/pdf", timeout=120)
        if r.status_code == 503:
            pytest.skip("PDF aún generándose (503) — reintenta tras 60 s")
        log_hint = ""
        if not r.headers.get("content-type", "").startswith("application/pdf"):
            try:
                log_hint = r.json().get("log", r.text[:400])
            except Exception:
                log_hint = r.text[:400]
        assert r.status_code == 200, (
            f"PDF endpoint retornó HTTP {r.status_code}\n"
            f"error: {r.json().get('error', '?') if 'json' in r.headers.get('content-type','') else ''}\n"
            f"log: {log_hint}"
        )
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct, f"Content-Type inesperado: {ct!r}"
        assert r.content[:4] == b"%PDF", "La respuesta no comienza con %PDF — no es un PDF válido"
        assert len(r.content) > 5_000, f"PDF demasiado pequeño ({len(r.content)} bytes) — posible error silencioso"
