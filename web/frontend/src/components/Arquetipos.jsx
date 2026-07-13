import React, { useState, useEffect } from 'react'
import {
  Baby, School, GraduationCap, User, Briefcase, HeartPulse,
  Info, BarChart2, LayoutGrid, List, GitCommitHorizontal,
} from 'lucide-react'
import { fmt } from '../lib/format.js'
import { cn } from '@/lib/utils'

const ICONS = {
  primera_infancia:  Baby,
  ninez_escolar:     School,
  adolescente:       GraduationCap,
  adulto_joven:      User,
  adulto_productivo: Briefcase,
  adulto_mayor:      HeartPulse,
}

// Paleta SIS — refleja exactamente las CSS vars de index.css
// (--primary, --lblue, --green, --orange, --accent, --navy2)
const ARCHETYPE_COLORS = {
  primera_infancia:  '#5b6fb3',  // --primary / navy SIS
  ninez_escolar:     '#57c4f2',  // --lblue
  adolescente:       '#afcc46',  // --green
  adulto_joven:      '#f6a64a',  // --orange
  adulto_productivo: '#dc388d',  // --accent / rosa SIS
  adulto_mayor:      '#4a61a1',  // --navy2
}
const ac = (arq) => ARCHETYPE_COLORS[arq.id] || arq.color

// ── Helpers ────────────────────────────────────────────────────────────────────
function statVal(raw, suffix = '') {
  return raw !== '?' && raw !== undefined ? `${raw}${suffix}` : '—'
}

