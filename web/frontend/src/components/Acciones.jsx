import React, { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, MapPin, Users, Stethoscope, Shield, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { fmt, fmtFull } from '../lib/format.js'

// Stakeholders a los que va dirigida cada acción
const STAKEHOLDERS = {
  MINSA:    { label:'MINSA',            color:'hsl(var(--primary))', bg:'color-mix(in srgb, hsl(var(--primary)) 10%, white)' },
  SIS:      { label:'SIS',              color:'hsl(var(--accent))',  bg:'color-mix(in srgb, hsl(var(--accent)) 10%, white)' },
  REGIONAL: { label:'Gobierno Regional', color:'var(--green)',       bg:'color-mix(in srgb, var(--green) 12%, white)' },
  IPRESS:   { label:'IPRESS',           color:'var(--orange)',       bg:'color-mix(in srgb, var(--orange) 12%, white)' },
}

// Genera hallazgos e insights basados en los datos reales del dashboard
function generateInsights(charts, kpis) {
  if (!charts || !kpis) return null
  const { anio, region, sexo, nivel, servicios, edad, plan } = charts

  const insights = []

  // ── 1. Concentración geográfica ──────────────────────────────────────────
  if (region?.length) {
    const total = region.reduce((s,r)=>s+Number(r.atenciones),0)
    const top3  = region.slice(0,3)
    const top3pct = top3.reduce((s,r)=>s+Number(r.atenciones)/total*100,0)
    insights.push({
      id:'geo',
      icon: MapPin,
      tipo: 'Concentración',
      severity: top3pct > 40 ? 'alta' : 'media',
      titulo: `Top 3 regiones concentran el ${top3pct.toFixed(0)}% de atenciones`,
      hallazgo: `${top3.map(r=>r.region.split(' ')[0]).join(', ')} acumulan ${top3pct.toFixed(1)}% del total de atenciones SIS. ${region[region.length-1]?.region} es la región con menor demanda.`,
      acciones: [
        { quien: 'REGIONAL', texto:`Fortalecer la red IPRESS en regiones de baja cobertura: ${region.slice(-4).map(r=>r.region.split(' ')[0]).join(', ')}.` },
        { quien: 'SIS',      texto:`Desarrollar campañas de afiliación activa en regiones con ratio IPRESS/asegurado por debajo del promedio nacional.` },
        { quien: 'MINSA',    texto:`Revisar criterios de asignación presupuestal: incluir indicador de "cobertura potencial no captada" por región.` },
      ]
    })
  }

  // ── 2. Tendencia de crecimiento ──────────────────────────────────────────
  if (anio?.length >= 2) {
    const sorted = [...anio].sort((a,b)=>Number(a.anio)-Number(b.anio))
    const last = Number(sorted[sorted.length-1].atenciones)
    const prev = Number(sorted[sorted.length-2].atenciones)
    const growth = ((last-prev)/prev*100).toFixed(1)
    const trend  = last > prev ? 'crecimiento' : 'descenso'
    insights.push({
      id:'trend',
      icon: TrendingUp,
      tipo: 'Tendencia',
      severity: Math.abs(Number(growth)) > 15 ? 'alta' : 'media',
      titulo: `${trend === 'crecimiento' ? '↑' : '↓'} ${Math.abs(growth)}% de variación anual en atenciones`,
      hallazgo: `De ${sorted[sorted.length-2].anio} a ${sorted[sorted.length-1].anio} las atenciones pasaron de ${fmt(prev)} a ${fmt(last)} (${growth > 0 ? '+' : ''}${growth}%). El modelo predictivo proyecta continuar esta tendencia.`,
      acciones: [
        { quien: 'SIS',      texto:`Proyectar incremento de contratos con IPRESS para absorber la demanda proyectada en los próximos 3 años.` },
        { quien: 'MINSA',    texto:`Actualizar el Plan Estratégico Sectorial 2024-2030 incorporando el escenario de crecimiento sostenido del SIS.` },
        { quien: 'IPRESS',   texto:`Planificar ampliación de capacidad instalada (camas, consultorios, personal) con base en proyección de demanda.` },
      ]
    })
  }

  // ── 3. Demanda por grupos de edad ────────────────────────────────────────
  if (edad?.length) {
    const sorted = [...edad].sort((a,b)=>Number(b.atenciones)-Number(a.atenciones))
    const topGroup = sorted[0]
    const totalEdad = edad.reduce((s,e)=>s+Number(e.atenciones),0)
    const topPct = (Number(topGroup?.atenciones)/totalEdad*100).toFixed(1)
    insights.push({
      id:'edad',
      icon: Users,
      tipo: 'Demografía',
      severity: 'media',
      titulo: `Grupo "${topGroup?.grupo_edad}" concentra ${topPct}% de atenciones`,
      hallazgo: `La mayor demanda proviene del grupo ${topGroup?.grupo_edad} (${topPct}%). Los niños 00-04 años representan la mayor carga de atenciones preventivas (CRED, vacunas, nutrición), lo que refleja el impacto del SIS Gratuito materno-infantil.`,
      acciones: [
        { quien: 'IPRESS',   texto:`Garantizar disponibilidad de médicos pediatras y personal de enfermería especializado en las IPRESS con alta demanda 00-04 años.` },
        { quien: 'SIS',      texto:`Diseñar paquetes de atención diferenciados para el grupo etario de mayor carga, optimizando tiempos de atención.` },
        { quien: 'REGIONAL', texto:`Coordinar con DIRESA la distribución equitativa de vacunas y suplementos nutricionales para la franja 00-04 años.` },
      ]
    })
  }

  // ── 4. Tipo de servicio más demandado ────────────────────────────────────
  if (servicios?.length) {
    const top1 = servicios[0]
    const total = servicios.reduce((s,sv)=>s+Number(sv.atenciones),0)
    const pct   = (Number(top1?.atenciones)/total*100).toFixed(1)
    insights.push({
      id:'servicio',
      icon: Stethoscope,
      tipo: 'Servicios',
      severity: 'baja',
      titulo: `Consulta Externa = ${pct}% de todas las atenciones`,
      hallazgo: `${top1?.servicio || 'Consulta Externa'} domina la demanda con ${pct}% del total. Los servicios preventivos (Control de Crecimiento, Detección Precoz) están en los primeros lugares, evidenciando el enfoque del SIS en atención primaria.`,
      acciones: [
        { quien: 'MINSA',    texto:`Fortalecer la Estrategia Sanitaria de Atención Primaria: ampliar número de médicos en primer nivel para reducir presión sobre hospitales.` },
        { quien: 'SIS',      texto:`Revisar tarifas PEAS de consulta externa para que reflejen el costo real post-2019, incluyendo inflación de insumos médicos.` },
        { quien: 'IPRESS',   texto:`Implementar sistemas de agendamiento digital para reducir tiempo de espera en Consulta Externa, principal cuello de botella.` },
      ]
    })
  }

  // ── 5. Plan de Seguro ────────────────────────────────────────────────────
  if (plan?.length) {
    const total = plan.reduce((s,p)=>s+Number(p.atenciones),0)
    const gratuito = plan.find(p=>(p.desc_plan_seguro||p.cod_plan_seguro||'').includes('GRATUIT'))
    const gratPct = gratuito ? (Number(gratuito.atenciones)/total*100).toFixed(1) : null
    if (gratPct) {
      insights.push({
        id:'plan',
        icon: Shield,
        tipo: 'Sostenibilidad',
        severity: Number(gratPct) > 95 ? 'alta' : 'media',
        titulo: `SIS Gratuito representa el ${gratPct}% de todas las atenciones`,
        hallazgo: `El ${gratPct}% de atenciones corresponde al plan subsidiado (SIS Gratuito), lo que implica una dependencia casi total del financiamiento estatal. Los planes contributivos (Independiente, Emprendedor, Microempresa) tienen participación mínima.`,
        acciones: [
          { quien: 'SIS',      texto:`Desarrollar estrategia de expansión de SIS Independiente y SIS Emprendedor: revisión de primas, simplificación de afiliación online.` },
          { quien: 'MINSA',    texto:`Proponer al MEF incremento del Presupuesto Institucional para el SIS considerando proyección de demanda 2025-2030.` },
          { quien: 'REGIONAL', texto:`Promover alianzas con gobiernos locales para cofinanciar el SIS en zonas con alta informalidad laboral.` },
        ]
      })
    }
  }

  return insights
}

const SEVERITY_COLORS = {
  alta:  { bg:'color-mix(in srgb, hsl(var(--accent)) 6%, white)', border:'hsl(var(--accent))', badge:'hsl(var(--accent))', label:'Prioridad Alta' },
  media: { bg:'color-mix(in srgb, var(--orange) 8%, white)',      border:'var(--orange)',      badge:'var(--orange)',      label:'Prioridad Media' },
  baja:  { bg:'color-mix(in srgb, var(--green) 8%, white)',       border:'var(--green)',       badge:'var(--green)',       label:'Prioridad Baja' },
}

function InsightCard({ insight }) {
  const [open, setOpen] = useState(false)
  const Icon = insight.icon
  const sv = SEVERITY_COLORS[insight.severity]

  return (
    <div style={{ border:`1px solid ${sv.border}`, borderRadius:6, marginBottom:12, overflow:'hidden' }}>
      {/* Header del card */}
      <div
        onClick={()=>setOpen(v=>!v)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v=>!v) } }}
        style={{ background:sv.bg, padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'flex-start', gap:12 }}
      >
        <div style={{ width:36, height:36, borderRadius:8, background:sv.badge, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <Icon size={18} color="hsl(var(--accent-foreground))" />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
            <span style={{ fontSize:10, fontWeight:700, color:sv.badge, textTransform:'uppercase', letterSpacing:'.06em' }}>{insight.tipo}</span>
            <span style={{ fontSize:10, fontWeight:600, background:sv.badge, color:'hsl(var(--accent-foreground))', padding:'1px 7px', borderRadius:10 }}>{sv.label}</span>
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', lineHeight:1.4 }}>{insight.titulo}</div>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>{insight.hallazgo}</div>
        </div>
        <div style={{ color:'var(--muted)', flexShrink:0, marginTop:4 }}>
          {open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </div>
      </div>

      {/* Acciones (Progressive Disclosure) */}
      {open && (
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${sv.border}`, background:'var(--surface)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10, fontFamily:"'Montserrat',sans-serif" }}>
            Acciones recomendadas
          </div>
          {insight.acciones.map((a,i) => {
            const st = STAKEHOLDERS[a.quien]
            return (
              <div key={i} style={{ display:'flex', gap:10, marginBottom:10, alignItems:'flex-start' }}>
                <CheckCircle2 size={15} style={{ color:sv.badge, flexShrink:0, marginTop:2 }} />
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:10, fontWeight:700, background:st?.bg||'var(--bg)', color:st?.color||'var(--navy)', padding:'1px 8px', borderRadius:10, marginRight:8, border:`1px solid ${st?.color||'var(--border)'}` }}>
                    {st?.label || a.quien}
                  </span>
                  <span style={{ fontSize:12, color:'var(--text)', lineHeight:1.5 }}>{a.texto}</span>
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
  const [data, setData] = useState(null)
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r=>r.json()),
      fetch('/api/kpis').then(r=>r.json()),
    ]).then(([d, k]) => {
      setData(d)
      setKpis(k)
      setLoading(false)
    }).catch(() => {
      setError('No se pudo conectar con el servidor')
      setLoading(false)
    })
  }, [])

  const insights = data && kpis ? generateInsights(data, kpis) : null
  const altas = insights?.filter(i=>i.severity==='alta').length || 0

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'12px 20px 24px' }}>
      {/* Header explicativo */}
      <div style={{ background:'var(--navy)', borderRadius:6, padding:'16px 20px', marginBottom:16, color:'hsl(var(--primary-foreground))' }}>
        <div style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:15, marginBottom:6 }}>
          🎯 Acciones Concretas para Partes Interesadas
        </div>
        <p style={{ fontSize:12, color:'rgba(255,255,255,.8)', lineHeight:1.6, margin:0 }}>
          Hallazgos del análisis de datos SIS {kpis?.anio_inicio}–{kpis?.anio_fin} con recomendaciones priorizadas
          por impacto, dirigidas a <strong>MINSA, SIS, Gobiernos Regionales e IPRESS</strong>.
          {altas > 0 && <span style={{ display:'inline-block', background:'hsl(var(--accent))', borderRadius:4, padding:'1px 8px', marginLeft:8, fontSize:11, fontWeight:700 }}>⚠️ {altas} acción{altas>1?'es':''} de alta prioridad</span>}
        </p>
      </div>

      {/* Leyenda de stakeholders */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {Object.entries(STAKEHOLDERS).map(([k,s]) => (
          <span key={k} style={{ fontSize:10, fontWeight:700, background:s.bg, color:s.color, padding:'3px 10px', borderRadius:10, border:`1px solid ${s.color}` }}>
            {s.label}
          </span>
        ))}
        <span style={{ fontSize:10, color:'var(--muted)', alignSelf:'center' }}>← destinatario de cada acción</span>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>Analizando datos…</div>
      ) : error ? (
        <div style={{ textAlign:'center', padding:40, color:'hsl(var(--accent))' }}>
          {error}. Intenta recargar la página.
        </div>
      ) : insights?.length ? (
        <div>
          {/* Ordenar: alta primero */}
          {[...insights].sort((a,b)=>({ alta:0, media:1, baja:2 }[a.severity]-({ alta:0, media:1, baja:2 }[b.severity])))
            .map(i => <InsightCard key={i.id} insight={i} />)}
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>
          Los datos aún están cargando. Vuelve cuando las vistas materializadas estén listas.
        </div>
      )}

      <div style={{ marginTop:16, fontSize:11, color:'var(--muted)', background:'var(--bg)', padding:'10px 14px', borderRadius:4, lineHeight:1.7 }}>
        <strong>Nota metodológica:</strong> Las recomendaciones se generan automáticamente desde el análisis estadístico de {fmtFull(kpis?.total_registros)} registros de atenciones SIS.
        Son orientativas — deben validarse con profesionales de salud pública, economistas del sector salud y representantes de los gobiernos regionales antes de su implementación.
      </div>
    </div>
  )
}
