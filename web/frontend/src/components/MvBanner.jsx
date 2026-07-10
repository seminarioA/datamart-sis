import React from 'react'

export default function MvBanner({ ready, total }) {
  if (ready >= total) return null
  return (
    <div className="flex items-center gap-2.5 bg-primary/90 backdrop-blur text-primary-foreground px-5 py-2 text-[11px] shrink-0">
      <span className="inline-block w-3.5 h-3.5 shrink-0 rounded-full border-2 border-white/30 border-t-white animate-spin-slow" />
      Construyendo vistas materializadas ({ready}/{total})… los gráficos aparecen a medida que se completan
    </div>
  )
}
