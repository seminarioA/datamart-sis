import React, { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Map, TrendingUp, BookOpen, BarChart2 } from 'lucide-react'

const STEPS = [
  {
    icon: LayoutDashboard,
    title: 'Bienvenido a DataMart SIS',
    desc: 'Dashboard de inteligencia de negocios sobre 14+ millones de atenciones de salud del Seguro Integral de Salud (SIS) del Perú, 2017–2025.',
    hint: 'Navega por los módulos usando la barra lateral izquierda.',
  },
  {
    icon: BarChart2,
    title: 'Módulo Resumen',
    desc: 'Vista completa con KPIs, mapa coroplético, gráficos de tendencia anual, distribución por sexo, nivel EESS, top regiones, servicios y grupos de edad.',
    hint: 'Haz clic en cualquier KPI para ver su definición y evolución histórica.',
  },
  {
    icon: Map,
    title: 'Módulo Mapa',
    desc: 'Mapa interactivo del Perú coloreado por intensidad de atenciones por departamento. Haz clic en un departamento para ver su detalle.',
    hint: 'Usa los módulos Demografía, Geografía y Servicios para análisis más profundos.',
  },
  {
    icon: TrendingUp,
    title: 'Módulo Predicciones',
    desc: 'Analítica predictiva con regresión lineal OLS: forecast de atenciones 2026–2028, índice de estacionalidad mensual y proyección regional.',
    hint: 'El modelo tiene R²=1.0 con 2 años de datos — mejorará conforme se carguen más años.',
  },
  {
    icon: BookOpen,
    title: 'Glosario de términos',
    desc: 'En el módulo Glosario encontrarás definiciones de todos los términos técnicos: IPRESS, Nivel EESS, Plan de Seguro, MV, ELT, DAG y más.',
    hint: '¡Listo! Cierra esta guía y empieza a explorar.',
  },
]

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const S = STEPS[step]
  const Icon = S.icon

  const next = () => step < STEPS.length-1 ? setStep(s=>s+1) : onClose()
  const prev = () => setStep(s=>s-1)

  // Cerrar con Escape
  useEffect(() => {
    const h = e => { if (e.key==='Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.55)', backdropFilter:'blur(3px)' }}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, maxWidth:480, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,.3)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ background:'var(--navy)', padding:'20px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <img src="/sis_logo.png" alt="SIS" style={{ height:28 }} />
            <span style={{ color:'rgba(255,255,255,.8)', fontSize:11, fontFamily:"'Montserrat',sans-serif", fontWeight:600, letterSpacing:'.05em', textTransform:'uppercase' }}>
              Guía rápida
            </span>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.1)', border:'none', borderRadius:4, padding:'4px 8px', color:'rgba(255,255,255,.7)', cursor:'pointer', fontSize:11 }}>
            Saltar
          </button>
        </div>

        {/* Contenido */}
        <div style={{ padding:'28px 28px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', width:56, height:56, background:'var(--bg)', borderRadius:12, margin:'0 auto 16px', border:'2px solid var(--navy)' }}>
            <Icon size={24} style={{ color:'var(--navy)' }} />
          </div>
          <h2 style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:18, color:'var(--text)', textAlign:'center', margin:'0 0 10px' }}>{S.title}</h2>
          <p style={{ fontSize:14, color:'var(--text)', lineHeight:1.7, textAlign:'center', margin:'0 0 16px' }}>{S.desc}</p>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'10px 14px', fontSize:12, color:'var(--muted)', textAlign:'center' }}>
            💡 {S.hint}
          </div>
        </div>

        {/* Progress dots */}
        <div style={{ display:'flex', justifyContent:'center', gap:6, paddingBottom:4 }}>
          {STEPS.map((_, i) => (
            <div key={i} onClick={()=>setStep(i)} style={{ width: i===step?20:8, height:8, borderRadius:4, background: i===step?'var(--navy)':'var(--border)', cursor:'pointer', transition:'all .2s' }} />
          ))}
        </div>

        {/* Footer nav */}
        <div style={{ padding:'12px 24px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={prev} disabled={step===0}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 16px', border:'1px solid var(--border)', borderRadius:4, background:'transparent', color: step===0?'var(--border)':'var(--text)', cursor: step===0?'default':'pointer', fontSize:13, fontFamily:"'Signika',sans-serif" }}>
            <ChevronLeft size={14} /> Anterior
          </button>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{step+1} / {STEPS.length}</span>
          <button onClick={next}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'8px 16px', border:'none', borderRadius:4, background:'var(--navy)', color:'#fff', cursor:'pointer', fontSize:13, fontFamily:"'Signika',sans-serif", fontWeight:600 }}>
            {step===STEPS.length-1 ? 'Comenzar' : 'Siguiente'} <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
