"""
extract.py
==========
Extracción de datos del SIS desde la Plataforma Nacional de Datos Abiertos.

Los archivos están disponibles en:
https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis

Debido a restricciones del portal (403 en descarga directa desde servidores externos),
este módulo soporta dos modos:
  1. LOCAL: Lee ZIPs ya descargados y colocados en data/raw/
  2. REMOTE: Intenta descarga directa (funciona desde navegador/VPN)
"""

import os
import io
import zipfile
import logging
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

# ─── URLs de descarga directa del portal ─────────────────────────────────────
# Fuente: https://www.datosabiertos.gob.pe/dataset/datos-de-atenciones-realizadas-los-asegurados-sis
SOURCE_FILES = {
    # Tamaños verificados con archivos reales descargados:
    #   2017 ZIP=96.9 MB  / CSV=1.39 GB descomprimido
    #   2025_s2 ZIP=172.6 MB / CSV=1.12 GB descomprimido
    # Tamaños de 2018-2020 provienen de los metadatos del portal (API JSON de datosabiertos.gob.pe).
    # Tamaños de 2021-2024 son desconocidos — no se dispone de los archivos ni de metadatos confiables.
    2017: {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2017_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2017_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2017_ATENCIONES.csv",
        "zip_mb": 96.9,    # verificado
        "csv_gb": 1.39,    # verificado
    },
    2018: {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2018_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2018_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2018_ATENCIONES.csv",
        "zip_mb": 94.62,   # fuente: metadatos portal
        "csv_gb": None,    # desconocido
    },
    2019: {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2019_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2019_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2019_ATENCIONES.csv",
        "zip_mb": 97.21,   # fuente: metadatos portal
        "csv_gb": None,
    },
    2020: {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2020_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2020_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2020_ATENCIONES.csv",
        "zip_mb": 55.67,   # fuente: metadatos portal
        "csv_gb": None,
    },
    "2021_s1": {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2021_01_06_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2021_01_06_ATENCIONES.csv",
        "zip_mb": None,    # desconocido
        "csv_gb": None,
    },
    "2021_s2": {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2021_07_12_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2021_07_12_ATENCIONES.csv",
        "zip_mb": None,
        "csv_gb": None,
    },
    "2022_s1": {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2022_01_06_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2022_01_06_ATENCIONES.csv",
        "zip_mb": None,
        "csv_gb": None,
    },
    "2022_s2": {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip",
        "filename": "OPENDATA_DS_01_2022_07_12_ATENCIONES_0.zip",
        "csv_inside": "OPENDATA_DS_01_2022_07_12_ATENCIONES.csv",
        "zip_mb": None,
        "csv_gb": None,
    },
    2023: {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2023_ATENCIONES.zip",
        "filename": "OPENDATA_DS_01_2023_ATENCIONES.zip",
        "csv_inside": "OPENDATA_DS_01_2023_ATENCIONES.csv",
        "zip_mb": None,    # desconocido — no se pudo descargar ni verificar
        "csv_gb": None,
    },
    2024: {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2024_ATENCIONES.zip",
        "filename": "OPENDATA_DS_01_2024_ATENCIONES.zip",
        "csv_inside": "OPENDATA_DS_01_2024_ATENCIONES.csv",
        "zip_mb": None,
        "csv_gb": None,
    },
    "2025_s2": {
        "url": "https://www.datosabiertos.gob.pe/sites/default/files/OPENDATA_DS_01_2025_07_12_ATENCIONES.zip",
        "filename": "OPENDATA_DS_01_2025_07_12_ATENCIONES.zip",
        "csv_inside": "OPENDATA_DS_01_2025_07_12_ATENCIONES.csv",
        "zip_mb": 172.6,   # verificado
        "csv_gb": 1.12,    # verificado
    },
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def get_raw_dir() -> Path:
    raw_dir = Path(os.getenv("DATA_RAW_DIR", "./data/raw"))
    raw_dir.mkdir(parents=True, exist_ok=True)
    return raw_dir


def list_local_zips(raw_dir: Path) -> list[Path]:
    """Devuelve ZIPs ya descargados en data/raw/"""
    return sorted(raw_dir.glob("OPENDATA_DS_01_*.zip"))


def download_file(url: str, dest: Path) -> bool:
    """Descarga un archivo ZIP desde el portal. Devuelve True si tuvo éxito."""
    try:
        logger.info(f"Descargando: {url}")
        with requests.get(url, headers=HEADERS, stream=True, timeout=120) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            downloaded = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 1024):
                    f.write(chunk)
                    downloaded += len(chunk)
            logger.info(f"Descargado {downloaded / 1e6:.1f} MB → {dest.name}")
            return True
    except requests.exceptions.RequestException as e:
        logger.warning(f"No se pudo descargar {url}: {e}")
        return False


def extract_csv_from_zip(zip_path: Path) -> io.BytesIO | None:
    """
    Extrae el CSV contenido dentro del ZIP y lo devuelve como BytesIO.
    Compatible con ZIPs que contienen un solo CSV de cualquier nombre.
    """
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            csv_files = [n for n in z.namelist() if n.endswith(".csv")]
            if not csv_files:
                logger.warning(f"No se encontró CSV en {zip_path.name}")
                return None
            csv_name = csv_files[0]
            logger.info(f"Extrayendo {csv_name} de {zip_path.name}")
            return io.BytesIO(z.read(csv_name))
    except zipfile.BadZipFile:
        logger.error(f"ZIP corrupto: {zip_path}")
        return None


def run(years: list = None, raw_dir: Path = None) -> list[io.BytesIO]:
    """
    Punto de entrada del módulo Extract.

    Primero busca ZIPs locales en data/raw/.
    Si no encuentra, intenta descarga desde el portal.

    Retorna lista de BytesIO con el contenido de cada CSV.
    """
    if raw_dir is None:
        raw_dir = get_raw_dir()

    # Prioridad 1: archivos locales ya descargados
    local_zips = list_local_zips(raw_dir)
    if local_zips:
        logger.info(f"Encontrados {len(local_zips)} ZIPs locales en {raw_dir}")
        streams = []
        for zp in local_zips:
            buf = extract_csv_from_zip(zp)
            if buf:
                streams.append((zp.name, buf))
        return streams

    # Prioridad 2: descarga remota
    logger.info("No hay ZIPs locales. Intentando descarga desde el portal...")
    streams = []
    targets = SOURCE_FILES if years is None else {
        k: v for k, v in SOURCE_FILES.items()
        if (isinstance(k, int) and k in years) or
           (isinstance(k, str) and any(str(y) in k for y in years))
    }

    for key, meta in targets.items():
        dest = raw_dir / meta["filename"]
        if not dest.exists():
            success = download_file(meta["url"], dest)
            if not success:
                logger.warning(
                    f"No se pudo obtener {meta['filename']}. "
                    f"Descárgalo manualmente desde:\n  {meta['url']}\n"
                    f"y colócalo en: {raw_dir.resolve()}"
                )
                continue
        buf = extract_csv_from_zip(dest)
        if buf:
            streams.append((meta["filename"], buf))

    return streams


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    results = run()
    print(f"\nTotal archivos listos para transformar: {len(results)}")
    for name, _ in results:
        print(f"  ✓ {name}")
