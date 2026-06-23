import React from 'react'
import { Sun, Moon } from 'lucide-react'

export default function Navbar({ dark, onToggleTheme, status }) {
  return (
    <nav style={{
      height: 'var(--navbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 1px 8px rgba(0,0,0,.05)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12, flexShrink: 0,
    }}>
      <div>
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--navy)', letterSpacing: '.01em' }}>
          Atenciones de Salud
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.04em', marginTop: 1, fontWeight: 300 }}>
          Seguro Integral de Salud · Datos Abiertos MINSA · Peru
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {status && (
        <span className="status-pill" style={{
          fontSize: 10, color: 'var(--muted)',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
        }}>
          {status}
        </span>
      )}

      <button
        onClick={onToggleTheme}
        title={dark ? 'Modo Claro' : 'Modo Oscuro'}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, color: 'var(--muted)',
          transition: 'background .15s, color .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background='var(--border)'; e.currentTarget.style.color='var(--text)' }}
        onMouseLeave={e => { e.currentTarget.style.background='var(--bg)';    e.currentTarget.style.color='var(--muted)' }}
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </nav>
  )
}
