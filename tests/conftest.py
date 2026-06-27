"""
conftest.py — configuración compartida de pytest para tests del dashboard.
"""
import pytest
import requests
import os


def pytest_addoption(parser):
    parser.addoption(
        "--base-url",
        action="store",
        default=None,
        help="URL base del dashboard (ej: https://xxx.trycloudflare.com)",
    )


@pytest.fixture(scope="session")
def base_url(request):
    opt = request.config.getoption("--base-url")
    env = os.environ.get("DASHBOARD_URL")
    url = opt or env or "http://localhost:8080"
    print(f"\n🔗 Testing against: {url}")
    return url.rstrip("/")


@pytest.fixture(scope="session")
def api(base_url):
    """GET helper que falla si el status code no es 200."""
    session = requests.Session()
    session.headers["User-Agent"] = "pytest-dashboard-tests/1.0"

    def get(path: str, timeout: int = 20):
        url = f"{base_url}{path}"
        r = session.get(url, timeout=timeout)
        assert r.status_code == 200, (
            f"GET {path} → HTTP {r.status_code}\n{r.text[:300]}"
        )
        return r.json()

    return get
