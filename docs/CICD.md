# CI/CD Pipeline — DataMart SIS

## Flujo general

```
dev branch → PR → CI (ci.yml) → merge a main → Deploy (deploy.yml)
```

## ci.yml — Rama dev / PRs

Corre en: push a `dev`, PR a `main`

Jobs:
1. **Build React** — `npm ci && npm run build`
2. **Test Dashboard Modules** — pytest contra URL de producción

## deploy.yml — Rama main (smart deploy)

Detecta qué cambió usando `dorny/paths-filter`:

```
push a main
    │
    ├── changes (Detect changes)
    │       ├── backend? (app.py, requirements.txt, deploy.sh, sql/**, etc.)
    │       └── frontend? (web/frontend/src/**, package*.json, vercel.json)
    │
    ├── deploy-backend [si backend cambió]
    │       └── SSH → git fetch + reset --hard → pip install → reiniciar uvicorn
    │
    └── verify-and-release [si cualquiera cambió]
            ├── Smoke test dashboard
            ├── pytest tests/
            └── gh release create (con URLs actuales)
```

**Frontend:** Vercel lo despliega automáticamente via GitHub App al detectar cambios.
No necesita GitHub Actions para el frontend.

## deploy.sh (en VPS)

Reinicia solo uvicorn (NO Airflow, NO cloudflared):
```bash
pkill -9 -f 'uvicorn app:app' || true
sleep 2
source .venv/bin/activate
cd web
DATABASE_URL='postgresql://...' nohup uvicorn app:app --host 0.0.0.0 --port 8080 --workers 1 &
```

Airflow y cloudflared solo se reinician si se ejecuta `start_airflow.sh` manualmente.

## Vercel

- URL fija: **https://datamart-sis.vercel.app**
- Alias alternativo: https://datamart-sis-peru.vercel.app
- Rewrites en `vercel.json`:
  - `/api/*` → `http://192.9.159.35:8080/api/*`
  - `/static/*` → `http://192.9.159.35:8080/static/*`
- Deployment Protection: **deshabilitada** (proyecto público)

## Tests automáticos

`tests/test_dashboard_modules.py` — 24 tests, cubren los 7 módulos:
- Salud, Resumen, Mapa, Demografía, Geografía, Servicios, Tendencia, Predicciones, Bundle

Ejecutar localmente:
```bash
pip install pytest requests pytest-timeout
pytest tests/ --base-url=https://datamart-sis.vercel.app -v
```

## Branch protection

`main` requiere que "Build React" pase antes de merge.
