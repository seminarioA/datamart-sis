import React, { useState, useEffect } from 'react'
import { Heart, BookOpen, User, Users, Briefcase, Activity, Info, BarChart2 } from 'lucide-react'
import { fmt } from '../lib/format.js'
import { cn } from '@/lib/utils'

const ICONS = {
  primera_infancia:  Heart,
  ninez_escolar:     BookOpen,
  adolescente:       User,
  adulto_joven:      Users,
  adulto_productivo: Briefcase,
  adulto_mayor:      Activity,
}

function ArchCard({ arq }) {
  const Icon = ICONS[arq.id] || Users

  return (
    <div
      className="island flex flex-col overflow-hidden"
      style={{ borderLeft: `4px solid ${arq.color}` }}
    >
      {/* Cabecera */}
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="flex items-start gap-3 mb-2.5">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: arq.color + '22' }}
          >
            <Icon size={18} style={{ color: arq.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-[13px] text-foreground leading-tight">
              {arq.nombre}
            </h3>
            <span className="text-[10px] font-semibold text-muted-foreground">{arq.rango}</span>
          </div>
          <div className="text-right shrink-0">
            <div
              className="font-heading font-bold text-[20px] tabular-nums leading-none"
              style={{ color: arq.color }}
            >
              {arq.pct_total}%
            </div>
            <div className="text-[9px] text-muted-foreground">del total</div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
          {arq.descripcion}
        </p>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
            <div className="text-[12px] font-bold text-foreground tabular-nums">
              {arq.pct_femenino}%
            </div>
            <div className="text-[9px] text-muted-foreground">Femenino</div>
          </div>
          <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
            <div className="text-[12px] font-bold text-foreground">
              Nivel {arq.nivel_predominante}
            </div>
            <div className="text-[9px] text-muted-foreground">EESS típico</div>
          </div>
          <div className="bg-muted/50 rounded-md px-2 py-2 text-center">
            <div
              className="text-[10px] font-bold text-foreground truncate"
              title={arq.plan_predominante}
            >
              {arq.plan_predominante}
            </div>
            <div className="text-[9px] text-muted-foreground">Plan SIS</div>
          </div>
        </div>

        {/* Etiquetas de foco */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(arq.foco || []).map(f => (
            <span
              key={f}
              className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: arq.color + '18', color: arq.color }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* Barra de participación */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(arq.pct_total * 3.5, 100)}%`, background: arq.color }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">{fmt(arq.atenciones)} atenciones</span>
          <span className="text-[9px] text-muted-foreground">{arq.pct_total}% SIS total</span>
        </div>
      </div>
    </div>
  )
}

export default function Arquetipos({ dark }) {
  const [data, setData]    = useState(null)
  const [loading, setLoad] = useState(true)
  const [error, setError]  = useState(null)

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

      {/* Descripción */}
      <div className="island flex items-start gap-2.5 px-4 py-3 text-[11px] text-muted-foreground">
        <Info size={13} className="shrink-0 mt-0.5 text-primary" />
        <span>
          <strong className="text-foreground">Arquetipos SIS</strong> — Seis perfiles de asegurado
          derivados de los grupos etarios del Diccionario de Datos SIS (DS-01).
          Cada arquetipo concentra una demanda de salud diferenciada, con patrones de atención,
          planes de seguro y niveles de EESS propios.
          Total analizado: <strong className="text-foreground">{fmt(total_global)}</strong> atenciones (2017–2025).
        </span>
      </div>

      {/* Cards 3×2 */}
      <div className="grid grid-cols-3 gap-3">
        {arquetipos.map(arq => (
          <ArchCard key={arq.id} arq={arq} dark={dark} />
        ))}
      </div>

      {/* Tabla comparativa */}
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
                <tr
                  key={arq.id}
                  className={cn('border-b border-border/40', i % 2 === 1 && 'bg-muted/20')}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: arq.color }}
                      />
                      <span className="font-semibold text-foreground">{arq.nombre}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{arq.rango}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {fmt(arq.atenciones)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: arq.color }}>
                    {arq.pct_total}%
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">
                    {arq.pct_femenino}%
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="font-bold px-2 py-0.5 rounded text-[10px]"
                      style={{ background: arq.color + '22', color: arq.color }}
                    >
                      Nivel {arq.nivel_predominante}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{arq.plan_predominante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
