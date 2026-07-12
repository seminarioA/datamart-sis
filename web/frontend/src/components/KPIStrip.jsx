import React, { useState } from 'react'
import { TrendingUp, HelpCircle, Map, Stethoscope, Shield, BarChart2 } from 'lucide-react'
import { fmt, fmtFull, trunc } from '../lib/format.js'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

const KPI_META = {
  'kpi-atenciones': {
    label: 'Total Atenciones', accent: true,
    dataKey: 'anio', labelField: 'anio', valueField: 'atenciones',
    sectionTitle: 'Evolución Anual', sectionIcon: TrendingUp,
    showDelta: true,
    tip: 'Suma de todas las prestaciones de salud registradas. Incluye consultas externas, procedimientos, hospitalizaciones y emergencias de asegurados SIS en todos los años disponibles.',
  },
  'kpi-periodo': {
    label: 'Periodo',
    dataKey: 'anio', labelField: 'anio', valueField: 'atenciones',
    sectionTitle: 'Atenciones por Año', sectionIcon: TrendingUp,
    showDelta: true,
    tip: 'Rango de años disponibles en el sistema. El SIS publica los datos en la Plataforma Nacional de Datos Abiertos del Perú (datosabiertos.gob.pe) en entregas anuales y semestrales.',
  },
  'kpi-regiones': {
    label: 'Regiones',
    dataKey: 'region', labelField: 'region', valueField: 'atenciones',
    sectionTitle: 'Top Regiones', sectionIcon: Map,
    tip: 'Cantidad de regiones (departamentos) con al menos una atención registrada. El Perú tiene 25 regiones más la Provincia Constitucional del Callao (26 en total), identificadas por código UBIGEO.',
  },
  'kpi-ipress': {
    label: 'IPRESS Activas',
    dataKey: 'nivel', labelField: null, valueField: 'atenciones',
    sectionTitle: 'Por Nivel de EESS', sectionIcon: BarChart2,
    tip: 'IPRESS: Institución Prestadora de Servicios de Salud. Son los establecimientos (centros de salud, puestos de salud, hospitales, clínicas) que registraron atenciones a asegurados SIS. El nivel I corresponde a atención primaria; III a hospitales de alta complejidad.',
  },
  'kpi-servicios': {
    label: 'Tipos de Prestación',
    dataKey: 'servicios', labelField: null, valueField: 'atenciones',
    sectionTitle: 'Top Prestaciones', sectionIcon: Stethoscope,
    tip: 'Cantidad de tipos de prestación distintos registrados. Ejemplos: Medicina General, Odontología, Laboratorio Clínico, Farmacia, CRED (Control del Niño Sano), Planificación Familiar. Cada atención pertenece a un único tipo de prestación.',
  },
  'kpi-planes': {
    label: 'Planes de Seguro',
    dataKey: 'plan', labelField: null, valueField: 'atenciones',
    sectionTitle: 'Distribución por Plan', sectionIcon: Shield,
    tip: 'Modalidades de afiliación al SIS. SIS Gratuito: subsidiado para población vulnerable. SIS Para Todos / Independiente: contributivo. SIS Emprendedor y Microempresa: para trabajadores independientes y microempresas formales.',
  },
}

function resolveLabel(meta, row) {
  if (meta.labelField) return row[meta.labelField]
  // nivel
  if (row.nivel || row.nivel_eess) return `Nivel ${row.nivel ?? row.nivel_eess}`
  // servicio
  if (row.servicio || row.cod_servicio) return trunc(row.servicio ?? row.cod_servicio, 28)
  // plan
  if (row.desc_plan_seguro || row.cod_plan_seguro) return trunc(row.desc_plan_seguro ?? row.cod_plan_seguro, 28)
  return '—'
}

