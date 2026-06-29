# Estrategia de Cache — DataMart SIS

## 3 capas de cache

```
Request → L1 Memoria (sub-ms, TTL 15min)
        → L2 Disco JSON (ms, TTL 1h, persiste reinicios)
        → L3 PostgreSQL MV (segundos, fuente de verdad)
```

### L1 — Memoria (dict Python)
- TTL: 900s (15 min)
- Se pierde al reiniciar uvicorn
- Sub-milisegundo

### L2 — Disco JSON (`/home/ubuntu/datamart-sis/cache/`)
- TTL: 3600s (1 hora)
- **Persiste entre reinicios** → primer request post-reinicio es instantáneo
- Archivos: `kpis.json`, `por_region.json`, `por_anio.json`, etc.
- Se invalida cuando Airflow refresca las MVs (`refresh_mvs` DAG)

### L3 — PostgreSQL Materialized Views
- 9 MVs pre-computadas: `mv_kpis`, `mv_por_anio`, `mv_por_region`, etc.
- Se construyen al arrancar la app (si no existen)
- En restart: se detectan existentes → se marcan ready al instante
- Se refrescan cada hora via DAG `refresh_mvs`
- Sin MVs: `SUM()` sobre 14M+ filas toma ~60s

### HTTP Cache (browser)
- `Cache-Control: public, max-age=300, stale-while-revalidate=60`
- Solo para `/api/*` (excepto `/api/status`)

## Problema conocido: REFRESH MATERIALIZED VIEW bloquea lecturas

`REFRESH MATERIALIZED VIEW` adquiere `ExclusiveLock`. Si múltiples runs del DAG
`refresh_mvs` corren simultáneamente → deadlock/timeout en el dashboard.

**Fix aplicado:** `max_active_runs=1` + `max_active_tasks=1` en el DAG → los REFRESH
son secuenciales, sin locks concurrentes.

## Endpoint bundled

`GET /api/dashboard` → devuelve todo en 1 response (8 endpoints en 1 round-trip).
Reduce latencia de ~8×600ms (cloudflared) a ~1×800ms.
