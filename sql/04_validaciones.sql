-- ============================================================
-- DATAMART DE ATENCIONES DE SALUD — SIS
-- 04_validaciones.sql
-- Script de validación y pruebas de calidad
-- Motor: PostgreSQL (Supabase)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECCIÓN 1: CONTEO DE REGISTROS POR TABLA
-- ────────────────────────────────────────────────────────────
SELECT 'DIM_TIEMPO'           AS tabla, COUNT(*) AS registros FROM datamart_sis.DIM_TIEMPO
UNION ALL
SELECT 'DIM_UBICACION'        , COUNT(*) FROM datamart_sis.DIM_UBICACION
UNION ALL
SELECT 'DIM_IPRESS'           , COUNT(*) FROM datamart_sis.DIM_IPRESS
UNION ALL
SELECT 'DIM_NIVEL_IPRESS'     , COUNT(*) FROM datamart_sis.DIM_NIVEL_IPRESS
UNION ALL
SELECT 'DIM_PLAN_SEGURO'      , COUNT(*) FROM datamart_sis.DIM_PLAN_SEGURO
UNION ALL
SELECT 'DIM_SERVICIO'         , COUNT(*) FROM datamart_sis.DIM_SERVICIO
UNION ALL
SELECT 'DIM_SEXO'             , COUNT(*) FROM datamart_sis.DIM_SEXO
UNION ALL
SELECT 'DIM_GRUPO_EDAD'       , COUNT(*) FROM datamart_sis.DIM_GRUPO_EDAD
UNION ALL
SELECT 'FACT_ATENCIONES_SIS'  , COUNT(*) FROM datamart_sis.FACT_ATENCIONES_SIS
ORDER BY tabla;

-- Total de atenciones acumuladas
SELECT SUM(CANTIDAD_ATENCIONES) AS total_atenciones_pais
FROM datamart_sis.FACT_ATENCIONES_SIS;

-- ────────────────────────────────────────────────────────────
-- SECCIÓN 2: INTEGRIDAD REFERENCIAL — HUÉRFANOS
-- ────────────────────────────────────────────────────────────
SELECT 'FACT sin DIM_TIEMPO'       AS tipo, COUNT(*) AS huerfanos
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_TIEMPO t ON f.ID_TIEMPO = t.ID_TIEMPO
WHERE t.ID_TIEMPO IS NULL
UNION ALL
SELECT 'FACT sin DIM_UBICACION',    COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_UBICACION u ON f.COD_UBIGEO = u.COD_UBIGEO
WHERE u.COD_UBIGEO IS NULL
UNION ALL
SELECT 'FACT sin DIM_IPRESS',       COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_IPRESS ip ON f.COD_IPRESS = ip.COD_IPRESS
WHERE ip.COD_IPRESS IS NULL
UNION ALL
SELECT 'FACT sin DIM_NIVEL_IPRESS', COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_NIVEL_IPRESS n ON f.NIVEL_EESS = n.NIVEL_EESS
WHERE n.NIVEL_EESS IS NULL
UNION ALL
SELECT 'FACT sin DIM_PLAN_SEGURO',  COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_PLAN_SEGURO p ON f.COD_PLAN_SEGURO = p.COD_PLAN_SEGURO
WHERE p.COD_PLAN_SEGURO IS NULL
UNION ALL
SELECT 'FACT sin DIM_SERVICIO',     COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_SERVICIO s ON f.COD_SERVICIO = s.COD_SERVICIO
WHERE s.COD_SERVICIO IS NULL
UNION ALL
SELECT 'FACT sin DIM_SEXO',         COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_SEXO sx ON f.SEXO = sx.SEXO
WHERE sx.SEXO IS NULL
UNION ALL
SELECT 'FACT sin DIM_GRUPO_EDAD',   COUNT(*)
FROM datamart_sis.FACT_ATENCIONES_SIS f
LEFT JOIN datamart_sis.DIM_GRUPO_EDAD ge ON f.GRUPO_EDAD = ge.GRUPO_EDAD
WHERE ge.GRUPO_EDAD IS NULL;

-- ────────────────────────────────────────────────────────────
-- SECCIÓN 3: CONSISTENCIA DE DATOS
-- ────────────────────────────────────────────────────────────

-- 3.1 Registros con atenciones nulas o negativas
SELECT COUNT(*) AS registros_invalidos
FROM datamart_sis.FACT_ATENCIONES_SIS
WHERE CANTIDAD_ATENCIONES IS NULL OR CANTIDAD_ATENCIONES < 0;

-- 3.2 Rango de periodos cargados
SELECT
    MIN(ID_TIEMPO)          AS periodo_minimo,
    MAX(ID_TIEMPO)          AS periodo_maximo,
    COUNT(DISTINCT ID_TIEMPO) AS total_periodos
FROM datamart_sis.FACT_ATENCIONES_SIS;

-- 3.3 Cobertura de años
SELECT t.ANIO, COUNT(*) AS registros, SUM(f.CANTIDAD_ATENCIONES) AS atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_TIEMPO t ON f.ID_TIEMPO = t.ID_TIEMPO
GROUP BY t.ANIO
ORDER BY t.ANIO;

-- ────────────────────────────────────────────────────────────
-- SECCIÓN 4: DISTRIBUCIÓN DE ATENCIONES — KPIs analíticos
-- ────────────────────────────────────────────────────────────

-- 4.1 Top 10 regiones por volumen de atenciones
SELECT
    u.REGION,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones,
    ROUND(SUM(f.CANTIDAD_ATENCIONES) * 100.0 / SUM(SUM(f.CANTIDAD_ATENCIONES)) OVER (), 2) AS porcentaje
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_UBICACION u ON f.COD_UBIGEO = u.COD_UBIGEO
GROUP BY u.REGION
ORDER BY total_atenciones DESC
LIMIT 10;

