import React, { useState, useEffect, useCallback } from 'react'
import Sidebar      from './components/Sidebar.jsx'
import Navbar       from './components/Navbar.jsx'
import MvBanner     from './components/MvBanner.jsx'
import KPIStrip     from './components/KPIStrip.jsx'
import ChartPanel   from './components/ChartPanel.jsx'
import ChartModal   from './components/ChartModal.jsx'
import MapPanel     from './components/MapPanel.jsx'
import Predicciones from './components/Predicciones.jsx'
import Acerca       from './components/Acerca.jsx'
import Glosario     from './components/Glosario.jsx'
import Acciones     from './components/Acciones.jsx'
import Onboarding   from './components/Onboarding.jsx'
import { fmt, fmtFull, trunc } from './lib/format.js'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CL = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const CD = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']

export default function App() {
  const [dark, setDark]            = useState(() => localStorage.getItem('theme') === 'dark')
  const [collapsed, setCollapsed]  = useState(false)
  const [module, setModule]        = useState('overview')
  const [moduleKey, setModuleKey]  = useState(0)
  const [kpis, setKpis]            = useState(null)
  const [charts, setCharts]        = useState(null)
  const [mvStatus, setMvStatus]    = useState({ ready: 0, total: 8 })
  const [status, setStatus]        = useState('Cargando…')
  const [showOnboarding, setOnboarding] = useState(() => !localStorage.getItem('visited_v1'))
  const [expandedChart, setExpandedChart] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filterTopN, setFilterTopN]   = useState(12)
  const [filterYears, setFilterYears] = useState([])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const closeOnboarding = () => { localStorage.setItem('visited_v1', '1'); setOnboarding(false) }
  const handlePrint = () => window.print()

  const fetchKPIs = useCallback(async () => {
    try {
      const d = await fetch('/api/kpis').then(r => r.json())
      setKpis(d)
      setStatus(`${fmtFull(d.total_registros)} registros · ${new Date().toLocaleTimeString('es-PE')}`)
    } catch { setStatus('Error') }
  }, [])

  const fetchCharts = useCallback(async () => {
    try {
      const d = await fetch('/api/dashboard').then(r => r.json())
      if (d.kpis?.total_atenciones != null) setKpis(d.kpis)
      setCharts({ anio: d.anio||[], region: d.region||[], edad: d.edad||[], sexo: d.sexo||[], servicios: d.servicios||[], nivel: d.nivel||[], plan: d.plan||[] })
    } catch {
      const [anio, region, edad, sexo, servicios, nivel, plan] = await Promise.all([
        fetch('/api/por-anio').then(r => r.json()).catch(() => []),
        fetch('/api/por-region').then(r => r.json()).catch(() => []),
        fetch('/api/por-edad').then(r => r.json()).catch(() => []),
        fetch('/api/por-sexo').then(r => r.json()).catch(() => []),
        fetch('/api/top-servicios').then(r => r.json()).catch(() => []),
        fetch('/api/por-nivel').then(r => r.json()).catch(() => []),
        fetch('/api/por-plan').then(r => r.json()).catch(() => []),
      ])
      setCharts({ anio, region, edad, sexo, servicios, nivel, plan })
    }
  }, [])

  useEffect(() => {
    let t
    const poll = async () => {
      try {
        const d = await fetch('/api/status').then(r => r.json())
        setMvStatus({ ready: d.mvs_ready, total: d.mvs_total })
        if (d.building) t = setTimeout(async () => { await poll(); fetchCharts(); fetchKPIs() }, 25000)
      } catch {}
    }
    poll()
    return () => clearTimeout(t)
  }, [fetchCharts, fetchKPIs])

  useEffect(() => { fetchKPIs(); fetchCharts() }, [fetchKPIs, fetchCharts])

  const c = dark ? CD : CL
  const loading = !charts

  const applyYearFilter = (data, yearKey = 'anio') =>
    filterYears.length === 0 ? data : (data || []).filter(d => filterYears.includes(String(d[yearKey])))

  const expand = (title, type, labels, values, colors) =>
    setExpandedChart({ title, type, labels, values, colors })

  const availableYears = [...new Set((charts?.anio || []).map(d => String(d.anio)))].sort()

  // ── Filter Bar ─────────────────────────────────────────────────────────────
  const FilterBar = ({ force = false, showTopN = true }) => {
    if (!showFilters && !force) return null
    return (
      <div className="no-print filter-bar-anim bg-card border-b-2 border-primary px-3.5 py-2.5 flex items-center flex-wrap gap-3">
        {showTopN && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">Top N:</span>
            <div className="flex gap-1">
              {[5, 10, 12, 26].map(n => (
                <Button
                  key={n}
                  size="xs"
                  variant={filterTopN === n ? 'default' : 'outline'}
                  onClick={() => setFilterTopN(n)}
                >
                  {n === 26 ? 'Todos' : n}
                </Button>
              ))}
            </div>
          </div>
        )}
        {availableYears.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-semibold whitespace-nowrap">Años:</span>
            <div className="flex gap-1 flex-wrap">
              {availableYears.map(yr => (
                <Button
                  key={yr}
                  size="xs"
                  variant={filterYears.includes(yr) ? 'default' : 'outline'}
                  onClick={() => setFilterYears(p => p.includes(yr) ? p.filter(y => y !== yr) : [...p, yr])}
                >
                  {yr}
                </Button>
              ))}
              {filterYears.length > 0 && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setFilterYears([])}
                  className="border-[var(--accent-c)] text-[var(--accent-c)] hover:bg-[var(--accent-c)] hover:text-white gap-1"
                >
                  <X size={10} /> Limpiar
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Module content ─────────────────────────────────────────────────────────
  const moduleContent = () => {
    switch (module) {
      case 'acerca':       return <Acerca dark={dark} />
      case 'glosario':     return <Glosario />
      case 'acciones':     return <Acciones dark={dark} />
      case 'predicciones': return <Predicciones dark={dark} />

      case 'map':
        return (
          <div className="flex-1 p-3 overflow-hidden">
            <div className="h-[calc(100vh-175px)] flex flex-col">
              <MapPanel regionData={charts?.region} dark={dark} />
            </div>
          </div>
        )

      case 'demographics':
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FilterBar force />
            <div className="flex-1 p-3 grid grid-cols-2 gap-2 overflow-y-auto">
              <div className="h-[340px]">
                <ChartPanel type="donut" title="Atenciones por Sexo"
                  labels={charts?.sexo?.map(d => d.sexo) ?? []}
                  values={charts?.sexo?.map(d => Number(d.atenciones)) ?? []}
                  colors={[c[0], c[4]]} dark={dark} loading={loading || !charts?.sexo?.length}
                  onExpand={() => expand('Atenciones por Sexo', 'donut', charts?.sexo?.map(d => d.sexo), charts?.sexo?.map(d => Number(d.atenciones)), [c[0], c[4]])} />
              </div>
              <div className="h-[340px]">
                <ChartPanel type="hbar" title="Por Grupo de Edad"
                  labels={charts?.edad?.map(d => d.grupo_edad) ?? []}
                  values={charts?.edad?.map(d => Number(d.atenciones)) ?? []}
                  colors={c[2]} dark={dark} loading={loading || !charts?.edad?.length}
                  onExpand={() => expand('Por Grupo de Edad', 'hbar', charts?.edad?.map(d => d.grupo_edad), charts?.edad?.map(d => Number(d.atenciones)), c[2])} />
              </div>
            </div>
          </div>
        )

      case 'geography':
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FilterBar force />
            <div className="flex-1 p-3 grid grid-cols-2 gap-2 overflow-y-auto">
              <div className="h-[380px]">
                <ChartPanel type="hbar" title={`Top ${filterTopN} Regiones`}
                  labels={charts?.region?.slice(0, filterTopN).map(d => d.region) ?? []}
                  values={charts?.region?.slice(0, filterTopN).map(d => Number(d.atenciones)) ?? []}
                  colors={c[0]} dark={dark} loading={loading || !charts?.region?.length}
                  onExpand={() => expand(`Top ${filterTopN} Regiones`, 'hbar', charts?.region?.slice(0, filterTopN).map(d => d.region), charts?.region?.slice(0, filterTopN).map(d => Number(d.atenciones)), c[0])} />
              </div>
              <div className="h-[380px]">
                <ChartPanel type="hbar" title="Por Nivel EESS"
                  labels={charts?.nivel?.map(d => d.nivel || d.nivel_eess) ?? []}
                  values={charts?.nivel?.map(d => Number(d.atenciones)) ?? []}
                  colors={[c[0], c[1], c[2], c[4]]} dark={dark} loading={loading || !charts?.nivel?.length}
                  onExpand={() => expand('Por Nivel EESS', 'hbar', charts?.nivel?.map(d => d.nivel || d.nivel_eess), charts?.nivel?.map(d => Number(d.atenciones)), [c[0], c[1], c[2], c[4]])} />
              </div>
            </div>
          </div>
        )

      case 'services':
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FilterBar force />
            <div className="flex-1 p-3 grid grid-cols-2 gap-2 overflow-y-auto">
              <div className="h-[380px]">
                <ChartPanel type="hbar" title={`Top ${filterTopN} Servicios`}
                  labels={charts?.servicios?.slice(0, filterTopN).map(d => trunc(d.servicio || d.cod_servicio, 30)) ?? []}
                  values={charts?.servicios?.slice(0, filterTopN).map(d => Number(d.atenciones)) ?? []}
                  colors={c[1]} dark={dark} loading={loading || !charts?.servicios?.length}
                  onExpand={() => expand(`Top ${filterTopN} Servicios`, 'hbar', charts?.servicios?.slice(0, filterTopN).map(d => trunc(d.servicio || d.cod_servicio, 40)), charts?.servicios?.slice(0, filterTopN).map(d => Number(d.atenciones)), c[1])} />
              </div>
              <div className="h-[380px]">
                <ChartPanel type="donut" title="Por Plan de Seguro"
                  labels={charts?.plan?.map(d => d.desc_plan_seguro || d.cod_plan_seguro) ?? []}
                  values={charts?.plan?.map(d => Number(d.atenciones)) ?? []}
                  colors={c} dark={dark} loading={loading || !charts?.plan?.length}
                  onExpand={() => expand('Por Plan de Seguro', 'donut', charts?.plan?.map(d => d.desc_plan_seguro || d.cod_plan_seguro), charts?.plan?.map(d => Number(d.atenciones)), c)} />
              </div>
            </div>
          </div>
        )

      case 'trends': {
        const anioData = applyYearFilter(charts?.anio)
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            <FilterBar force />
            <div className="flex-1 p-3 overflow-y-auto">
              <div className="h-[400px]">
                <ChartPanel type="line" title="Evolución de Atenciones por Año"
                  labels={anioData?.map(d => String(d.anio)) ?? []}
                  values={anioData?.map(d => Number(d.atenciones)) ?? []}
                  colors={[c[0]]} dark={dark} loading={loading || !charts?.anio?.length}
                  onExpand={() => expand('Evolución por Año', 'line', anioData?.map(d => String(d.anio)), anioData?.map(d => Number(d.atenciones)), [c[0]])} />
              </div>
            </div>
          </div>
        )
      }

      default: // overview
        return (
          <div className="flex-1 flex flex-col overflow-y-auto">
            {/* Toolbar */}
            <div className="no-print px-3 pt-1.5 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant={showFilters ? 'default' : 'outline'}
                onClick={() => setShowFilters(v => !v)}
                className="gap-1.5 text-[11px]"
              >
                <SlidersHorizontal size={12} />
                Filtros{filterYears.length > 0 ? ' (Años)' : ''}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrint}
                className="text-[11px]"
              >
                Imprimir / Guardar PDF
              </Button>
            </div>

            <FilterBar showTopN={false} />

            {/* Main row */}
            <div className="main-row flex gap-2 h-[480px] px-3 pt-1.5">
              <div className="flex-[0_0_56%] min-h-0 flex flex-col">
                <MapPanel regionData={charts?.region} dark={dark} />
                {/* Print-only table */}
                <div className="print-map-replacement hidden h-full bg-card border border-border">
                  <div className="px-3 py-2 text-[10px] font-heading font-bold uppercase tracking-[.07em] text-primary border-b border-border border-l-[3px] border-l-primary">
                    Atenciones por Departamento
                  </div>
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-2 py-1 text-left font-bold">Región</th>
                        <th className="px-2 py-1 text-right font-bold">Atenciones</th>
                        <th className="px-2 py-1 text-right font-bold">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const total = (charts?.region || []).reduce((s, r) => s + Number(r.atenciones), 0)
                        return (charts?.region || []).slice(0, 14).map((r, i) => (
                          <tr key={i} className="border-b border-border">
                            <td className="px-2 py-0.5 text-foreground">{r.region}</td>
                            <td className="px-2 py-0.5 text-right tabular-nums">{Number(r.atenciones).toLocaleString('es-PE')}</td>
                            <td className="px-2 py-0.5 text-right text-muted-foreground">{(Number(r.atenciones) / total * 100).toFixed(1)}%</td>
                          </tr>
                        ))
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                <div className="flex-[0_0_52%] min-h-0">
                  <ChartPanel type="line" title="Atenciones por Año"
                    labels={applyYearFilter(charts?.anio)?.map(d => String(d.anio)) ?? []}
                    values={applyYearFilter(charts?.anio)?.map(d => Number(d.atenciones)) ?? []}
                    colors={[c[0]]} dark={dark} loading={loading || !charts?.anio?.length}
                    onExpand={() => expand('Atenciones por Año', 'line', applyYearFilter(charts?.anio)?.map(d => String(d.anio)), applyYearFilter(charts?.anio)?.map(d => Number(d.atenciones)), [c[0]])} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-1.5 min-h-0">
                  <ChartPanel type="donut" title="Por Sexo"
                    labels={charts?.sexo?.map(d => d.sexo) ?? []}
                    values={charts?.sexo?.map(d => Number(d.atenciones)) ?? []}
                    colors={[c[0], c[4]]} dark={dark} loading={loading || !charts?.sexo?.length}
                    onExpand={() => expand('Por Sexo', 'donut', charts?.sexo?.map(d => d.sexo), charts?.sexo?.map(d => Number(d.atenciones)), [c[0], c[4]])} />
                  <ChartPanel type="hbar" title="Por Nivel EESS"
                    labels={charts?.nivel?.map(d => d.nivel || d.nivel_eess) ?? []}
                    values={charts?.nivel?.map(d => Number(d.atenciones)) ?? []}
                    colors={[c[0], c[1], c[2], c[4]]} dark={dark} loading={loading || !charts?.nivel?.length}
                    onExpand={() => expand('Por Nivel EESS', 'hbar', charts?.nivel?.map(d => d.nivel || d.nivel_eess), charts?.nivel?.map(d => Number(d.atenciones)), [c[0], c[1], c[2], c[4]])} />
                </div>
              </div>
            </div>

            {/* Quick nav */}
            <div className="no-print px-3 py-3 flex gap-2 flex-wrap">
              {[['Geografía','geography'],['Servicios','services'],['Demografía','demographics'],['Tendencia','trends']].map(([label, id]) => (
                <Button
                  key={id}
                  size="xs"
                  variant="outline"
                  onClick={() => { setModule(id); setModuleKey(k => k + 1) }}
                >
                  Ver {label} →
                </Button>
              ))}
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
      {expandedChart && <ChartModal chart={expandedChart} dark={dark} onClose={() => setExpandedChart(null)} />}

      <Sidebar
        active={module}
        onModule={m => { setModule(m); setModuleKey(k => k + 1) }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        airflowUrl={null}
      />

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Navbar dark={dark} onToggleTheme={() => setDark(d => !d)} status={status} />
        <MvBanner ready={mvStatus.ready} total={mvStatus.total} />
        <KPIStrip data={kpis} rawData={charts} />
        <div key={moduleKey} className="animate-fade-slide-up flex-1 flex flex-col overflow-hidden min-h-0">
          {moduleContent()}
        </div>
      </div>

      {/* Print footer */}
      <div className="print-footer-citation hidden">
        <div className="flex justify-between">
          <div>
            <strong>Autores:</strong> Alejandro Seminario Medina · Sigidiego Ortega Vilela · Sergio Mena Delgado<br />
            <strong>Docente:</strong> Balcazar Chumacero, Oscar Eduardo | <strong>Curso:</strong> Inteligencia de Negocios | Universidad Tecnológica del Perú — 2025–2026
          </div>
          <div className="text-right">
            <strong>Fuente:</strong> SIS — MINSA · datosabiertos.gob.pe · ODC-By<br />
            github.com/seminarioA/datamart-sis
          </div>
        </div>
      </div>
    </div>
  )
}
