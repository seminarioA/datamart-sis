import React from 'react'
import {
  LayoutDashboard, Map, Users, Building2,
  Stethoscope, CalendarDays, TrendingUp,
  BookOpen, Info, ExternalLink, ChevronLeft, ChevronRight, Target, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

export const MODULES = [
  { id:'overview',     icon:LayoutDashboard, label:'Resumen',              desc:'Panel de atenciones SIS' },
  { id:'map',          icon:Map,             label:'Cobertura',            desc:'Distribución territorial' },
  { id:'demographics', icon:Users,           label:'Perfil del Asegurado', desc:'Sexo y grupo etario' },
  { id:'geography',    icon:Building2,       label:'Red Prestacional',     desc:'Regiones y nivel EESS' },
  { id:'services',     icon:Stethoscope,     label:'Prestaciones',         desc:'Top prestaciones y planes SIS' },
  { id:'trends',       icon:CalendarDays,    label:'Evolución',            desc:'Tendencia de atenciones' },
  { id:'predicciones', icon:TrendingUp,      label:'Proyecciones',         desc:'Pronóstico OLS 2026-2028' },
  { id:'acciones',     icon:Target,          label:'Intervenciones',       desc:'Estrategias recomendadas' },
  { id:'cuadre',       icon:ShieldCheck,     label:'Conciliación',         desc:'Trazabilidad ETL de la carga' },
  { id:'glosario',     icon:BookOpen,        label:'Glosario SIS',         desc:'Términos y definiciones' },
]

function NavItem({ m, active, onModule, collapsed }) {
  const Icon = m.icon
  const isActive = active === m.id

  const btn = (
    <button
      onClick={() => onModule(m.id)}
      className={cn('nav-pill', isActive && 'active', collapsed && 'collapsed')}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      {!collapsed && <span>{m.label}</span>}
    </button>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right">{m.label}</TooltipContent>
      </Tooltip>
    )
  }
  return btn
}

export default function Sidebar({ active, onModule, collapsed, onToggle, airflowUrl }) {
  const W = collapsed ? 64 : 224
  return (
    <TooltipProvider delayDuration={200}>
      <aside
        style={{ width: W, minWidth: W }}
        className="shrink-0 z-[100] overflow-hidden transition-[width] duration-200 flex flex-col glass rounded-2xl h-full"
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-2.5 shrink-0 py-4 min-h-[60px]',
          collapsed ? 'justify-center px-0' : 'px-4',
        )}>
          <img src="/sis_logo.png" alt="SIS" className="h-7 shrink-0" />
          {!collapsed && (
            <span className="font-heading font-bold text-[13px] text-primary whitespace-nowrap tracking-tight">
              DataMart SIS
            </span>
          )}
        </div>

        <div className="mx-3 h-px bg-border/60 shrink-0" />

        {/* Nav */}
        <nav className="flex-1 p-2 overflow-y-auto space-y-0.5">
          {MODULES.map(m => (
            <NavItem key={m.id} m={m} active={active} onModule={onModule} collapsed={collapsed} />
          ))}
        </nav>

        <div className="mx-3 h-px bg-border/60 shrink-0" />

        {/* Footer */}
        <div className="p-2 space-y-0.5">
          {airflowUrl && (
            <a
              href={airflowUrl} target="_blank" rel="noopener noreferrer"
              className={cn('nav-pill no-underline', collapsed && 'collapsed')}
            >
              <ExternalLink size={13} style={{ flexShrink: 0 }} />
              {!collapsed && <span>Apache Airflow</span>}
            </a>
          )}

          <NavItem
            m={{ id:'acerca', icon:Info, label:'Acerca de', desc:'Autores y stack' }}
            active={active} onModule={onModule} collapsed={collapsed}
          />

          <button
            onClick={onToggle}
            className={cn('nav-pill w-full', collapsed ? 'collapsed justify-center' : 'justify-end gap-1.5')}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed
              ? <ChevronRight size={14} />
              : <><span className="text-[11px]">Colapsar</span><ChevronLeft size={14} /></>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
