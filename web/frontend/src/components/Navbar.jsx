import React, { useState } from 'react'
import { Sun, Moon, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Navbar({ dark, onToggleTheme, status }) {
  const isError   = status === 'Error'
  const isLoading = status === 'Cargando…'
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError,   setPdfError]   = useState(null)

  const handlePdf = async () => {
    setPdfLoading(true)
    setPdfError(false)
    try {
      const resp = await fetch('/api/export/pdf')
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${resp.status}`)
      }
      const blob = await resp.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'informe_sis.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPdfError(e.message || 'Error')
      setTimeout(() => setPdfError(null), 5000)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <header className="island shrink-0 flex items-center px-5 py-3.5 gap-3 z-50">
      <div>
        <h1 className="font-heading font-bold text-[14px] text-primary tracking-tight leading-tight">
          Atenciones de Salud
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-wide font-light mt-0.5">
          Seguro Integral de Salud · Datos Abiertos MINSA · Perú
        </p>
      </div>

      <div className="flex-1" />

      {status && (
        <span className={cn(
          'no-print text-[10px] backdrop-blur border rounded-full px-3 py-1 whitespace-nowrap transition-colors',
          isError
            ? 'bg-destructive/10 text-destructive border-destructive/30'
            : isLoading
              ? 'bg-muted text-muted-foreground border-border/50 animate-pulse'
              : 'bg-white/60 dark:bg-white/10 text-muted-foreground border-border/50'
        )}>
          {status}
        </span>
      )}

      <div className="no-print relative shrink-0" data-tour="pdf">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePdf}
          disabled={pdfLoading}
          title="Exportar informe en PDF (LaTeX nativo)"
          className={cn(
            'rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur border-border/50 hover:bg-white/80 gap-1.5 text-[11px]',
            pdfError && 'border-destructive/50 text-destructive'
          )}
        >
          {pdfLoading
            ? <Loader2 size={13} className="animate-spin" />
            : <FileDown size={13} />}
          PDF
        </Button>
        {pdfError && (
          <div className="absolute right-0 top-full mt-1.5 w-64 z-50 rounded-lg border border-destructive/30 bg-background/95 backdrop-blur px-3 py-2 text-[11px] text-destructive shadow-md">
            <span className="font-semibold block mb-0.5">Error al generar el PDF</span>
            <span className="text-muted-foreground">{pdfError}</span>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onToggleTheme}
        title={dark ? 'Modo Claro' : 'Modo Oscuro'}
        className="no-print shrink-0 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur border-border/50 hover:bg-white/80"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
    </header>
  )
}
