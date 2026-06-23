import React from 'react'

export default function Navbar({ dark, onToggleTheme, status }) {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 1000,
      height: 'var(--navbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 12px rgba(0,0,0,.07)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 14,
    }}>
      {/* Logo */}
      <img
        src="/sis_logo.png"
        alt="SIS"
        style={{ height: 36, width: 'auto', flexShrink: 0 }}
      />

      {/* Divider */}
      <div style={{
        width: 1, height: 28,
        background: 'var(--border)', flexShrink: 0,
      }} />

      {/* Title block */}
      <div>
        <div style={{
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700, fontSize: 13,
          color: 'var(--navy)', letterSpacing: '.01em',
        }}>
          Atenciones de Salud
        </div>
        <div style={{
          fontSize: 10, color: 'var(--muted)',
          letterSpacing: '.04em', marginTop: 1,
          fontWeight: 300,
        }}>
          Datos Abiertos MINSA · Perú
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Status pill */}
      {status && (
        <span style={{
          fontSize: 10, color: 'var(--muted)',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: '3px 10px',
          whiteSpace: 'nowrap',
          display: 'none',  // hidden on mobile via CSS
        }} className="status-pill">
          {status}
        </span>
      )}

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
          color: 'var(--muted)',
          fontSize: 16,
          transition: 'background .15s, color .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--border)'
          e.currentTarget.style.color = 'var(--text)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--bg)'
          e.currentTarget.style.color = 'var(--muted)'
        }}
      >
        {dark ? '☀️' : '🌙'}
      </button>
    </nav>
  )
}
