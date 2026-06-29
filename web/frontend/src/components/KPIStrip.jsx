import React, { useState } from 'react'
import { HelpCircle, X, TrendingUp } from 'lucide-react'
import { fmt, fmtFull } from '../lib/format.js'

const KPI_META = {
  'kpi-atenciones': {
    label: 'Total Atenciones', accent: true,
    tip: 'Suma de todas las prestaciones de salud registradas en el datamart. Incluye consultas, procedimientos, hospitalizaciones y emergencias de asegurados SIS.',
  },
  'kpi-periodo': {
    label: 'Periodo',
    tip: 'Rango de años cubiertos por los datos cargados. El SIS publica datos anuales y semestrales en la Plataforma Nacional de Datos Abiertos del Perú.',
  },
  'kpi-regiones': {
    label: 'Regiones',
    tip: 'Cantidad de regiones (departamentos) del Perú con al menos una atención registrada. El Perú tiene 25 regiones más la Provincia Constitucional del Callao.',
  },
  'kpi-ipress': {
    label: 'IPRESS Activas',
    tip: 'IPRESS: Institución Prestadora de Servicios de Salud. Establecimientos (centros de salud, hospitales, clínicas) que atendieron asegurados SIS en el período.',
  },
  'kpi-servicios': {
    label: 'Tipos de Servicio',
    tip: 'Cantidad de tipos de servicio distintos (Medicina General, Odontología, Laboratorio, etc.). Cada prestación pertenece a un servicio específico.',
  },
  'kpi-planes': {
    label: 'Planes de Seguro',
    tip: 'Modalidades de afiliación: SIS Gratuito (subsidiado), SIS Para Todos, SIS Independiente (contributivo), SIS Emprendedor, SIS Microempresa.',
  },
}

function Tooltip({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
      <button
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0, lineHeight: 1, display: 'inline-flex' }}
      >
        <HelpCircle size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: 'var(--surface)',
          fontSize: 11, lineHeight: 1.6, padding: '8px 10px',
          borderRadius: 4, width: 220, zIndex: 999,
          boxShadow: '0 4px 16px rgba(0,0,0,.25)', pointerEvents: 'none',
          fontWeight: 400,
        }}>
          {text}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderWidth: '5px 5px 0', borderStyle: 'solid',
            borderColor: 'var(--text) transparent transparent',
          }} />
        </div>
      )}
    </span>
  )
}

function KPIDrawer({ meta, value, rawData, onClose }) {
  const anio = rawData?.anio ?? []
  const max = Math.max(...anio.map(x => Number(x.atenciones)), 1)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }} onClick={onClose}>
      <div
        style={{
          width: 340, height: '100vh', background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          boxShadow: '-4px 0 24px rgba(0,0,0,.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--navy)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: "'Montserrat',sans-serif" }}>{meta.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: meta.accent ? 'var(--accent)' : 'var(--navy)', fontFamily: "'Montserrat',sans-serif", marginTop: 2 }}>{value}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', marginTop: 2 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, fontFamily: "'Montserrat',sans-serif" }}>Definicion</div>
          <p style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.7 }}>{meta.tip}</p>
        </div>

        {anio.length > 0 && (
          <div style={{ padding: '0 16px 16px', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Montserrat',sans-serif" }}>
              <TrendingUp size={12} /> Evolucion Anual
            </div>
            {anio.map((d, i) => {
              const pct = Math.round((Number(d.atenciones) / max) * 100)
              const prev = i > 0 ? Number(anio[i - 1].atenciones) : null
              const delta = prev ? ((Number(d.atenciones) - prev) / prev * 100).toFixed(1) : null
              return (
                <div key={d.anio} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{d.anio}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
                      {delta && <span style={{ color: Number(delta) >= 0 ? 'var(--green)' : 'var(--accent)', fontWeight: 600 }}>{Number(delta) >= 0 ? '+' : ''}{delta}%</span>}
                      {fmt(Number(d.atenciones))}
                    </span>
                  </div>
                  <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--navy)', borderRadius: 3, transition: 'width .4s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function KPI({ meta, value, onClick }) {
  const isLoading = value == null
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)', padding: '12px 14px', textAlign: 'center',
      className: 'kpi-cell',
        cursor: onClick && !isLoading ? 'pointer' : 'default',
        transition: 'background .12s', userSelect: 'none',
      }}
      onMouseEnter={e => onClick && !isLoading && (e.currentTarget.style.background = 'var(--bg)')}
      onMouseLeave={e => onClick && !isLoading && (e.currentTarget.style.background = 'var(--surface)')}
    >
      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        {meta.label}
        <Tooltip text={meta.tip} />
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700, fontFamily: "'Montserrat',sans-serif",
        fontVariantNumeric: 'tabular-nums',
        color: isLoading ? 'transparent' : (meta.accent ? 'var(--accent)' : 'var(--navy)'),
        background: isLoading ? 'var(--border)' : 'transparent',
        borderRadius: isLoading ? 4 : 0, lineHeight: 1.1, marginTop: 3,
        animation: isLoading ? 'pulse 1.4s ease-in-out infinite' : 'none',
        transition: 'color .2s',
      }}>
        {value ?? '000'}
      </div>
    </div>
  )
}

export default function KPIStrip({ data, rawData }) {
  const [drawer, setDrawer] = useState(null)
  const d = data || {}
  const kpis = [
    { id: 'kpi-atenciones', value: d.total_atenciones != null ? fmt(d.total_atenciones) : null },
    { id: 'kpi-periodo',    value: d.anio_inicio ? `${d.anio_inicio}–${d.anio_fin}` : null },
    { id: 'kpi-regiones',   value: d.regiones  != null ? fmtFull(d.regiones)  : null },
    { id: 'kpi-ipress',     value: d.ipress    != null ? fmt(d.ipress)         : null },
    { id: 'kpi-servicios',  value: d.servicios != null ? fmtFull(d.servicios)  : null },
    { id: 'kpi-planes',     value: d.planes    != null ? fmtFull(d.planes)     : null },
  ]
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', background: 'var(--border)', gap: 1, borderBottom: '1px solid var(--border)' }} className="kpi-strip">
        {kpis.map(k => {
          const meta = KPI_META[k.id]
          return <KPI key={k.id} meta={meta} value={k.value} onClick={k.value ? () => setDrawer({ meta, value: k.value }) : null} />
        })}
      </div>
      {drawer && <KPIDrawer {...drawer} rawData={rawData} onClose={() => setDrawer(null)} />}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @media (max-width:1100px){ .kpi-strip{ grid-template-columns:repeat(3,1fr)!important } }
        @media (max-width:540px) { .kpi-strip{ grid-template-columns:repeat(2,1fr)!important } }
      `}</style>
    </>
  )
}
