import React, { useEffect } from 'react'
import ChartPanel from './ChartPanel.jsx'
import { X } from 'lucide-react'

export default function ChartModal({ chart, dark, onClose }) {
  if (!chart) return null

  // Cerrar con Escape
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.75)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={onClose}
    >
      <div
        style={{ width:'92vw', height:'88vh', display:'flex', flexDirection:'column', borderRadius:6, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.4)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close bar */}
        <div style={{ background:'var(--navy)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ color:'#fff', fontSize:12, fontFamily:"'Montserrat',sans-serif", fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em' }}>
            {chart.title}
          </span>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:4, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:'4px 10px', fontSize:11 }}>
            <X size={13} /> Cerrar  (ESC)
          </button>
        </div>
        {/* Chart full size */}
        <div style={{ flex:1, minHeight:0 }}>
          <ChartPanel {...chart} dark={dark} loading={false} expanded />
        </div>
      </div>
    </div>
  )
}
