import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Navbar({ dark, onToggleTheme, status }) {
  return (
    <header className="h-[var(--navbar-h)] bg-card border-b border-border shadow-sm flex items-center px-4 gap-3 shrink-0">
      <div>
        <p className="font-heading font-bold text-[13px] text-primary tracking-tight">
          Atenciones de Salud
        </p>
        <p className="text-[10px] text-muted-foreground tracking-[.04em] font-light mt-0.5">
          Seguro Integral de Salud · Datos Abiertos MINSA · Perú
        </p>
      </div>

      <div className="flex-1" />

      {status && (
        <span className="text-[10px] text-muted-foreground bg-muted border border-border rounded-full px-3 py-1 whitespace-nowrap no-print">
          {status}
        </span>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={onToggleTheme}
        title={dark ? 'Modo Claro' : 'Modo Oscuro'}
        className="shrink-0 no-print"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </Button>
    </header>
  )
}
