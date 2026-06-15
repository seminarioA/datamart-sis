-- ============================================================
-- DATAMART DE ATENCIONES DE SALUD — SIS
-- 03_indexes.sql
-- Índices para optimización de consultas analíticas
-- ============================================================

-- Índices sobre la tabla de hechos (columnas más consultadas)
CREATE INDEX IF NOT EXISTS idx_fact_tiempo
    ON datamart_sis.FACT_ATENCIONES_SIS (ID_TIEMPO);

CREATE INDEX IF NOT EXISTS idx_fact_ubigeo
    ON datamart_sis.FACT_ATENCIONES_SIS (COD_UBIGEO);

CREATE INDEX IF NOT EXISTS idx_fact_ipress
    ON datamart_sis.FACT_ATENCIONES_SIS (COD_IPRESS);

CREATE INDEX IF NOT EXISTS idx_fact_nivel
    ON datamart_sis.FACT_ATENCIONES_SIS (NIVEL_EESS);

CREATE INDEX IF NOT EXISTS idx_fact_plan
    ON datamart_sis.FACT_ATENCIONES_SIS (COD_PLAN_SEGURO);

CREATE INDEX IF NOT EXISTS idx_fact_servicio
    ON datamart_sis.FACT_ATENCIONES_SIS (COD_SERVICIO);

CREATE INDEX IF NOT EXISTS idx_fact_sexo
    ON datamart_sis.FACT_ATENCIONES_SIS (SEXO);

CREATE INDEX IF NOT EXISTS idx_fact_grupo_edad
    ON datamart_sis.FACT_ATENCIONES_SIS (GRUPO_EDAD);

-- Índice compuesto para consultas de tendencia temporal por región
CREATE INDEX IF NOT EXISTS idx_fact_tiempo_ubigeo
    ON datamart_sis.FACT_ATENCIONES_SIS (ID_TIEMPO, COD_UBIGEO);

-- Índice compuesto para consultas de servicio por nivel de establecimiento
CREATE INDEX IF NOT EXISTS idx_fact_nivel_servicio
    ON datamart_sis.FACT_ATENCIONES_SIS (NIVEL_EESS, COD_SERVICIO);

-- Índice compuesto para análisis por perfil demográfico
CREATE INDEX IF NOT EXISTS idx_fact_sexo_edad
    ON datamart_sis.FACT_ATENCIONES_SIS (SEXO, GRUPO_EDAD);

-- Índices sobre dimensiones (claves de búsqueda frecuentes)
CREATE INDEX IF NOT EXISTS idx_dim_ubicacion_region
    ON datamart_sis.DIM_UBICACION (REGION);

CREATE INDEX IF NOT EXISTS idx_dim_ubicacion_provincia
    ON datamart_sis.DIM_UBICACION (COD_PROVINCIA);

CREATE INDEX IF NOT EXISTS idx_dim_tiempo_anio
    ON datamart_sis.DIM_TIEMPO (ANIO);

CREATE INDEX IF NOT EXISTS idx_dim_tiempo_anio_mes
    ON datamart_sis.DIM_TIEMPO (ANIO, MES);

CREATE INDEX IF NOT EXISTS idx_dim_ipress_unidad
    ON datamart_sis.DIM_IPRESS (COD_UNIDAD_EJECUTORA);
