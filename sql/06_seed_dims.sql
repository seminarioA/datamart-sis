-- ============================================================
-- DATAMART SIS — Seed de dimensiones estáticas
-- 06_seed_dims.sql
-- ============================================================

INSERT INTO datamart_sis.dim_nivel_ipress (nivel_eess, desc_nivel_eess, categoria_atencion) VALUES
 ('I',   'PRIMER NIVEL DE ATENCIÓN',  'PRIMER NIVEL'),
 ('II',  'SEGUNDO NIVEL DE ATENCIÓN', 'SEGUNDO NIVEL'),
 ('III', 'TERCER NIVEL DE ATENCIÓN',  'TERCER NIVEL'),
 ('0',   'SIN NIVEL ASIGNADO',        'NO APLICA')
ON CONFLICT (nivel_eess) DO NOTHING;

INSERT INTO datamart_sis.dim_grupo_edad (grupo_edad, edad_min, edad_max, etapa_vida) VALUES
 ('00 - 04 AÑOS',  0,  4,  'NIÑO'),
 ('05 - 11 AÑOS',  5,  11, 'NIÑO'),
 ('12 - 17 AÑOS',  12, 17, 'ADOLESCENTE'),
 ('18 - 29 AÑOS',  18, 29, 'JOVEN'),
 ('30 - 59 AÑOS',  30, 59, 'ADULTO'),
 ('60 - MAS AÑOS', 60, 120, 'ADULTO MAYOR')
ON CONFLICT (grupo_edad) DO NOTHING;

INSERT INTO datamart_sis.dim_sexo (sexo, desc_sexo) VALUES
 ('MASCULINO', 'MASCULINO'),
 ('FEMENINO',  'FEMENINO')
ON CONFLICT (sexo) DO NOTHING;
