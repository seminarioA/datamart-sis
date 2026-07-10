import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Navbar({ dark, onToggleTheme, status }) {
  return (
    <header className="h-[var(--navbar-h)] glass border-b border-border/50 flex items-center px-5 gap-3 shrink-0 z-50">
      <div>
        <p className="font-heading font-bold text-[14px] text-primary tracking-tight leading-tight">
          Atenciones de Salud
        </p>
        <p className="text-[10px] text-muted-foreground tracking-wide font-light mt-0.5">
          Seguro Integral de Salud · Datos Abiertos MINSA · Perú
        </p>
      </div>

      <div className="flex-1" />

      {status && (
        <span className="no-print text-[10px] text-muted-foreground bg-white/60 dark:bg-white/10 backdrop-blur border border-border/50 rounded-full px-3 py-1 whitespace-nowrap">
          {status}
        </span>
      )}

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
