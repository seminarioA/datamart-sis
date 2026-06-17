#!/usr/bin/env bash
# DataMart SIS — lanza el dashboard web en puerto 8080
# Acceder via SSH tunnel: ssh -L 8080:localhost:8080 ubuntu@170.9.4.149
set -e

cd "$(dirname "$0")"
source /home/ubuntu/datamart-sis/.venv/bin/activate

exec uvicorn app:app --host 0.0.0.0 --port 8080 --workers 2
