import React, { useState } from 'react'
import { ChevronRight, ChevronLeft, LayoutDashboard, Map, TrendingUp, BookOpen, BarChart2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
    title: 'Módulo Proyecciones',
    desc: 'Forecast de atenciones 2026–2028 basado en la tendencia histórica, índice de estacionalidad mensual y proyección por región.',
    hint: 'Las proyecciones asumen continuidad de la tendencia — no incorporan cambios de política sanitaria.',
  },
  {
    icon: BookOpen,
    title: 'Glosario de términos',
    desc: 'En el módulo Glosario encontrarás definiciones de los términos del sector: IPRESS, Nivel EESS, Plan de Seguro SIS, grupo etario y más.',
    hint: '¡Listo! Cierra esta guía y empieza a explorar.',
  },
]

export default function Onboarding({ onClose }) {
  const [step, setStep] = useState(0)
  const S = STEPS[step]
  const Icon = S.icon

  const next = () => step < STEPS.length - 1 ? setStep(s => s + 1) : onClose()
  const prev = () => setStep(s => s - 1)

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent
        showClose={false}
        className="bg-card border border-border rounded-xl max-w-[480px] w-[90%] shadow-2xl overflow-hidden p-0 z-[9999]"
      >
      <DialogTitle className="sr-only">{S.title}</DialogTitle>
      <div>
        {/* Header */}
        <div className="bg-primary px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/sis_logo.png" alt="SIS" className="h-7" />
            <span className="text-primary-foreground/80 text-[11px] font-heading font-semibold tracking-[.05em] uppercase">
              Guía rápida
            </span>
          </div>
          <Button
            size="xs"
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white/70 border-0"
          >
            Saltar
          </Button>
        </div>

        {/* Content */}
        <div className="px-7 pt-7 pb-5">
          <div className="flex items-center justify-center w-14 h-14 bg-muted rounded-xl border-2 border-primary mx-auto mb-4">
            <Icon size={24} className="text-primary" />
          </div>
          <h2 className="font-heading font-bold text-lg text-foreground text-center mb-2.5">{S.title}</h2>
          <p className="text-[14px] text-foreground/85 leading-relaxed text-center mb-4">{S.desc}</p>
          <div className="bg-muted border border-border rounded-md px-3.5 py-2.5 text-[12px] text-muted-foreground text-center">
            {S.hint}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 pb-1">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="h-2 rounded-full transition-all duration-200"
              style={{
                width: i === step ? 20 : 8,
                background: i === step ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              }}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pt-3 pb-5 flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft size={14} /> Anterior
          </Button>
          <span className="text-[11px] text-muted-foreground">{step + 1} / {STEPS.length}</span>
          <Button size="sm" onClick={next} className="gap-1">
            {step === STEPS.length - 1 ? 'Comenzar' : 'Siguiente'} <ChevronRight size={14} />
          </Button>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  )
}
