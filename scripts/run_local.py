#!/usr/bin/env python3
"""
run_local.py — Corre el ingest SIS desde tu Mac con output en tiempo real.

El script crea un proceso en el VPS y hace streaming del output al terminal.
Ctrl+C pausa: el proceso queda en background en el VPS.
Volviendo a correr reanuda (el ingest es idempotente).

Uso:
    python3 scripts/run_local.py --key ~/.ssh/mi_clave_vps
    python3 scripts/run_local.py --key ~/.ssh/mi_clave_vps --status   # solo ver estado
    python3 scripts/run_local.py --key ~/.ssh/mi_clave_vps --logs     # tail de logs
"""

import argparse
import subprocess
import sys
import os
import signal
import time
from pathlib import Path

VPS_HOST = os.environ.get("VPS_HOST", "192.9.159.35")  # fallback solo para uso local; sobrescribir via env en uso compartido/productivo
VPS_USER = "ubuntu"
VPS_DIR  = "/home/ubuntu/datamart-sis"
LOG_FILE = "/home/ubuntu/ingest_all.log"
PID_FILE = "/home/ubuntu/ingest_all.pid"


def ssh_cmd(key: str, cmd: str, interactive: bool = False) -> subprocess.CompletedProcess | None:
    base = [
        "ssh",
        "-i", key,
        "-o", "ConnectTimeout=15",
        f"{VPS_USER}@{VPS_HOST}",
        cmd,
    ]
    if interactive:
        return subprocess.run(base)
    return subprocess.run(base, capture_output=True, text=True)


def ssh_stream(key: str, cmd: str):
    """Lanza SSH y hace streaming del stdout al terminal. Retorna exit code."""
    proc = subprocess.Popen(
        [
            "ssh",
            "-i", key,
            "-o", "ConnectTimeout=15",
            "-t",  # pseudo-TTY para ver output en tiempo real
            f"{VPS_USER}@{VPS_HOST}",
            cmd,
        ],
        stdout=sys.stdout,
        stderr=sys.stderr,
    )
    try:
        proc.wait()
    except KeyboardInterrupt:
        print("\n\n[Ctrl+C recibido — proceso en VPS sigue corriendo en background]")
        print(f"[Para ver logs: python3 scripts/run_local.py --key {key} --logs]")
        print(f"[Para reanudar: python3 scripts/run_local.py --key {key}]")
        proc.terminate()
    return proc.returncode


def check_status(key: str):
    r = ssh_cmd(key, f"""
pid=$(cat {PID_FILE} 2>/dev/null || echo "")
if [ -z "$pid" ]; then
    echo "Sin proceso activo (no hay PID file)"
else
    if kill -0 "$pid" 2>/dev/null; then
        echo "CORRIENDO — PID $pid"
    else
        echo "DETENIDO — ultimo PID fue $pid"
    fi
fi
echo ""
echo "=== Ultimas 30 lineas de log ==="
tail -30 {LOG_FILE} 2>/dev/null || echo "(log vacio)"
""")
    print(r.stdout)
    if r.stderr:
        print(r.stderr, file=sys.stderr)


def tail_logs(key: str):
    print(f"[Streaming logs desde VPS — Ctrl+C para salir]\n")
    ssh_stream(key, f"tail -f {LOG_FILE}")


def kill_previous(key: str):
    r = ssh_cmd(key, f"""
if [ -f {PID_FILE} ]; then
    OLD=$(cat {PID_FILE})
    if kill -0 "$OLD" 2>/dev/null; then
        echo "Matando proceso anterior (PID $OLD)..."
        kill "$OLD" 2>/dev/null || true
        sleep 2
    fi
    rm -f {PID_FILE}
fi
""")
    if r.stdout.strip():
        print(r.stdout.strip())


