import React, { useState } from 'react'
import { TrendingUp, HelpCircle, X } from 'lucide-react'
import { fmt, fmtFull } from '../lib/format.js'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'

const KPI_META = {
  'kpi-atenciones': {
    label: 'Total Atenciones', accent: true, showEvolution: true,
    tip: 'Suma de todas las prestaciones de salud registradas en el datamart. Incluye consultas externas, procedimientos, hospitalizaciones y emergencias de asegurados SIS en todos los años cargados.',
  },
  'kpi-periodo': {
    label: 'Periodo', showEvolution: true,
    tip: 'Rango de años efectivamente cargados en el datamart. El SIS publica los datos en la Plataforma Nacional de Datos Abiertos del Perú (datosabiertos.gob.pe) como archivos ZIP anuales y semestrales.',
  },
  'kpi-regiones': {
    label: 'Regiones',
    tip: 'Cantidad de regiones (departamentos) con al menos una atención registrada. El Perú tiene 25 regiones más la Provincia Constitucional del Callao (26 en total). El datamart usa el código UBIGEO de 6 dígitos para identificarlas.',
  },
  'kpi-ipress': {
    label: 'IPRESS Activas',
    tip: 'IPRESS: Institución Prestadora de Servicios de Salud. Son los establecimientos (centros de salud, puestos de salud, hospitales, clínicas) que registraron atenciones a asegurados SIS. El nivel I corresponde a atención primaria; III a hospitales de alta complejidad.',
  },
  'kpi-servicios': {
    label: 'Tipos de Servicio',
    tip: 'Cantidad de tipos de servicio distintos registrados. Ejemplos: Medicina General, Odontología, Laboratorio Clínico, Farmacia, CRED (Control del Niño Sano), Planificación Familiar. Cada atención pertenece a un único tipo de servicio.',
  },
  'kpi-planes': {
    label: 'Planes de Seguro',
    tip: 'Modalidades de afiliación al SIS. SIS Gratuito: subsidiado para población vulnerable. SIS Para Todos / Independiente: contributivo. SIS Emprendedor y Microempresa: para trabajadores independientes y microempresas formales.',
  },
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
        <div className="flex items-center justify-center gap-1 font-heading text-[10px] font-bold uppercase tracking-[.07em] text-muted-foreground">
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
          className="font-heading font-bold text-2xl tabular-nums leading-tight mt-1 transition-colors duration-200"
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

function KPIDrawer({ meta, value, rawData, open, onClose }) {
  const anio = rawData?.anio ?? []
  const max = Math.max(...anio.map(x => Number(x.atenciones)), 1)

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right">
        <SheetHeader className="border-l-primary">
          <SheetTitle>{meta.label}</SheetTitle>
          <div
            className="text-[30px] font-heading font-bold leading-tight mt-1"
            style={{ color: meta.accent ? 'var(--accent-c)' : 'hsl(var(--primary))' }}
          >
            {value}
          </div>
        </SheetHeader>

        <div className="p-4">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[.07em] text-muted-foreground mb-2">Definición</p>
          <p className="text-[12px] text-foreground leading-relaxed">{meta.tip}</p>
        </div>

        {anio.length > 0 && meta.showEvolution && (
          <div className="px-4 pb-4 flex-1 overflow-y-auto">
            <div className="flex items-center gap-1.5 text-[10px] font-heading font-bold uppercase tracking-[.07em] text-muted-foreground mb-3">
              <TrendingUp size={12} /> Evolución Anual
            </div>
            {anio.map((d, i) => {
              const pct = Math.round((Number(d.atenciones) / max) * 100)
              const prev = i > 0 ? Number(anio[i-1].atenciones) : null
              const delta = prev ? ((Number(d.atenciones) - prev) / prev * 100).toFixed(1) : null
              return (
                <div key={d.anio} className="mb-2.5">
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] font-semibold text-foreground">{d.anio}</span>
                    <span className="text-[11px] text-muted-foreground flex gap-2 items-center">
                      {delta && (
                        <span style={{ color: Number(delta) >= 0 ? 'var(--green)' : 'var(--accent-c)', fontWeight:600 }}>
                          {Number(delta) >= 0 ? '+' : ''}{delta}%
                        </span>
                      )}
                      {fmt(Number(d.atenciones))}
                    </span>
                  </div>
                  <div className="h-[5px] bg-muted rounded-full">
                    <div
                      className="h-full bg-primary rounded-full transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SheetContent>
    </Sheet>
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
      <div className="kpi-strip grid grid-cols-6 bg-border gap-px border-b border-border">
        {kpis.map(k => {
          const meta = KPI_META[k.id]
          return (
            <KPICell
              key={k.id}
              meta={meta}
              value={k.value}
              onClick={k.value ? () => setDrawer({ meta, value: k.value }) : null}
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
