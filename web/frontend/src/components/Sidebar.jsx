import React from 'react'
import {
  LayoutDashboard, Map, Users, Building2,
  Stethoscope, CalendarDays, TrendingUp,
  BookOpen, Info, ExternalLink, ChevronLeft, ChevronRight, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

export const MODULES = [
  { id:'overview',     icon:LayoutDashboard, label:'Resumen',      desc:'Vista general del dashboard' },
  { id:'map',          icon:Map,             label:'Mapa',         desc:'Distribución geográfica' },
  { id:'demographics', icon:Users,           label:'Demografía',   desc:'Por sexo y grupo de edad' },
  { id:'geography',    icon:Building2,       label:'Geografía',    desc:'Por región y nivel EESS' },
  { id:'services',     icon:Stethoscope,     label:'Servicios',    desc:'Top servicios y planes' },
  { id:'trends',       icon:CalendarDays,    label:'Tendencia',    desc:'Evolución anual' },
  { id:'predicciones', icon:TrendingUp,      label:'Predicciones', desc:'Forecasting OLS 2026-2028' },
  { id:'acciones',     icon:Target,          label:'Acciones',     desc:'Recomendaciones para partes interesadas' },
  { id:'glosario',     icon:BookOpen,        label:'Glosario',     desc:'Términos y definiciones' },
]

function NavItem({ m, active, onModule, collapsed }) {
  const Icon = m.icon
  const isActive = active === m.id

  const btn = (
    <button
      onClick={() => onModule(m.id)}
      className={cn(
        'w-full flex items-center gap-2.5 text-[12px] font-sans transition-colors duration-150 border-l-[3px]',
        collapsed ? 'px-0 py-2.5 justify-center' : 'px-3.5 py-[9px] justify-start',
        isActive
          ? 'bg-primary text-primary-foreground border-l-[var(--accent-c)] font-semibold'
          : 'bg-transparent text-muted-foreground border-l-transparent hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon size={15} className="shrink-0" />
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
  const W = collapsed ? 60 : 220
  return (
    <TooltipProvider delayDuration={300}>
      <aside
        style={{ width: W, minWidth: W }}
        className="shrink-0 bg-card border-r border-border flex flex-col h-screen sticky top-0 transition-[width] duration-200 z-[100] overflow-hidden"
      >
        {/* Logo */}
        <div className={cn(
          'border-b border-border flex items-center gap-2 shrink-0 min-h-[56px]',
          collapsed ? 'px-0 py-3.5 justify-center' : 'px-3.5 py-3.5 justify-start',
        )}>
          <img src="/sis_logo.png" alt="SIS" className="h-[26px] shrink-0" />
          {!collapsed && (
            <span className="font-heading font-bold text-[12px] text-primary whitespace-nowrap">
              DataMart SIS
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-1.5 overflow-y-auto">
          {MODULES.map(m => (
            <NavItem key={m.id} m={m} active={active} onModule={onModule} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-border shrink-0">
          {airflowUrl && (
            <a
              href={airflowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2.5 text-muted-foreground text-[11px] hover:text-foreground transition-colors no-underline',
                collapsed ? 'px-0 py-2.5 justify-center' : 'px-3.5 py-2.5 justify-start',
              )}
            >
              <ExternalLink size={13} className="shrink-0" />
              {!collapsed && <span>Apache Airflow</span>}
            </a>
          )}

          <NavItem
            m={{ id:'acerca', icon:Info, label:'Acerca de', desc:'Autores y stack tecnológico' }}
            active={active} onModule={onModule} collapsed={collapsed}
          />

          <button
            onClick={onToggle}
            className={cn(
              'w-full flex items-center text-muted-foreground text-[11px] hover:text-foreground transition-colors py-2.5',
              collapsed ? 'justify-center px-0' : 'justify-end px-3.5 gap-1.5',
            )}
            title={collapsed ? 'Expandir' : 'Colapsar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <><span>Colapsar</span><ChevronLeft size={14} /></>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
