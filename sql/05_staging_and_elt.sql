-- ============================================================
-- DATAMART SIS — ELT puro en SQL
-- 05_staging_and_elt.sql
-- Tabla de staging + función de carga ELT
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STAGING: columnas crudas tal cual vienen del CSV (todo TEXT)
-- Orden de columnas debe coincidir con el CSV fuente:
-- AÑO,MES,REGION,PROVINCIA,UBIGEO_DISTRITO,DISTRITO,
-- COD_UNIDAD_EJECUTORA,DESC_UNIDAD_EJECUTORA,COD_IPRESS,IPRESS,
-- NIVEL_EESS,PLAN_SEGURO,COD_SERVICIO,DESC_SERVICIO,SEXO,GRUPO_EDAD,ATENCIONES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.stg_atenciones (
    anio                    TEXT,
    mes                     TEXT,
    region                  TEXT,
    provincia               TEXT,
    ubigeo_distrito         TEXT,
    distrito                TEXT,
    cod_unidad_ejecutora    TEXT,
    desc_unidad_ejecutora   TEXT,
    cod_ipress              TEXT,
    ipress                  TEXT,
    nivel_eess              TEXT,
    plan_seguro             TEXT,
    cod_servicio            TEXT,
    desc_servicio           TEXT,
    sexo                    TEXT,
    grupo_edad              TEXT,
    atenciones              TEXT
);

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN: fn_load_staging(p_fuente)
-- Toma lo que haya en stg_atenciones, normaliza, puebla
-- dimensiones (ON CONFLICT DO NOTHING) y carga el FACT.
-- Devuelve la cantidad de filas insertadas en el FACT.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION datamart_sis.fn_load_staging(p_fuente TEXT)
RETURNS BIGINT AS $$
DECLARE
    v_filas BIGINT;
