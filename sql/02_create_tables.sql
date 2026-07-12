-- ============================================================
-- DATAMART DE ATENCIONES DE SALUD — SIS
-- 02_create_tables.sql
-- Tabla de hechos principal
-- Motor: PostgreSQL (Supabase)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FACT_ATENCIONES_SIS
-- Tabla de hechos central del DataMart
-- Granularidad: una fila = combinación única de todas las
--               dimensiones para un periodo mensual dado
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datamart_sis.FACT_ATENCIONES_SIS (
    -- Clave sustituta
    ID_FACT                 BIGSERIAL       PRIMARY KEY,

    -- Claves foráneas a dimensiones
    ID_TIEMPO               INTEGER         NOT NULL
                                REFERENCES datamart_sis.DIM_TIEMPO(ID_TIEMPO),
    COD_UBIGEO              CHAR(6)         NOT NULL
                                REFERENCES datamart_sis.DIM_UBICACION(COD_UBIGEO),
    COD_IPRESS              VARCHAR(15)     NOT NULL
                                REFERENCES datamart_sis.DIM_IPRESS(COD_IPRESS),
    NIVEL_EESS              VARCHAR(5)      NOT NULL
                                REFERENCES datamart_sis.DIM_NIVEL_IPRESS(NIVEL_EESS),
    COD_PLAN_SEGURO         VARCHAR(30)     NOT NULL
                                REFERENCES datamart_sis.DIM_PLAN_SEGURO(COD_PLAN_SEGURO),
    COD_SERVICIO            VARCHAR(10)     NOT NULL
                                REFERENCES datamart_sis.DIM_SERVICIO(COD_SERVICIO),
    SEXO                    VARCHAR(10)     NOT NULL
                                REFERENCES datamart_sis.DIM_SEXO(SEXO),
    GRUPO_EDAD              VARCHAR(20)     NOT NULL
                                REFERENCES datamart_sis.DIM_GRUPO_EDAD(GRUPO_EDAD),

    -- Medidas (métricas)
    CANTIDAD_ATENCIONES     INTEGER         NOT NULL CHECK (CANTIDAD_ATENCIONES >= 0),

    -- Metadatos de carga ETL
    FECHA_CARGA             TIMESTAMP       NOT NULL DEFAULT NOW(),
    FUENTE_ARCHIVO          VARCHAR(100)
);

COMMENT ON TABLE datamart_sis.FACT_ATENCIONES_SIS IS
    'Tabla de hechos: atenciones de salud del SIS por periodo, ubicacion, IPRESS, servicio, sexo y grupo de edad';

COMMENT ON COLUMN datamart_sis.FACT_ATENCIONES_SIS.CANTIDAD_ATENCIONES IS
    'Suma de atenciones para la combinación de dimensiones del registro';

COMMENT ON COLUMN datamart_sis.FACT_ATENCIONES_SIS.FUENTE_ARCHIVO IS
    'Nombre del archivo CSV fuente del que proviene el registro (trazabilidad ETL)';

-- Clave natural única: cada combinación de dimensiones ocurre una sola vez
-- (la función fn_load_staging ya agrega con SUM antes de insertar)
ALTER TABLE datamart_sis.FACT_ATENCIONES_SIS
    ADD CONSTRAINT uq_fact_grain UNIQUE (
        ID_TIEMPO, COD_UBIGEO, COD_IPRESS, NIVEL_EESS, COD_PLAN_SEGURO,
        COD_SERVICIO, SEXO, GRUPO_EDAD
    );
