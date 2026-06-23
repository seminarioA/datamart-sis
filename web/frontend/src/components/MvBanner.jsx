import React from 'react'

export default function MvBanner({ ready, total }) {
  if (ready >= total) return null
  return (
    <div style={{
      background: 'var(--navy)',
      color: '#ddeeff',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 20px', fontSize: 12,
    }}>
      <span style={{
        width: 14, height: 14, flexShrink: 0,
        border: '2px solid rgba(255,255,255,.3)',
        borderTopColor: '#fff', borderRadius: '50%',
        animation: 'spin .7s linear infinite',
        display: 'inline-block',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Construyendo vistas materializadas ({ready}/{total})… los gráficos aparecen a medida que se completan
    </div>
  )
}