// ── Tarjeta individual (vista grilla) ─────────────────────────────────────────
function ArchCardGrid({ arq }) {
  const Icon = ICONS[arq.id] || User
  return (
    <div className="island flex flex-col">
      <div className="px-4 pt-4 pb-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon size={16} style={{ color: ac(arq) }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-[13px] text-foreground leading-tight truncate">
            {arq.nombre}
          </h3>
          <span className="text-[10px] text-muted-foreground">{arq.rango}</span>
        </div>
        <div className="text-right shrink-0">
          <div className="font-heading font-bold text-[22px] tabular-nums leading-none"
               style={{ color: ac(arq) }}>
            {arq.pct_total}%
          </div>
          <div className="text-[9px] text-muted-foreground">del total</div>
        </div>
      </div>

      <div className="px-4 pb-3 flex-1">
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          {arq.descripcion}
        </p>

        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">Femenino</div>
            <div className="text-[12px] font-bold text-foreground tabular-nums">
              {statVal(arq.pct_femenino, '%')}
            </div>
          </div>
          <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">Nivel EESS</div>
            <div className="text-[12px] font-bold text-foreground">
              {arq.nivel_predominante !== '?' ? `Nv. ${arq.nivel_predominante}` : '—'}
            </div>
          </div>
          <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">Plan SIS</div>
            <div className="text-[10px] font-bold text-foreground truncate" title={arq.plan_predominante}>
              {statVal(arq.plan_predominante)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {(arq.foco || []).map(f => (
            <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full bg-muted text-muted-foreground">
              {f}
            </span>
          ))}
        </div>

        <div className="h-0.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${Math.min(arq.pct_total * 3.5, 100)}%`, background: ac(arq) }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground">{fmt(arq.atenciones)} atenciones</span>
          <span className="text-[9px] text-muted-foreground">{arq.pct_total}% del total</span>
        </div>
      </div>
    </div>
  )
}

// ── Fila lista ─────────────────────────────────────────────────────────────────
function ArchCardList({ arq }) {
  const Icon = ICONS[arq.id] || User
  return (
    <div className="island px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon size={14} style={{ color: ac(arq) }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-heading font-semibold text-[12px] text-foreground">{arq.nombre}</span>
          <span className="text-[10px] text-muted-foreground">{arq.rango}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{arq.descripcion}</p>
      </div>
      <div className="flex items-center gap-5 shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-muted-foreground">Femenino</div>
          <div className="text-[11px] font-semibold text-foreground tabular-nums">
            {statVal(arq.pct_femenino, '%')}
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-[10px] text-muted-foreground">Nivel EESS</div>
          <div className="text-[11px] font-semibold text-foreground">
            {arq.nivel_predominante !== '?' ? `Nv. ${arq.nivel_predominante}` : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-heading font-bold text-[18px] tabular-nums leading-none" style={{ color: ac(arq) }}>
            {arq.pct_total}%
          </div>
          <div className="text-[9px] text-muted-foreground">{fmt(arq.atenciones)}</div>
        </div>
      </div>
    </div>
  )
}

// ── Timeline ──────────────────────────────────────────────────────────────────
// Columnas equidistantes (flex:1) + nodos con tamaño proporcional al % (32–44px).
// La proporción se lee en el nodo, no en el ancho de columna — columnas iguales
// evitan que los arquetipos pequeños queden aplastados.
// Ref: Tufte (1983) — encode data in mark size, not layout width.
function ArchTimeline({ arquetipos }) {
  const [selectedId, setSelectedId] = useState(arquetipos[0]?.id || '')
  const arq = arquetipos.find(a => a.id === selectedId) || arquetipos[0]

  const pcts   = arquetipos.map(a => a.pct_total)
  const minPct = Math.min(...pcts)
  const maxPct = Math.max(...pcts)
  const nodeSize = (pct) => Math.round(32 + ((pct - minPct) / (maxPct - minPct)) * 12)
  const iconSize = (pct) => Math.round(13 + ((pct - minPct) / (maxPct - minPct)) * 4)
  const maxSz = nodeSize(maxPct)  // altura fija del row → todos los centros al mismo Y

  return (
    <div className="island">
      {/* ── Selector de arquetipos ── */}
      <div
        className="flex px-3 pt-5 pb-2 overflow-x-auto"
        role="group"
        aria-label="Arquetipo seleccionado"
      >
        <div className="flex min-w-[480px] flex-1">
          {arquetipos.map((a, i) => {
            const Icon    = ICONS[a.id] || User
            const active  = selectedId === a.id
            const isFirst = i === 0
            const isLast  = i === arquetipos.length - 1
            const sz  = nodeSize(a.pct_total)
            const icz = iconSize(a.pct_total)
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                aria-pressed={active}
                aria-label={`${a.nombre} — ${a.pct_total}% del total`}
                className="flex flex-col items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                style={{ flex: 1 }}
              >
                {/* Porcentaje */}
                <div
                  className="text-[11px] font-bold font-heading tabular-nums mb-1.5 leading-none transition-opacity duration-200"
                  style={{ color: ac(a), opacity: active ? 1 : 0.45 }}
                >
                  {a.pct_total}%
                </div>

                {/* Conector left-half + nodo proporcional + right-half.
                    height fijo = maxSz → todos los nodos comparten el mismo centro Y */}
                <div className="flex items-center w-full" style={{ height: maxSz }}>
                  <div
                    className="flex-1 transition-colors duration-300"
                    style={{ height: 2, background: isFirst ? 'transparent' : 'hsl(var(--border))' }}
                  />
                  <div
                    className={cn(
                      'rounded-full flex items-center justify-center shrink-0',
                      'transition-all duration-200',
                      active ? 'scale-105' : 'opacity-55 hover:opacity-80 hover:scale-100',
                    )}
                    style={{
                      width: sz, height: sz,
                      background: active ? ac(a) : 'hsl(var(--card))',
                      border: `2px solid ${active ? ac(a) : 'hsl(var(--border))'}`,
                    }}
                  >
                    <Icon size={icz} style={{ color: active ? 'white' : ac(a) }} />
                  </div>
                  <div
                    className="flex-1 transition-colors duration-300"
                    style={{ height: 2, background: isLast ? 'transparent' : 'hsl(var(--border))' }}
                  />
                </div>

                {/* Rango etario */}
                <div
                  className="text-[10px] font-mono mt-1.5 leading-none transition-colors"
                  style={{ color: active ? ac(a) : 'hsl(var(--muted-foreground))' }}
                >
                  {a.rango}
                </div>
                {/* Nombre */}
                <div
                  className="text-[10px] font-bold text-center leading-tight mt-0.5 px-0.5 transition-colors"
                  style={{ color: active ? ac(a) : 'hsl(var(--muted-foreground))' }}
                >
                  {a.nombre}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Panel de detalle ── */}
      {arq && (
        <div className="mx-4 border-t border-border/40 mt-3 pt-3 pb-4">
          {/* Barra proporcional de distribución */}
          <div className="flex h-1.5 rounded-full overflow-hidden mb-1">
            {arquetipos.map(a => (
              <div
                key={a.id}
                className="transition-all duration-500"
                style={{ flex: a.pct_total, background: a.id === arq.id ? ac(a) : ac(a) + '28' }}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-3">
            <span>{fmt(arq.atenciones)} atenciones</span>
            <span className="font-semibold" style={{ color: ac(arq) }}>{arq.pct_total}% del total</span>
          </div>

          {/* Descripción */}
          <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
            {arq.descripcion}
          </p>

          {/* Stats: label arriba, valor abajo — grid fijo 3 columnas */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Femenino',   val: statVal(arq.pct_femenino, '%') },
              { label: 'Nivel EESS', val: arq.nivel_predominante !== '?' ? `Nv. ${arq.nivel_predominante}` : '—' },
              { label: 'Plan SIS',   val: statVal(arq.plan_predominante), full: arq.plan_predominante },
            ].map(({ label, val, full }) => (
              <div key={label} className="bg-muted/40 rounded-lg px-2.5 py-2">
                <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
                <div
                  className="text-[12px] font-bold text-foreground leading-tight truncate"
                  title={full || val}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>

          {/* Tags de foco */}
          <div className="flex flex-wrap gap-1.5">
            {(arq.foco || []).map(f => (
              <span
                key={f}
                className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: ac(arq) + '18', color: ac(arq) }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Módulo principal ────────────────────────────────────────────────────────────
export default function Arquetipos({ dark }) {
  const [data, setData]    = useState(null)
  const [loading, setLoad] = useState(true)
  const [error, setError]  = useState(null)
  const [view, setView]    = useState('timeline')

  useEffect(() => {
    fetch('/api/arquetipos')
      .then(r => r.json())
      .then(d => { setData(d); setLoad(false) })
      .catch(() => { setError('Error al cargar arquetipos'); setLoad(false) })
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center flex-col gap-3 text-[13px] text-muted-foreground">
      <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin-slow" />
      Analizando perfiles de asegurado…
    </div>
  )

  if (error || data?.error) return (
    <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
      {error || data?.error}
    </div>
  )

  const { arquetipos, total_global } = data

  return (
    <div className="flex-1 flex flex-col overflow-y-auto gap-3 p-3 min-h-0">

      {/* ── Header: título + descripción (left) / toggles de vista (right) ── */}
      <div className="island px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          {/* Info block */}
          <div className="flex items-start gap-2 min-w-0">
            <Info size={13} className="shrink-0 text-primary mt-[3px]" />
            <div className="min-w-0">
              <span className="text-[12px] font-semibold text-foreground">Arquetipos SIS</span>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Seis perfiles derivados de los grupos etarios del DS-01.{' '}
                Total analizado:{' '}
                <strong className="text-foreground">{fmt(total_global)}</strong>{' '}
                atenciones (2017–2025).
              </p>
            </div>
          </div>

          {/* Toggles de vista */}
          <div className="flex items-center gap-1 shrink-0 mt-0.5" role="group" aria-label="Tipo de visualización">
            {[
              { id: 'timeline', icon: GitCommitHorizontal, label: 'Línea de vida' },
              { id: 'grid',     icon: LayoutGrid,          label: 'Grilla de tarjetas' },
              { id: 'list',     icon: List,                label: 'Lista compacta' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                aria-label={label}
                aria-pressed={view === id}
                title={label}
                className={cn(
                  'p-1.5 rounded-md transition-colors',
                  view === id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Contenido ── */}
      {view === 'timeline' && <ArchTimeline arquetipos={arquetipos} />}

      {view === 'grid' && (
        <div className="grid grid-cols-3 gap-3">
          {arquetipos.map(arq => <ArchCardGrid key={arq.id} arq={arq} />)}
        </div>
      )}

      {view === 'list' && (
        <div className="flex flex-col gap-2">
          {arquetipos.map(arq => <ArchCardList key={arq.id} arq={arq} />)}
        </div>
      )}

      {/* ── Tabla comparativa ── */}
      <div className="island overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/60">
          <BarChart2 size={12} className="text-primary" />
          <span className="font-heading text-[10px] font-bold uppercase tracking-[.07em] text-primary">
            Comparativa entre arquetipos
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-3 py-2.5 font-bold text-muted-foreground">Arquetipo</th>
                <th className="text-left px-3 py-2.5 font-bold text-muted-foreground">Edad</th>
                <th className="text-right px-3 py-2.5 font-bold text-muted-foreground">Atenciones</th>
                <th className="text-right px-3 py-2.5 font-bold text-muted-foreground">% Total</th>
                <th className="text-right px-3 py-2.5 font-bold text-muted-foreground">% Fem.</th>
                <th className="text-center px-3 py-2.5 font-bold text-muted-foreground">Nivel EESS</th>
                <th className="text-left px-3 py-2.5 font-bold text-muted-foreground">Plan predominante</th>
              </tr>
            </thead>
            <tbody>
              {arquetipos.map((arq, i) => (
                <tr key={arq.id} className={cn('border-b border-border/40', i % 2 === 1 && 'bg-muted/20')}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ac(arq) }} />
                      <span className="font-semibold text-foreground">{arq.nombre}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{arq.rango}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmt(arq.atenciones)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold" style={{ color: ac(arq) }}>
                    {arq.pct_total}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {statVal(arq.pct_femenino, '%')}
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">
                    {arq.nivel_predominante !== '?' ? `Nivel ${arq.nivel_predominante}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {statVal(arq.plan_predominante)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
