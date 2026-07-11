import React, { useState } from 'react'
import { Search } from 'lucide-react'

const TERMINOS = [
  { term:'SIS', full:'Seguro Integral de Salud', def:'Institución Administradora de Fondos de Aseguramiento en Salud (IAFAS) adscrita al MINSA. Es la aseguradora pública de salud más grande del Perú, cubriendo a quienes no cuentan con otro seguro.' },
  { term:'IPRESS', full:'Institución Prestadora de Servicios de Salud', def:'Establecimientos de salud (hospitales, centros de salud, postas) autorizados para brindar atenciones a los asegurados del SIS. Pueden ser dependientes del MINSA, gobiernos regionales o privados convenidos.' },
  { term:'Atención', full:'Prestación de salud', def:'Cada contacto de un asegurado con el sistema de salud: consulta médica, procedimiento, hospitalización, emergencia, etc. Una visita puede generar múltiples atenciones según los servicios recibidos.' },
  { term:'Nivel EESS', full:'Nivel de Establecimiento de Salud', def:'Categoría de complejidad del establecimiento. Nivel I: atención primaria (postas, centros de salud). Nivel II: especialidades básicas (hospitales locales). Nivel III: alta complejidad (hospitales de referencia nacional).' },
  { term:'Plan de Seguro', full:'Modalidad de afiliación al SIS', def:'Tipo de cobertura del asegurado. SIS Gratuito: subsidiado totalmente por el Estado para población en pobreza. SIS Para Todos: cualquier ciudadano. SIS Independiente: trabajadores independientes (contributivo). SIS Emprendedor/Microempresa: regímenes especiales.' },
  { term:'Ubigeo', full:'Código de Ubicación Geográfica', def:'Código de 6 dígitos que identifica cada división político-administrativa del Perú: los 2 primeros = región, los 2 siguientes = provincia, los 2 últimos = distrito. Usado para georeferencia de atenciones.' },
  { term:'MINSA', full:'Ministerio de Salud', def:'Órgano rector del sector salud en el Perú. Bajo su tutela opera el SIS. Publica datos abiertos de atenciones en la Plataforma Nacional de Datos Abiertos (datosabiertos.gob.pe).' },
  { term:'MV / Vista Materializada', full:'Materialized View (PostgreSQL)', def:'Tabla precalculada que almacena el resultado de una query compleja. Permite respuestas en milisegundos para consultas que normalmente tomarían minutos sobre 14M+ registros. Se refresca cada hora con el DAG refresh_mvs.' },
  { term:'ELT', full:'Extract, Load, Transform', def:'Proceso de carga de datos: los ZIPs se descargan del portal MINSA (Extract), se cargan en staging (Load) y luego una función SQL transforma y normaliza los datos al esquema star (Transform).' },
  { term:'Star Schema', full:'Esquema estrella (modelo dimensional)', def:'Modelo de base de datos para analytics. Una tabla de hechos central (fact_atenciones_sis) con medidas numéricas, conectada a tablas de dimensiones (tiempo, región, IPRESS, servicio, etc.) que proveen contexto.' },
  { term:'Staging', full:'Área de datos crudos', def:'Tabla temporal (stg_atenciones) donde se cargan los CSV del MINSA sin transformación. Todos los campos son TEXT para evitar errores de tipo. La función fn_load_staging() toma estos datos y los normaliza al datamart.' },
  { term:'DAG', full:'Directed Acyclic Graph (Airflow)', def:'Flujo de trabajo en Apache Airflow definido como un grafo dirigido sin ciclos. El proyecto tiene 2 DAGs: elt_sis (carga de datos, se corre manualmente) y refresh_mvs (refresca vistas materializadas, corre cada hora).' },
  { term:'R² (R-cuadrado)', full:'Coeficiente de determinación', def:'Métrica de ajuste del modelo de regresión. Rango 0–1. R²=1 significa que el modelo explica el 100% de la varianza (perfectamente ajustado). Con solo 2 años de datos, cualquier línea tiene R²=1 — el valor es más informativo con más puntos.' },
  { term:'CAGR', full:'Compound Annual Growth Rate', def:'Tasa de crecimiento anual compuesta. Mide el crecimiento porcentual anual promedio de una métrica a lo largo del tiempo. Usado en las proyecciones regionales del módulo Predicciones.' },
  { term:'Cloudflare Tunnel', full:'Túnel de acceso público sin puertos abiertos', def:'Tecnología que expone servicios locales a internet a través de un proceso saliente (cloudflared), sin necesidad de abrir puertos en el firewall del servidor. Las URLs son temporales y cambian en cada reinicio.' },
]

export default function Glosario() {
  const [q, setQ] = useState('')
  const filtered = q.length < 2
    ? TERMINOS
    : TERMINOS.filter(t =>
        t.term.toLowerCase().includes(q.toLowerCase()) ||
        t.full.toLowerCase().includes(q.toLowerCase()) ||
        t.def.toLowerCase().includes(q.toLowerCase())
      )

  return (
    <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
      <div className="sticky top-0 bg-background px-5 pt-3 pb-3 z-10">
        <div className="island flex items-center gap-2.5 px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/50">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar término… (IPRESS, Nivel, SIS, ELT…)"
            className="border-none outline-none bg-transparent w-full text-[13px] text-foreground placeholder:text-muted-foreground"
            style={{ fontFamily: "'Signika', sans-serif" }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5 px-0.5">
          {filtered.length} término{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="flex flex-col gap-2 px-5 pb-6">
        {filtered.map(t => (
          <div key={t.term} className="island px-4 py-3.5">
            <div className="flex items-baseline gap-2.5 flex-wrap mb-1.5">
              <span className="font-heading font-bold text-[14px] text-primary">{t.term}</span>
              <span className="text-[11px] text-muted-foreground italic">{t.full}</span>
            </div>
            <p className="text-[13px] text-foreground leading-relaxed m-0">{t.def}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[13px] text-muted-foreground">
            No se encontraron términos para "{q}"
          </div>
        )}
      </div>
    </div>
  )
}
