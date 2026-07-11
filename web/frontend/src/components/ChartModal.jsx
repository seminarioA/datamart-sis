import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import ChartPanel from './ChartPanel.jsx'
import { Button } from '@/components/ui/button'

export default function ChartModal({ chart, dark, onClose }) {
  if (!chart) return null

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={chart.title}
        tabIndex={-1}
        className="w-[92vw] h-[88vh] flex flex-col rounded-lg overflow-hidden shadow-2xl animate-fade-slide-up focus:outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-primary px-4 py-2.5 flex items-center justify-between shrink-0">
          <span className="text-primary-foreground font-heading font-bold text-xs uppercase tracking-[.07em] truncate mr-3">
            {chart.title}
          </span>
          <Button
            onClick={onClose}
            size="xs"
            className="bg-white/15 hover:bg-white/25 text-white border-0 shrink-0"
          >
            <X size={13} /> Cerrar (ESC)
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <ChartPanel {...chart} dark={dark} loading={false} expanded />
        </div>
      </div>
    </div>
  )
}
