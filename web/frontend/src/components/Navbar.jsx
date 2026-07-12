import React, { useState } from 'react'
import { Sun, Moon, FileDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Navbar({ dark, onToggleTheme, status }) {
  const isError   = status === 'Error'
  const isLoading = status === 'Cargando…'
  const [pdfLoading, setPdfLoading] = useState(false)

  const handlePdf = async () => {
    setPdfLoading(true)
    try {
      const resp = await fetch('/api/export/pdf')
      if (!resp.ok) throw new Error(await resp.text())
      const blob = await resp.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'informe_sis.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('No se pudo generar el PDF. Verifique que pdflatex esté instalado en el servidor.')
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

      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={pdfLoading}
        title="Exportar informe en PDF (LaTeX nativo)"
        className="no-print shrink-0 rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur border-border/50 hover:bg-white/80 gap-1.5 text-[11px]"
      >
        {pdfLoading
          ? <Loader2 size={13} className="animate-spin" />
          : <FileDown size={13} />}
        PDF
      </Button>

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
