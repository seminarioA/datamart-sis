"""
Descarga los ZIPs de "Atenciones SIS" desde datosabiertos.gob.pe.

- Obtiene la lista de recursos vía API CKAN (package_show).
- Filtra recursos ZIP (excluye PDF/XLS de muestra).
- Descarga en streaming con headers de navegador (bypass CloudWAF).
- Soporta resume (Range) y reintentos.
- Verifica que el tamaño final coincida con el reportado por la API.
"""

import sys
import time
from pathlib import Path

import requests

API_URL = "https://www.datosabiertos.gob.pe/api/3/action/package_show?id=0deb202c-a375-454a-98cb-fbdbc07fb7c8"
REFERER = "https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-PE,es;q=0.9,en;q=0.8",
    "Referer": REFERER,
    "Connection": "keep-alive",
}

RAW_DIR = Path(__file__).parent / "data" / "raw"
MAX_RETRIES = 5


def get_resources():
    r = requests.get(API_URL, headers=HEADERS, timeout=60)
    r.raise_for_status()
    data = r.json()
    resources = data["result"]["resources"]
    # Solo los ZIPs de data completa (excluye PDF diccionario y XLS de muestra)
    return [res for res in resources if res["format"].upper() == "ZIP"]


def download(url: str, dest: Path, expected_size: int):
    for attempt in range(1, MAX_RETRIES + 1):
        existing = dest.stat().st_size if dest.exists() else 0
        if existing == expected_size:
            print(f"  OK (ya completo): {dest.name} ({existing/1e6:.1f} MB)")
            return True
        if existing > expected_size:
            print(f"  Tamaño existente mayor al esperado, borrando y reintentando: {dest.name}")
            dest.unlink()
            existing = 0

        headers = dict(HEADERS)
        mode = "wb"
        if existing > 0:
            headers["Range"] = f"bytes={existing}-"
            mode = "ab"
            print(f"  Reanudando {dest.name} desde {existing/1e6:.1f} MB...")
        else:
            print(f"  Descargando {dest.name} ({expected_size/1e6:.1f} MB esperado)... intento {attempt}")

        try:
            with requests.get(url, headers=headers, stream=True, timeout=120) as r:
                if r.status_code == 416:
                    # Range no satisfiable -> ya está completo o corrupto
                    dest.unlink(missing_ok=True)
                    existing = 0
                    continue
                r.raise_for_status()
                with open(dest, mode) as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
        except (requests.RequestException, IOError) as e:
            print(f"  Error: {e}. Reintentando en 5s...")
            time.sleep(5)
            continue

        final_size = dest.stat().st_size
        if final_size == expected_size:
            print(f"  OK: {dest.name} ({final_size/1e6:.1f} MB)")
            return True
        else:
            print(f"  Tamaño incorrecto ({final_size} != {expected_size}), reintentando...")
            time.sleep(3)

    return False


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    resources = get_resources()
    print(f"Recursos ZIP encontrados: {len(resources)}\n")

    results = {}
    for res in resources:
        url = res["url"]
        name = url.split("/")[-1]
        size = int(res["size"])
        dest = RAW_DIR / name
        print(f"=== {res['name']} ===")
        ok = download(url, dest, size)
        results[name] = ok
        print()

    print("=" * 60)
    print("RESUMEN")
    print("=" * 60)
    failed = [n for n, ok in results.items() if not ok]
    for n, ok in results.items():
        print(f"  {'OK ' if ok else 'FAIL'} {n}")
    if failed:
        print(f"\n{len(failed)} archivo(s) fallaron.")
        sys.exit(1)
    print(f"\nTodos los {len(results)} archivos descargados correctamente.")


if __name__ == "__main__":
    main()
