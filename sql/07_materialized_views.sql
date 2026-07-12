-- ============================================================
-- DATAMART SIS — Vistas Materializadas
-- 07_materialized_views.sql
-- Fuente de verdad para el dashboard (mismas queries que app.py).
-- Ejecutar después de 05_staging_and_elt.sql y de la primera carga.
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_kpis AS
    SELECT COALESCE(SUM(cantidad_atenciones), 0) AS total_atenciones,
           COUNT(*)                               AS total_registros
    FROM datamart_sis.fact_atenciones_sis;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_anio AS
    SELECT t.anio, SUM(f.cantidad_atenciones) AS atenciones
    FROM datamart_sis.fact_atenciones_sis f
    JOIN datamart_sis.dim_tiempo t ON t.id_tiempo = f.id_tiempo
    GROUP BY t.anio
    ORDER BY t.anio;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_region AS
    SELECT u.region,
           SUM(f.cantidad_atenciones)   AS atenciones,
           COUNT(DISTINCT f.cod_ipress) AS ipress
    FROM datamart_sis.fact_atenciones_sis f
    JOIN datamart_sis.dim_ubicacion u ON u.cod_ubigeo = f.cod_ubigeo
    GROUP BY u.region
    ORDER BY atenciones DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_edad AS
    SELECT f.grupo_edad, g.etapa_vida,
           SUM(f.cantidad_atenciones) AS atenciones
    FROM datamart_sis.fact_atenciones_sis f
    LEFT JOIN datamart_sis.dim_grupo_edad g ON g.grupo_edad = f.grupo_edad
    GROUP BY f.grupo_edad, g.etapa_vida
    ORDER BY atenciones DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_sexo AS
    SELECT f.sexo, SUM(f.cantidad_atenciones) AS atenciones
    FROM datamart_sis.fact_atenciones_sis f
    GROUP BY f.sexo
    ORDER BY atenciones DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_top_servicios AS
    SELECT f.cod_servicio,
           COALESCE(s.desc_servicio, f.cod_servicio) AS servicio,
           SUM(f.cantidad_atenciones)                 AS atenciones
    FROM datamart_sis.fact_atenciones_sis f
    LEFT JOIN datamart_sis.dim_servicio s ON s.cod_servicio = f.cod_servicio
    GROUP BY f.cod_servicio, s.desc_servicio
    ORDER BY atenciones DESC
    LIMIT 15;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_nivel AS
    SELECT f.nivel_eess,
           COALESCE(n.desc_nivel_eess, f.nivel_eess) AS nivel,
           SUM(f.cantidad_atenciones)                 AS atenciones,
           COUNT(DISTINCT f.cod_ipress)               AS ipress
    FROM datamart_sis.fact_atenciones_sis f
    LEFT JOIN datamart_sis.dim_nivel_ipress n ON n.nivel_eess = f.nivel_eess
    GROUP BY f.nivel_eess, n.desc_nivel_eess
    ORDER BY atenciones DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_plan AS
    SELECT p.cod_plan_seguro, p.desc_plan_seguro, p.regimen_financiamiento,
           SUM(f.cantidad_atenciones) AS atenciones
    FROM datamart_sis.fact_atenciones_sis f
    JOIN datamart_sis.dim_plan_seguro p ON p.cod_plan_seguro = f.cod_plan_seguro
    GROUP BY p.cod_plan_seguro, p.desc_plan_seguro, p.regimen_financiamiento
    ORDER BY atenciones DESC;

CREATE MATERIALIZED VIEW IF NOT EXISTS datamart_sis.mv_por_mes AS
    SELECT t.anio, t.mes,
           SUM(f.cantidad_atenciones) AS atenciones
    FROM datamart_sis.fact_atenciones_sis f
    JOIN datamart_sis.dim_tiempo t ON t.id_tiempo = f.id_tiempo
    GROUP BY t.anio, t.mes
    ORDER BY t.anio, t.mes;

-- Índices en MVs para consultas frecuentes del dashboard
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_kpis_singleton
    ON datamart_sis.mv_kpis ((1));

CREATE INDEX IF NOT EXISTS idx_mv_por_anio_anio
    ON datamart_sis.mv_por_anio (anio);

CREATE INDEX IF NOT EXISTS idx_mv_por_region_region
    ON datamart_sis.mv_por_region (region);
