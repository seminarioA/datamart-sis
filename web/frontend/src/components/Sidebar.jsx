import React from 'react'
import {
  LayoutDashboard, Map, Users, Building2,
  Stethoscope, CalendarDays, TrendingUp,
  BookOpen, Info, ExternalLink, ChevronLeft, ChevronRight, Target,
} from 'lucide-react'

// Módulos principales (en nav)
export const MODULES = [
  { id:'overview',     icon:LayoutDashboard, label:'Resumen',           desc:'Vista general del dashboard' },
  { id:'map',          icon:Map,             label:'Mapa',              desc:'Distribución geográfica' },
  { id:'demographics', icon:Users,           label:'Demografía',        desc:'Por sexo y grupo de edad' },
  { id:'geography',    icon:Building2,       label:'Geografía',         desc:'Por región y nivel EESS' },
  { id:'services',     icon:Stethoscope,     label:'Servicios',         desc:'Top servicios y planes' },
  { id:'trends',       icon:CalendarDays,    label:'Tendencia',         desc:'Evolución anual' },
  { id:'predicciones', icon:TrendingUp,      label:'Predicciones',      desc:'Forecasting OLS 2026-2028' },
  { id:'acciones',     icon:Target,          label:'Acciones',          desc:'Recomendaciones para partes interesadas' },
  { id:'glosario',     icon:BookOpen,        label:'Glosario',          desc:'Términos y definiciones' },
]

function NavItem({ m, active, onModule, collapsed }) {
  const Icon = m.icon
  const isActive = active === m.id
  return (
    <button
      onClick={() => onModule(m.id)}
      title={m.label}
      style={{
        width:'100%', display:'flex', alignItems:'center', gap:10,
        padding: collapsed ? '10px 0' : '9px 14px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        border:'none', cursor:'pointer',
        background: isActive ? 'var(--navy)' : 'transparent',
        color: isActive ? '#fff' : 'var(--muted)',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
        fontSize:12, fontFamily:"'Signika',sans-serif",
        fontWeight: isActive ? 600 : 400,
        transition:'background .15s, color .15s',
        textAlign:'left', whiteSpace:'nowrap',
      }}
      onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background='var(--bg)'; e.currentTarget.style.color='var(--text)' } }}
      onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--muted)' } }}
    >
      <Icon size={15} style={{ flexShrink:0 }} />
      {!collapsed && <span>{m.label}</span>}
    </button>
  )
}

export default function Sidebar({ active, onModule, collapsed, onToggle, airflowUrl }) {
  const W = collapsed ? 60 : 220
  return (
    <aside style={{
      width:W, minWidth:W, flexShrink:0,
      background:'var(--surface)', borderRight:'1px solid var(--border)',
      display:'flex', flexDirection:'column',
      height:'100vh', position:'sticky', top:0,
      transition:'width .2s', zIndex:100, overflow:'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '14px 0' : '14px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'flex-start', gap:8, minHeight:56, flexShrink:0 }}>
        <img src="/sis_logo.png" alt="SIS" style={{ height:26, flexShrink:0 }} />
        {!collapsed && <span style={{ fontFamily:"'Montserrat',sans-serif", fontWeight:700, fontSize:12, color:'var(--navy)', whiteSpace:'nowrap' }}>DataMart SIS</span>}
      </div>

      {/* Nav principal */}
      <nav style={{ flex:1, padding:'6px 0', overflowY:'auto' }}>
        {MODULES.map(m => <NavItem key={m.id} m={m} active={active} onModule={onModule} collapsed={collapsed} />)}
      </nav>

      {/* Footer — Airflow + Acerca De + Colapsar */}
      <div style={{ borderTop:'1px solid var(--border)', flexShrink:0 }}>
        {airflowUrl && (
          <a href={airflowUrl} target="_blank" rel="noopener noreferrer" title="Apache Airflow"
            style={{ display:'flex', alignItems:'center', gap:10, padding: collapsed ? '9px 0' : '9px 14px', justifyContent: collapsed ? 'center' : 'flex-start', color:'var(--muted)', fontSize:11, fontFamily:"'Signika',sans-serif", textDecoration:'none', whiteSpace:'nowrap' }}>
            <ExternalLink size={13} style={{ flexShrink:0 }} />
            {!collapsed && <span>Apache Airflow</span>}
          </a>
        )}

        {/* Acerca De — siempre al fondo, encima de Colapsar */}
        <NavItem
          m={{ id:'acerca', icon:Info, label:'Acerca de', desc:'Autores y stack tecnológico' }}
          active={active} onModule={onModule} collapsed={collapsed}
        />

        <button onClick={onToggle}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent: collapsed ? 'center' : 'flex-end', padding:'9px 14px', border:'none', cursor:'pointer', background:'transparent', color:'var(--muted)', fontSize:11 }}
          title={collapsed ? 'Expandir' : 'Colapsar'}>
          {collapsed ? <ChevronRight size={14}/> : <><span style={{marginRight:6}}>Colapsar</span><ChevronLeft size={14}/></>}
        </button>
      </div>
    </aside>
  )
}