function MiniBarList({ rows, meta, showDelta }) {
  const max = Math.max(...rows.map(r => Number(r[meta.valueField])), 1)
  return (
    <div className="px-4 pb-4 flex-1 overflow-y-auto">
      <div className="flex items-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-[.07em] text-muted-foreground mb-3">
        <meta.sectionIcon size={12} />
        {meta.sectionTitle}
      </div>
      {rows.map((row, i) => {
        const val  = Number(row[meta.valueField])
        const pct  = Math.round((val / max) * 100)
        const prev = showDelta && i > 0 ? Number(rows[i - 1][meta.valueField]) : null
        const delta = prev ? ((val - prev) / prev * 100).toFixed(1) : null
        const label = resolveLabel(meta, row)
        return (
          <div key={i} className="mb-2.5">
            <div className="flex justify-between mb-1 gap-2">
              <span className="text-[11px] font-semibold text-foreground truncate">{label}</span>
              <span className="text-[11px] text-muted-foreground flex gap-2 items-center shrink-0">
                {delta && (
                  <span style={{ color: Number(delta) >= 0 ? 'var(--green)' : 'var(--accent-c)', fontWeight: 600 }}>
                    {Number(delta) >= 0 ? '+' : ''}{delta}%
                  </span>
                )}
                {fmt(val)}
              </span>
            </div>
            <div className="h-[5px] bg-muted rounded-full">
              <div className="h-full bg-primary rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KPIDrawer({ meta, value, rawData, open, onClose }) {
  const rows = (rawData?.[meta.dataKey] ?? []).slice(0, 12)

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{meta.label}</SheetTitle>
          <div
            className="text-[30px] font-heading font-bold leading-tight mt-1"
            style={{ color: meta.accent ? 'var(--accent-c)' : 'hsl(var(--primary))' }}
          >
            {value}
          </div>
        </SheetHeader>

        <div className="p-4 pb-2">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[.07em] text-muted-foreground mb-2">Definición</p>
          <p className="text-[12px] text-foreground leading-relaxed">{meta.tip}</p>
        </div>

        {rows.length > 0 && (
          <MiniBarList rows={rows} meta={meta} showDelta={meta.showDelta} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function KPICell({ meta, value, onClick }) {
  const isLoading = value == null
  return (
    <TooltipProvider delayDuration={300}>
      <div
        onClick={onClick}
        className="kpi-cell bg-card px-3.5 py-3 text-center select-none"
        style={{ cursor: onClick && !isLoading ? 'pointer' : 'default' }}
      >
        <div className="flex items-center justify-center gap-1 font-heading text-[9.5px] font-bold uppercase tracking-[.04em] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
          {meta.label}
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="inline-flex text-muted-foreground/70 hover:text-muted-foreground p-0 bg-transparent border-0 cursor-help">
                <HelpCircle size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px]">{meta.tip}</TooltipContent>
          </Tooltip>
        </div>
        <div
          className="font-heading font-bold text-2xl tabular-nums leading-tight mt-1 transition-colors duration-200 whitespace-nowrap"
          style={{
            color: isLoading ? 'transparent' : (meta.accent ? 'var(--accent-c)' : 'hsl(var(--primary))'),
            background: isLoading ? 'hsl(var(--muted))' : 'transparent',
            borderRadius: isLoading ? 4 : 0,
            animation: isLoading ? 'pulse 1.4s ease-in-out infinite' : 'none',
          }}
        >
          {value ?? '000'}
        </div>
      </div>
    </TooltipProvider>
  )
}

export default function KPIStrip({ data, rawData, onDrawerOpen }) {
  const [drawer, setDrawer] = useState(null)
  const d = data || {}

  const openDrawer = (meta, value) => {
    setDrawer({ meta, value })
    onDrawerOpen?.()
  }

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
      <div className="kpi-strip grid grid-cols-6 gap-2 px-4 py-3 border-b border-border/40">
        {kpis.map(k => {
          const meta = KPI_META[k.id]
          return (
            <KPICell
              key={k.id}
              meta={meta}
              value={k.value}
              onClick={k.value ? () => openDrawer(meta, k.value) : null}
            />
          )
        })}
      </div>
      {drawer && (
        <KPIDrawer
          {...drawer}
          rawData={rawData}
          open={!!drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  )
}
