import React, { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, MapPin, Users, Stethoscope, Shield, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { fmt, fmtFull } from '../lib/format.js'
import { cn } from '@/lib/utils'

// Tokens desde CSS vars — nunca hex hardcoded
const STAKEHOLDERS = {
  MINSA:    { label: 'MINSA',             color: 'hsl(var(--primary))',  bg: 'hsl(var(--primary) / .10)',  border: 'hsl(var(--primary) / .30)'  },
  SIS:      { label: 'SIS',               color: 'hsl(var(--accent))',   bg: 'hsl(var(--accent) / .10)',   border: 'hsl(var(--accent) / .30)'   },
  REGIONAL: { label: 'Gobierno Regional', color: '#5a7010',              bg: 'rgba(175,204,70,.12)',        border: 'rgba(175,204,70,.40)'        },
  IPRESS:   { label: 'IPRESS',            color: '#b06010',              bg: 'rgba(246,166,74,.12)',        border: 'rgba(246,166,74,.40)'        },
}

const SEVERITY = {
  alta:  { color: 'hsl(var(--accent))',  label: 'Alta prioridad'  },
  media: { color: 'var(--orange)',        label: 'Prioridad media' },
  baja:  { color: 'var(--green)',         label: 'Prioridad baja'  },
}

function generateInsights(charts, kpis) {
  if (!charts || !kpis) return null
  const { anio, region, edad, servicios, plan } = charts
  const insights = []

  if (region?.length) {
    const total   = region.reduce((s, r) => s + Number(r.atenciones), 0)
    const top3    = region.slice(0, 3)
    const top3pct = top3.reduce((s, r) => s + Number(r.atenciones) / total * 100, 0)
    insights.push({
      id: 'geo', icon: MapPin, tipo: 'Concentración',
      severity: top3pct > 40 ? 'alta' : 'media',
      titulo: `Top 3 regiones concentran el ${top3pct.toFixed(0)}% de atenciones`,
      hallazgo: `${top3.map(r => r.region.split(' ')[0]).join(', ')} acumulan ${top3pct.toFixed(1)}% del total de atenciones SIS. ${region[region.length - 1]?.region} es la región con menor demanda.`,
      acciones: [
        { quien: 'REGIONAL', texto: `Fortalecer la red IPRESS en regiones de baja cobertura: ${region.slice(-4).map(r => r.region.split(' ')[0]).join(', ')}.` },
        { quien: 'SIS',      texto: 'Desarrollar campañas de afiliación activa en regiones con ratio IPRESS/asegurado por debajo del promedio nacional.' },
        { quien: 'MINSA',    texto: 'Revisar criterios de asignación presupuestal: incluir indicador de "cobertura potencial no captada" por región.' },
      ],
    })
  }

  if (anio?.length >= 2) {
    const sorted = [...anio].sort((a, b) => Number(a.anio) - Number(b.anio))
    const last   = Number(sorted[sorted.length - 1].atenciones)
    const prev   = Number(sorted[sorted.length - 2].atenciones)
    const growth = ((last - prev) / prev * 100).toFixed(1)
    insights.push({
      id: 'trend', icon: TrendingUp, tipo: 'Tendencia',
      severity: Math.abs(Number(growth)) > 15 ? 'alta' : 'media',
      titulo: `Variación anual: ${growth > 0 ? '+' : ''}${growth}% en atenciones`,
      hallazgo: `De ${sorted[sorted.length - 2].anio} a ${sorted[sorted.length - 1].anio} las atenciones pasaron de ${fmt(prev)} a ${fmt(last)} (${Number(growth) > 0 ? '+' : ''}${growth}%). El modelo predictivo proyecta continuar esta tendencia.`,
      acciones: [
        { quien: 'SIS',    texto: 'Proyectar incremento de contratos con IPRESS para absorber la demanda proyectada en los próximos 3 años.' },
        { quien: 'MINSA',  texto: 'Actualizar el Plan Estratégico Sectorial 2024-2030 incorporando el escenario de crecimiento sostenido del SIS.' },
        { quien: 'IPRESS', texto: 'Planificar ampliación de capacidad instalada (camas, consultorios, personal) con base en proyección de demanda.' },
      ],
    })
  }

  if (edad?.length) {
    const sorted    = [...edad].sort((a, b) => Number(b.atenciones) - Number(a.atenciones))
    const topGroup  = sorted[0]
    const totalEdad = edad.reduce((s, e) => s + Number(e.atenciones), 0)
    const topPct    = (Number(topGroup?.atenciones) / totalEdad * 100).toFixed(1)
    insights.push({
      id: 'edad', icon: Users, tipo: 'Demografía',
      severity: 'media',
      titulo: `Grupo "${topGroup?.grupo_edad}" concentra ${topPct}% de atenciones`,
      hallazgo: `La mayor demanda proviene del grupo ${topGroup?.grupo_edad} (${topPct}%). Los niños 00-04 años representan la mayor carga de atenciones preventivas (CRED, vacunas, nutrición), reflejando el impacto del SIS Gratuito materno-infantil.`,
      acciones: [
        { quien: 'IPRESS',   texto: 'Garantizar disponibilidad de médicos pediatras y personal especializado en IPRESS con alta demanda 00-04 años.' },
        { quien: 'SIS',      texto: 'Diseñar paquetes de atención diferenciados para el grupo etario de mayor carga, optimizando tiempos.' },
        { quien: 'REGIONAL', texto: 'Coordinar con DIRESA la distribución equitativa de vacunas y suplementos para la franja 00-04 años.' },
      ],
    })
  }

  if (servicios?.length) {
    const top1  = servicios[0]
    const total = servicios.reduce((s, sv) => s + Number(sv.atenciones), 0)
    const pct   = (Number(top1?.atenciones) / total * 100).toFixed(1)
    insights.push({
      id: 'servicio', icon: Stethoscope, tipo: 'Servicios',
      severity: 'baja',
      titulo: `Consulta Externa representa el ${pct}% de todas las atenciones`,
      hallazgo: `${top1?.servicio || 'Consulta Externa'} domina la demanda con ${pct}% del total. Los servicios preventivos (CRED, Detección Precoz) evidencian el enfoque del SIS en atención primaria.`,
      acciones: [
        { quien: 'MINSA',  texto: 'Fortalecer la Estrategia de Atención Primaria: ampliar número de médicos en primer nivel para reducir presión sobre hospitales.' },
        { quien: 'SIS',    texto: 'Revisar tarifas PEAS de consulta externa para que reflejen el costo real post-2019, incluyendo inflación de insumos.' },
        { quien: 'IPRESS', texto: 'Implementar sistemas de agendamiento digital para reducir tiempo de espera en Consulta Externa.' },
      ],
    })
  }

  if (plan?.length) {
    const total    = plan.reduce((s, p) => s + Number(p.atenciones), 0)
    const gratuito = plan.find(p => (p.desc_plan_seguro || p.cod_plan_seguro || '').includes('GRATUIT'))
    const gratPct  = gratuito ? (Number(gratuito.atenciones) / total * 100).toFixed(1) : null
    if (gratPct) {
      insights.push({
        id: 'plan', icon: Shield, tipo: 'Sostenibilidad',
        severity: Number(gratPct) > 95 ? 'alta' : 'media',
        titulo: `SIS Gratuito representa el ${gratPct}% de todas las atenciones`,
        hallazgo: `El ${gratPct}% de atenciones corresponde al plan subsidiado, lo que implica dependencia casi total del financiamiento estatal. Los planes contributivos tienen participación mínima.`,
        acciones: [
          { quien: 'SIS',      texto: 'Desarrollar estrategia de expansión de SIS Independiente: revisión de primas, simplificación de afiliación online.' },
          { quien: 'MINSA',    texto: 'Proponer al MEF incremento del Presupuesto Institucional para el SIS considerando proyección de demanda 2025-2030.' },
          { quien: 'REGIONAL', texto: 'Promover alianzas con gobiernos locales para cofinanciar el SIS en zonas con alta informalidad laboral.' },
        ],
      })
    }
  }

  return insights
}

function InsightCard({ insight }) {
  const [open, setOpen] = useState(false)
  const Icon = insight.icon
  const sv   = SEVERITY[insight.severity]

  return (
    <div className="island overflow-hidden" style={{ borderLeft: `3px solid ${sv.color}` }}>
      <button
        className="w-full text-left px-4 py-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Icon size={15} className="mt-0.5 shrink-0" style={{ color: sv.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="text-[10px] font-bold font-heading uppercase tracking-wider text-muted-foreground">
              {insight.tipo}
            </span>
          </div>
          <div className="text-[13px] font-semibold text-foreground leading-snug">{insight.titulo}</div>
          <div className="text-[12px] text-muted-foreground leading-relaxed mt-1">{insight.hallazgo}</div>
        </div>
        <div className="text-muted-foreground shrink-0 mt-0.5">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-border/50">
          <p className="text-[10px] font-bold font-heading uppercase tracking-wider text-muted-foreground mb-3">
            Acciones recomendadas
          </p>
          {insight.acciones.map((a, i) => {
            const st = STAKEHOLDERS[a.quien]
            return (
              <div key={i} className="flex gap-2.5 mb-3 last:mb-0 items-start">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: sv.color }} />
                <div className="flex-1 text-[12px] text-foreground leading-relaxed">
                  <span className="inline-flex items-center font-bold text-[10px] px-2 py-0.5 rounded mr-2 border"
                        style={{ color: st?.color, background: st?.bg, borderColor: st?.border }}>
                    {st?.label || a.quien}
                  </span>
                  {a.texto}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Acciones({ dark }) {
  const [data, setData]    = useState(null)
  const [kpis, setKpis]    = useState(null)
  const [loading, setLoad] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()).catch(() => ({})),
      fetch('/api/kpis').then(r => r.json()).catch(() => ({})),
    ]).then(([d, k]) => { setData(d); setKpis(k); setLoad(false) })
  }, [])

  const insights = data && kpis ? generateInsights(data, kpis) : null
  const altas    = insights?.filter(i => i.severity === 'alta').length || 0

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-6 pt-3 flex flex-col gap-3 min-h-0">

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-bold text-[14px] text-foreground">
            Acciones por partes interesadas
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
            Hallazgos del análisis SIS {kpis?.anio_inicio}–{kpis?.anio_fin} con recomendaciones
            dirigidas a MINSA, SIS, Gobiernos Regionales e IPRESS.
          </p>
        </div>
        {altas > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-1.5">
            <AlertTriangle size={12} />
            {altas} de alta prioridad
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {Object.values(STAKEHOLDERS).map(s => (
          <span key={s.label}
                className="text-[10px] font-bold px-2.5 py-1 rounded-md border"
                style={{ color: s.color, background: s.bg, borderColor: s.border }}>
            {s.label}
          </span>
        ))}
        <span className="text-[10px] text-muted-foreground self-center">— destinatario de cada acción</span>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
          Analizando datos…
        </div>
      ) : insights?.length ? (
        <div className="flex flex-col gap-2.5">
          {[...insights]
            .sort((a, b) => ({ alta:0, media:1, baja:2 }[a.severity] - { alta:0, media:1, baja:2 }[b.severity]))
            .map(i => <InsightCard key={i.id} insight={i} />)
          }
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground text-center py-10">
          Los datos aún están cargando. Vuelve cuando las vistas materializadas estén listas.
        </div>
      )}

      {kpis?.total_registros && (
        <div className="island px-4 py-3 text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Nota metodológica:</strong>{' '}
          Las recomendaciones se generan automáticamente desde el análisis estadístico
          de {fmtFull(kpis.total_registros)} registros de atenciones SIS.
          Son orientativas y deben validarse con profesionales de salud pública antes de su implementación.
        </div>
      )}
    </div>
  )
}