def launch_background(key: str):
    """Lanza el ingest en background y empieza a hacer streaming de logs."""
    r = ssh_cmd(key, f"""
set -e
cd {VPS_DIR}
git fetch origin main -q
git reset --hard origin/main -q
chmod +x scripts/ingest_all.sh
nohup bash scripts/ingest_all.sh >> {LOG_FILE} 2>&1 &
echo $! > {PID_FILE}
echo "PID: $(cat {PID_FILE})"
""")
    print(r.stdout.strip())
    if r.returncode != 0:
        print(f"ERROR: {r.stderr}", file=sys.stderr)
        sys.exit(1)

    time.sleep(2)
    print(f"\n[Streaming logs — Ctrl+C para dejar en background]\n")
    ssh_stream(key, f"tail -f {LOG_FILE}")


def run_foreground(key: str):
    """Corre el ingest en foreground (bloquea hasta terminar). Ctrl+C pausa."""
    r = ssh_cmd(key, f"""
set -e
cd {VPS_DIR}
git fetch origin main -q
git reset --hard origin/main -q
chmod +x scripts/ingest_all.sh
""")
    if r.returncode != 0:
        print(f"ERROR actualizando repo: {r.stderr}", file=sys.stderr)
        sys.exit(1)

    print("[Ingest corriendo — Ctrl+C pone en background]\n")
    # El script corre en foreground pero si hay Ctrl+C lo mandamos a bg
    ssh_stream(key, f"""
cd {VPS_DIR}
# Arrancar en background inmediatamente para capturar el PID
nohup bash scripts/ingest_all.sh >> {LOG_FILE} 2>&1 &
echo $! > {PID_FILE}
# Hacer streaming del log en tiempo real
tail -f {LOG_FILE} --pid=$(cat {PID_FILE})
""")


def find_key() -> str | None:
    """Busca claves SSH comunes en el Mac."""
    candidates = [
        Path.home() / ".ssh" / "tmp_vps",
        Path.home() / ".ssh" / "id_rsa",
        Path.home() / ".ssh" / "id_ed25519",
        Path.home() / ".ssh" / "vps",
        Path.home() / ".ssh" / "datamart",
    ]
    for p in candidates:
        if p.is_file() and oct(p.stat().st_mode)[-3:] in ("600", "400"):
            return str(p)
    return None


def main():
    parser = argparse.ArgumentParser(description="Ingest SIS desde Mac via SSH")
    parser.add_argument("--key", "-k", default=None,
                        help="Ruta a la clave SSH privada del VPS (ej: ~/.ssh/mi_clave)")
    parser.add_argument("--status", "-s", action="store_true",
                        help="Ver estado actual y ultimas lineas del log")
    parser.add_argument("--logs", "-l", action="store_true",
                        help="Tail en tiempo real del log del VPS")
    parser.add_argument("--kill", action="store_true",
                        help="Matar proceso activo en el VPS")
    args = parser.parse_args()

    # Resolver clave
    key = args.key
    if key:
        key = str(Path(key).expanduser())
    else:
        key = find_key()

    if not key or not Path(key).is_file():
        print("ERROR: No se encontro clave SSH del VPS.")
        print()
        print("Uso:")
        print("  python3 scripts/run_local.py --key /ruta/a/tu/clave_privada")
        print()
        print("La clave es la misma que tienes en el secreto VPS_SSH_KEY de GitHub Actions.")
        print("Guardala en ~/.ssh/vps_datamart y corre:")
        print("  chmod 600 ~/.ssh/vps_datamart")
        print("  python3 scripts/run_local.py --key ~/.ssh/vps_datamart")
        sys.exit(1)

    # Asegurar permisos correctos
    os.chmod(key, 0o600)

    # Verificar conectividad
    test = ssh_cmd(key, "echo SSH_OK")
    if "SSH_OK" not in test.stdout:
        print(f"ERROR: No se puede conectar a {VPS_HOST}")
        print(test.stderr)
        sys.exit(1)

    if args.status:
        check_status(key)
    elif args.logs:
        tail_logs(key)
    elif args.kill:
        kill_previous(key)
        print("Proceso detenido.")
    else:
        # Modo normal: lanzar en background + streaming
        kill_previous(key)
        run_foreground(key)


if __name__ == "__main__":
    main()
