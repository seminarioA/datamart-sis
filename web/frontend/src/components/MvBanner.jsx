import React from 'react'

export default function MvBanner({ ready, total }) {
  if (ready >= total) return null
  const pct = Math.round((ready / total) * 100)
  return (
    <div className="shrink-0 border-b border-primary/15" style={{ background: 'hsl(var(--primary) / .08)' }}>
      <div className="flex items-center gap-2.5 px-5 py-2 text-[11px] text-primary">
        <span className="inline-block w-3 h-3 shrink-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin-slow" />
        <span>
          Construyendo vistas ({ready}/{total})…
        </span>
        <div className="flex-1 max-w-[120px] h-1 bg-primary/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-primary/60 text-[10px]">{pct}%</span>
      </div>
    </div>
  )
}