-- 4.2 Atenciones por nivel de establecimiento
SELECT
    n.NIVEL_EESS,
    n.DESC_NIVEL_EESS,
    n.CATEGORIA_ATENCION,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones,
    ROUND(SUM(f.CANTIDAD_ATENCIONES) * 100.0 / SUM(SUM(f.CANTIDAD_ATENCIONES)) OVER (), 2) AS porcentaje
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_NIVEL_IPRESS n ON f.NIVEL_EESS = n.NIVEL_EESS
GROUP BY n.NIVEL_EESS, n.DESC_NIVEL_EESS, n.CATEGORIA_ATENCION
ORDER BY total_atenciones DESC;

-- 4.3 Atenciones por plan de seguro
SELECT
    p.DESC_PLAN_SEGURO,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones,
    ROUND(SUM(f.CANTIDAD_ATENCIONES) * 100.0 / SUM(SUM(f.CANTIDAD_ATENCIONES)) OVER (), 2) AS porcentaje
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_PLAN_SEGURO p ON f.COD_PLAN_SEGURO = p.COD_PLAN_SEGURO
GROUP BY p.DESC_PLAN_SEGURO
ORDER BY total_atenciones DESC;

-- 4.4 Evolución mensual de atenciones
SELECT
    t.ANIO,
    t.MES,
    t.DESC_MES,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_TIEMPO t ON f.ID_TIEMPO = t.ID_TIEMPO
GROUP BY t.ANIO, t.MES, t.DESC_MES
ORDER BY t.ANIO, t.MES;

-- 4.5 Top 20 servicios más frecuentes
SELECT
    s.COD_SERVICIO,
    s.DESC_SERVICIO,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_SERVICIO s ON f.COD_SERVICIO = s.COD_SERVICIO
GROUP BY s.COD_SERVICIO, s.DESC_SERVICIO
ORDER BY total_atenciones DESC
LIMIT 20;

-- 4.6 Atenciones por grupo de edad y sexo
SELECT
    ge.GRUPO_EDAD,
    ge.ETAPA_VIDA,
    sx.DESC_SEXO,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_GRUPO_EDAD ge ON f.GRUPO_EDAD = ge.GRUPO_EDAD
JOIN datamart_sis.DIM_SEXO sx ON f.SEXO = sx.SEXO
GROUP BY ge.GRUPO_EDAD, ge.ETAPA_VIDA, sx.DESC_SEXO
ORDER BY ge.EDAD_MIN, sx.DESC_SEXO;

-- ────────────────────────────────────────────────────────────
-- SECCIÓN 5: RESPUESTA A PREGUNTAS DE NEGOCIO
-- ────────────────────────────────────────────────────────────

-- P01: ¿Cuál es el volumen total de atenciones por región y período?
SELECT
    t.ANIO,
    u.REGION,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_TIEMPO t ON f.ID_TIEMPO = t.ID_TIEMPO
JOIN datamart_sis.DIM_UBICACION u ON f.COD_UBIGEO = u.COD_UBIGEO
GROUP BY t.ANIO, u.REGION
ORDER BY t.ANIO, total_atenciones DESC;

-- P03: ¿Cómo se distribuyen las atenciones por servicio y nivel de IPRESS?
SELECT
    s.DESC_SERVICIO,
    n.NIVEL_EESS,
    n.CATEGORIA_ATENCION,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_SERVICIO s ON f.COD_SERVICIO = s.COD_SERVICIO
JOIN datamart_sis.DIM_NIVEL_IPRESS n ON f.NIVEL_EESS = n.NIVEL_EESS
GROUP BY s.DESC_SERVICIO, n.NIVEL_EESS, n.CATEGORIA_ATENCION
ORDER BY total_atenciones DESC
LIMIT 20;

-- P05: ¿Qué proporción de atenciones corresponde al primer nivel?
SELECT
    n.CATEGORIA_ATENCION,
    SUM(f.CANTIDAD_ATENCIONES) AS total,
    ROUND(SUM(f.CANTIDAD_ATENCIONES) * 100.0 / SUM(SUM(f.CANTIDAD_ATENCIONES)) OVER (), 2) AS porcentaje
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_NIVEL_IPRESS n ON f.NIVEL_EESS = n.NIVEL_EESS
GROUP BY n.CATEGORIA_ATENCION
ORDER BY total DESC;

-- P07: ¿Qué plan de seguro concentra mayor volumen?
SELECT
    p.DESC_PLAN_SEGURO,
    p.REGIMEN_FINANCIAMIENTO,
    SUM(f.CANTIDAD_ATENCIONES) AS total_atenciones
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_PLAN_SEGURO p ON f.COD_PLAN_SEGURO = p.COD_PLAN_SEGURO
GROUP BY p.DESC_PLAN_SEGURO, p.REGIMEN_FINANCIAMIENTO
ORDER BY total_atenciones DESC;

-- P10: ¿Qué regiones tienen mayor carga de atenciones en adultos mayores?
SELECT
    u.REGION,
    SUM(f.CANTIDAD_ATENCIONES) AS atenciones_adulto_mayor
FROM datamart_sis.FACT_ATENCIONES_SIS f
JOIN datamart_sis.DIM_UBICACION u ON f.COD_UBIGEO = u.COD_UBIGEO
JOIN datamart_sis.DIM_GRUPO_EDAD ge ON f.GRUPO_EDAD = ge.GRUPO_EDAD
WHERE ge.GRUPO_EDAD = '60 - MAS AÑOS'
GROUP BY u.REGION
ORDER BY atenciones_adulto_mayor DESC
LIMIT 10;
