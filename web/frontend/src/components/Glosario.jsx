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
    <div style={{ flex:1, overflowY:'auto', padding:'12px 20px 24px', display:'flex', flexDirection:'column', gap:0 }}>
      {/* Search */}
      <div style={{ position:'sticky', top:0, background:'var(--bg)', paddingBottom:12, paddingTop:4, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 12px' }}>
          <Search size={14} style={{ color:'var(--muted)', flexShrink:0 }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar término… (IPRESS, Nivel, SIS, ELT…)"
            style={{ border:'none', outline:'none', background:'transparent', width:'100%', fontSize:13, color:'var(--text)', fontFamily:"'Signika',sans-serif" }}
          />
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>{filtered.length} término{filtered.length!==1?'s':''}</div>
      </div>

      {/* Lista */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(t => (
          <div key={t.term} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:4, padding:'14px 16px', borderLeft:'3px solid var(--navy)' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap', marginBottom:6 }}>
              <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:14, color:'var(--navy)' }}>{t.term}</span>
              <span style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>{t.full}</span>
            </div>
            <p style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, margin:0 }}>{t.def}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--muted)', fontSize:13 }}>
            No se encontraron términos para "{q}"
          </div>
        )}
      </div>
    </div>
  )
}
