-- ============================================================
-- DATAMART DE ATENCIONES DE SALUD — SIS
-- 01_create_schema.sql
-- Creación del schema y tablas dimensionales
-- Motor: PostgreSQL (Supabase)
-- ============================================================

-- Schema principal
CREATE SCHEMA IF NOT EXISTS datamart_sis;

-- ────────────────────────────────────────────────────────────
-- DIM_TIEMPO
-- Dimensión temporal: año y mes de la atención
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_TIEMPO (
    ID_TIEMPO       INTEGER         PRIMARY KEY,  -- Formato YYYYMM
    ANIO            SMALLINT        NOT NULL,
    MES             SMALLINT        NOT NULL CHECK (MES BETWEEN 1 AND 12),
    DESC_MES        VARCHAR(20)     NOT NULL,
    TRIMESTRE       SMALLINT        NOT NULL CHECK (TRIMESTRE BETWEEN 1 AND 4),
    SEMESTRE        SMALLINT        NOT NULL CHECK (SEMESTRE BETWEEN 1 AND 2),
    NOMBRE_SEMESTRE VARCHAR(15)     NOT NULL,
    DESC_TRIMESTRE  VARCHAR(15)     NOT NULL
);

COMMENT ON TABLE datamart_sis.DIM_TIEMPO IS 'Dimensión temporal con granularidad mensual (YYYYMM)';

-- ────────────────────────────────────────────────────────────
-- DIM_UBICACION
-- Dimensión geográfica: región → provincia → distrito
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_UBICACION (
    COD_UBIGEO      CHAR(6)         PRIMARY KEY,  -- Código UBIGEO de 6 dígitos
    DISTRITO        VARCHAR(100)    NOT NULL,
    PROVINCIA       VARCHAR(100)    NOT NULL,
    COD_PROVINCIA   CHAR(4)         NOT NULL,
    REGION          VARCHAR(60)     NOT NULL,
    COD_REGION      CHAR(2)         NOT NULL
);

COMMENT ON TABLE datamart_sis.DIM_UBICACION IS 'Dimensión geográfica jerarquizada: Región > Provincia > Distrito (UBIGEO)';

-- ────────────────────────────────────────────────────────────
-- DIM_IPRESS
-- Institución Prestadora de Servicios de Salud
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_IPRESS (
    COD_IPRESS              VARCHAR(15)     PRIMARY KEY,
    NOMBRE_IPRESS           VARCHAR(200)    NOT NULL,
    COD_UNIDAD_EJECUTORA    VARCHAR(10),
    DESC_UNIDAD_EJECUTORA   VARCHAR(200)
);

COMMENT ON TABLE datamart_sis.DIM_IPRESS IS 'Establecimientos de salud (IPRESS) donde se realizaron las atenciones';

-- ────────────────────────────────────────────────────────────
-- DIM_NIVEL_IPRESS
-- Nivel de complejidad del establecimiento de salud
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_NIVEL_IPRESS (
    NIVEL_EESS          VARCHAR(5)      PRIMARY KEY,
    DESC_NIVEL_EESS     VARCHAR(80)     NOT NULL,
    CATEGORIA_ATENCION  VARCHAR(20)     NOT NULL
);

COMMENT ON TABLE datamart_sis.DIM_NIVEL_IPRESS IS 'Niveles de establecimientos de salud: I, II, III';

-- ────────────────────────────────────────────────────────────
-- DIM_PLAN_SEGURO
-- Planes de cobertura del SIS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_PLAN_SEGURO (
    COD_PLAN_SEGURO         VARCHAR(30)     PRIMARY KEY,
    DESC_PLAN_SEGURO        VARCHAR(60)     NOT NULL,
    REGIMEN_FINANCIAMIENTO  VARCHAR(30)     NOT NULL
);

COMMENT ON TABLE datamart_sis.DIM_PLAN_SEGURO IS 'Planes de seguro SIS: Gratuito, Para Todos, Independiente, Emprendedor, Microempresa';

-- ────────────────────────────────────────────────────────────
-- DIM_SERVICIO
-- Tipos de servicio / prestación de salud
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_SERVICIO (
    COD_SERVICIO    VARCHAR(10)     PRIMARY KEY,
    DESC_SERVICIO   VARCHAR(200)    NOT NULL,
    TIPO_SERVICIO   VARCHAR(40)
);

COMMENT ON TABLE datamart_sis.DIM_SERVICIO IS 'Servicios de salud prestados (consulta externa, emergencia, laboratorio, etc.)';

-- ────────────────────────────────────────────────────────────
-- DIM_SEXO
-- Sexo del paciente
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_SEXO (
    SEXO        VARCHAR(10)     PRIMARY KEY,
    DESC_SEXO   VARCHAR(20)     NOT NULL
);

COMMENT ON TABLE datamart_sis.DIM_SEXO IS 'Sexo del paciente atendido';

-- ────────────────────────────────────────────────────────────
-- DIM_GRUPO_EDAD
-- Grupos etarios definidos por el SIS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.DIM_GRUPO_EDAD (
    GRUPO_EDAD      VARCHAR(20)     PRIMARY KEY,
    EDAD_MIN        SMALLINT,
    EDAD_MAX        SMALLINT,
    ETAPA_VIDA      VARCHAR(20)
);

COMMENT ON TABLE datamart_sis.DIM_GRUPO_EDAD IS 'Grupos de edad tal como los define el SIS en sus datos abiertos';