BEGIN

    DROP TABLE IF EXISTS tmp_norm;

    CREATE TEMP TABLE tmp_norm AS
    SELECT
        anio::int                                                                       AS anio,
        mes::int                                                                        AS mes,
        (anio::int * 100 + mes::int)                                                    AS id_tiempo,
        LPAD(TRIM(ubigeo_distrito), 6, '0')                                             AS cod_ubigeo,
        COALESCE(NULLIF(UPPER(TRIM(distrito)), ''), 'SIN ESPECIFICAR')                  AS distrito,
        COALESCE(NULLIF(UPPER(TRIM(provincia)), ''), 'SIN ESPECIFICAR')                 AS provincia,
        COALESCE(NULLIF(UPPER(TRIM(region)), ''), 'SIN ESPECIFICAR')                    AS region,
        LPAD(TRIM(cod_ipress), 10, '0')                                                 AS cod_ipress,
        COALESCE(NULLIF(UPPER(TRIM(ipress)), ''), 'SIN NOMBRE')                         AS nombre_ipress,
        TRIM(cod_unidad_ejecutora)                                                       AS cod_unidad_ejecutora,
        COALESCE(NULLIF(UPPER(TRIM(desc_unidad_ejecutora)), ''), 'SIN ESPECIFICAR')      AS desc_unidad_ejecutora,
        CASE WHEN UPPER(TRIM(nivel_eess)) IN ('I','II','III')
             THEN UPPER(TRIM(nivel_eess)) ELSE '0' END                                  AS nivel_eess,
        COALESCE(NULLIF(UPPER(TRIM(plan_seguro)), ''), 'SIN ESPECIFICAR')               AS cod_plan_seguro,
        LPAD(TRIM(cod_servicio), 3, '0')                                                AS cod_servicio,
        COALESCE(NULLIF(UPPER(TRIM(desc_servicio)), ''), 'SIN DESCRIPCION')             AS desc_servicio,
        COALESCE(NULLIF(UPPER(TRIM(sexo)), ''), 'SIN ESPECIFICAR')                      AS sexo,
        COALESCE(NULLIF(UPPER(TRIM(grupo_edad)), ''), 'SIN ESPECIFICAR')                AS grupo_edad,
        atenciones::int                                                                  AS cantidad_atenciones
    FROM datamart_sis.stg_atenciones
    WHERE anio ~ '^\d+$'
      AND mes ~ '^\d+$'
      AND atenciones ~ '^\d+$'
      AND atenciones::int > 0;

    -- DIM_TIEMPO
    INSERT INTO datamart_sis.dim_tiempo
        (id_tiempo, anio, mes, desc_mes, trimestre, semestre, nombre_semestre, desc_trimestre)
    SELECT DISTINCT
        id_tiempo, anio, mes,
        CASE mes
            WHEN 1  THEN 'ENERO'      WHEN 2  THEN 'FEBRERO'   WHEN 3  THEN 'MARZO'
            WHEN 4  THEN 'ABRIL'      WHEN 5  THEN 'MAYO'      WHEN 6  THEN 'JUNIO'
            WHEN 7  THEN 'JULIO'      WHEN 8  THEN 'AGOSTO'    WHEN 9  THEN 'SEPTIEMBRE'
            WHEN 10 THEN 'OCTUBRE'    WHEN 11 THEN 'NOVIEMBRE' WHEN 12 THEN 'DICIEMBRE'
        END,
        ((mes - 1) / 3 + 1),
        ((mes - 1) / 6 + 1),
        CASE WHEN ((mes - 1) / 6 + 1) = 1 THEN 'PRIMER SEMESTRE' ELSE 'SEGUNDO SEMESTRE' END,
        CASE ((mes - 1) / 3 + 1)
            WHEN 1 THEN 'PRIMER TRIMESTRE' WHEN 2 THEN 'SEGUNDO TRIMESTRE'
            WHEN 3 THEN 'TERCER TRIMESTRE' ELSE   'CUARTO TRIMESTRE'
        END
    FROM tmp_norm
    ON CONFLICT (id_tiempo) DO NOTHING;

    -- DIM_UBICACION
    INSERT INTO datamart_sis.dim_ubicacion
        (cod_ubigeo, distrito, provincia, cod_provincia, region, cod_region)
    SELECT DISTINCT ON (cod_ubigeo)
        cod_ubigeo, distrito, provincia, LEFT(cod_ubigeo, 4), region, LEFT(cod_ubigeo, 2)
    FROM tmp_norm
    ORDER BY cod_ubigeo
    ON CONFLICT (cod_ubigeo) DO NOTHING;

    -- DIM_IPRESS
    INSERT INTO datamart_sis.dim_ipress
        (cod_ipress, nombre_ipress, cod_unidad_ejecutora, desc_unidad_ejecutora)
    SELECT DISTINCT ON (cod_ipress)
        cod_ipress, nombre_ipress, cod_unidad_ejecutora, desc_unidad_ejecutora
    FROM tmp_norm
    ORDER BY cod_ipress
    ON CONFLICT (cod_ipress) DO NOTHING;

    -- DIM_NIVEL_IPRESS (red de seguridad; I/II/III/0 ya sembrados en 06_seed_dims.sql)
    INSERT INTO datamart_sis.dim_nivel_ipress (nivel_eess, desc_nivel_eess, categoria_atencion)
    SELECT DISTINCT nivel_eess, 'SIN CLASIFICAR', 'NO APLICA'
    FROM tmp_norm
    ON CONFLICT (nivel_eess) DO NOTHING;

    -- DIM_PLAN_SEGURO
    INSERT INTO datamart_sis.dim_plan_seguro (cod_plan_seguro, desc_plan_seguro, regimen_financiamiento)
    SELECT DISTINCT
        cod_plan_seguro,
        cod_plan_seguro,
        CASE cod_plan_seguro
            WHEN 'SIS GRATUITO'      THEN 'SUBSIDIADO'
            WHEN 'SIS PARA TODOS'    THEN 'SUBSIDIADO'
            WHEN 'SIS INDEPENDIENTE' THEN 'CONTRIBUTIVO'
            WHEN 'SIS EMPRENDEDOR'   THEN 'SEMICONTRIBUTIVO'
            WHEN 'SIS MICROEMPRESA'  THEN 'SEMICONTRIBUTIVO'
            ELSE 'OTRO'
        END
    FROM tmp_norm
    ON CONFLICT (cod_plan_seguro) DO NOTHING;

    -- DIM_SERVICIO
    INSERT INTO datamart_sis.dim_servicio (cod_servicio, desc_servicio, tipo_servicio)
    SELECT DISTINCT ON (cod_servicio)
        cod_servicio, desc_servicio, NULL
    FROM tmp_norm
    ORDER BY cod_servicio
    ON CONFLICT (cod_servicio) DO NOTHING;

    -- DIM_SEXO (MASCULINO/FEMENINO ya sembrados; red de seguridad)
    INSERT INTO datamart_sis.dim_sexo (sexo, desc_sexo)
    SELECT DISTINCT sexo, sexo
    FROM tmp_norm
    ON CONFLICT (sexo) DO NOTHING;

    -- DIM_GRUPO_EDAD (grupos conocidos ya sembrados en 06_seed_dims.sql; red de seguridad)
    INSERT INTO datamart_sis.dim_grupo_edad (grupo_edad, edad_min, edad_max, etapa_vida)
    SELECT DISTINCT grupo_edad, NULL::smallint, NULL::smallint, 'SIN CLASIFICAR'
    FROM tmp_norm
    ON CONFLICT (grupo_edad) DO NOTHING;

    -- FACT — agrega filas con misma clave natural (la fuente puede tener duplicados)
    INSERT INTO datamart_sis.fact_atenciones_sis
        (id_tiempo, cod_ubigeo, cod_ipress, nivel_eess, cod_plan_seguro,
         cod_servicio, sexo, grupo_edad, cantidad_atenciones, fuente_archivo)
    SELECT
        id_tiempo, cod_ubigeo, cod_ipress, nivel_eess, cod_plan_seguro,
        cod_servicio, sexo, grupo_edad, SUM(cantidad_atenciones), p_fuente
    FROM tmp_norm
    GROUP BY id_tiempo, cod_ubigeo, cod_ipress, nivel_eess, cod_plan_seguro,
             cod_servicio, sexo, grupo_edad;

    GET DIAGNOSTICS v_filas = ROW_COUNT;

    DROP TABLE IF EXISTS tmp_norm;

    RETURN v_filas;
END;
$$ LANGUAGE plpgsql;
