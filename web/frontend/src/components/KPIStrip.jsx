import React from 'react'
import { fmt, fmtFull } from '../lib/format.js'

function KPI({ label, value, accent }) {
  const isLoading = value == null
  return (
    <div style={{
      background: 'var(--surface)',
      padding: '12px 14px', textAlign: 'center',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700,
        fontFamily: "'Montserrat', sans-serif",
        color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.07em',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700,
        fontFamily: "'Montserrat', sans-serif",
        fontVariantNumeric: 'tabular-nums',
        color: isLoading ? 'transparent' : (accent ? 'var(--accent)' : 'var(--navy)'),
        background: isLoading ? 'var(--border)' : 'transparent',
        borderRadius: isLoading ? 4 : 0,
        lineHeight: 1.1, marginTop: 3,
        animation: isLoading ? 'pulse 1.4s ease-in-out infinite' : 'none',
        transition: 'color .2s',
        userSelect: 'none',
      }}>
        {value ?? '000'}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  )
}

export default function KPIStrip({ data }) {
  const d = data || {}
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      background: 'var(--border)',
      gap: 1,
      borderBottom: '1px solid var(--border)',
    }}>
      <KPI label="Total Atenciones" value={d.total_atenciones != null ? fmt(d.total_atenciones) : null} accent />
      <KPI label="Periodo" value={d.anio_inicio ? `${d.anio_inicio}–${d.anio_fin}` : null} />
      <KPI label="Regiones" value={d.regiones != null ? fmtFull(d.regiones) : null} />
      <KPI label="IPRESS Activas" value={d.ipress != null ? fmt(d.ipress) : null} />
      <KPI label="Tipos de Servicio" value={d.servicios != null ? fmtFull(d.servicios) : null} />
      <KPI label="Planes de Seguro" value={d.planes != null ? fmtFull(d.planes) : null} />

      <style>{`
        @media (max-width: 1100px) {
          .kpi-strip { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 540px) {
          .kpi-strip { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
