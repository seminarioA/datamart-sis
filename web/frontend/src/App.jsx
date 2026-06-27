import React, { useState, useEffect, useCallback } from 'react'
import Sidebar        from './components/Sidebar.jsx'
import Navbar         from './components/Navbar.jsx'
import MvBanner       from './components/MvBanner.jsx'
import KPIStrip       from './components/KPIStrip.jsx'
import ChartPanel     from './components/ChartPanel.jsx'
import MapPanel       from './components/MapPanel.jsx'
import Predicciones   from './components/Predicciones.jsx'
import { fmt, fmtFull, trunc } from './lib/format.js'

const COLORS_LIGHT = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const COLORS_DARK  = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']

const CHART_H_MAIN   = 280
const CHART_H_BOTTOM = 290

export default function App() {
  const [dark,       setDark]       = useState(() => localStorage.getItem('theme') === 'dark')
  const [collapsed,  setCollapsed]  = useState(false)
  const [module,     setModule]     = useState('overview')
  const [kpis,       setKpis]       = useState(null)
  const [charts,     setCharts]     = useState(null)
  const [mvStatus,   setMvStatus]   = useState({ ready: 0, total: 8 })
  const [status,     setStatus]     = useState('Cargando…')
  const [airflowUrl, setAirflowUrl] = useState(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  // Fetch Airflow URL from latest GitHub release (or hardcode from env)
  useEffect(() => {
    // Try to read from window env (injected at build time) or skip
    const url = window.__AIRFLOW_URL__ || null
    if (url) setAirflowUrl(url)
  }, [])

  const fetchKPIs = useCallback(async () => {
    try {
      const d = await fetch('/api/kpis').then(r => r.json())
      setKpis(d)
      setStatus(`${fmtFull(d.total_registros)} registros · ${new Date().toLocaleTimeString('es-PE')}`)
    } catch { setStatus('Error al cargar') }
  }, [])

  // 1 sola llamada en vez de 8 — reduce round-trips por cloudflared de ~8×600ms a 1×800ms
  const fetchCharts = useCallback(async () => {
    try {
      const d = await fetch('/api/dashboard').then(r => r.json())
      const { kpis: kpisData, anio, region, edad, sexo, servicios, nivel, plan } = d
      // Si el endpoint devuelve los KPIs también, los actualizamos
      if (kpisData && kpisData.total_atenciones != null) setKpis(kpisData)
      setCharts({ anio: anio||[], region: region||[], edad: edad||[], sexo: sexo||[], servicios: servicios||[], nivel: nivel||[], plan: plan||[] })
    } catch {
      // Fallback a llamadas individuales si /api/dashboard falla
      const [anio, region, edad, sexo, servicios, nivel, plan] = await Promise.all([
        fetch('/api/por-anio').then(r=>r.json()).catch(()=>[]),
        fetch('/api/por-region').then(r=>r.json()).catch(()=>[]),
        fetch('/api/por-edad').then(r=>r.json()).catch(()=>[]),
        fetch('/api/por-sexo').then(r=>r.json()).catch(()=>[]),
        fetch('/api/top-servicios').then(r=>r.json()).catch(()=>[]),
        fetch('/api/por-nivel').then(r=>r.json()).catch(()=>[]),
        fetch('/api/por-plan').then(r=>r.json()).catch(()=>[]),
      ])
      setCharts({ anio, region, edad, sexo, servicios, nivel, plan })
    }
  }, [])

  useEffect(() => {
    let timer
    const poll = async () => {
      try {
        const d = await fetch('/api/status').then(r => r.json())
        setMvStatus({ ready: d.mvs_ready, total: d.mvs_total })
        if (d.building) timer = setTimeout(async () => { await poll(); fetchCharts(); fetchKPIs() }, 25000)
      } catch {}
    }
    poll()
    return () => clearTimeout(timer)
  }, [fetchCharts, fetchKPIs])

  useEffect(() => { fetchKPIs(); fetchCharts() }, [fetchKPIs, fetchCharts])

  const c       = dark ? COLORS_DARK : COLORS_LIGHT
  const loading = !charts

  // ── Chart sets per module ──────────────────────────────────────────────────
  const moduleContent = () => {
    switch (module) {
      case 'predicciones':
        return <Predicciones dark={dark} />

      case 'map':
        return (
          // height: calc(100vh - navbar(60) - kpi(73) - padding) garantiza px concretos para Leaflet
          <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, position: 'relative', minHeight: 400 }}>
              <MapPanel regionData={charts?.region} dark={dark} />
            </div>
          </div>
        )

      case 'demographics':
        return (
          <div style={{ flex: 1, padding: '12px 12px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ height: CHART_H_MAIN + 80 }}>
              <ChartPanel title="Por Sexo" labels={charts?.sexo?.map(d=>d.sexo)??[]} values={charts?.sexo?.map(d=>Number(d.atenciones))??[]} colors={[c[0],c[2]]} horizontal dark={dark} loading={loading||!charts?.sexo?.length} />
            </div>
            <div style={{ height: CHART_H_MAIN + 80 }}>
              <ChartPanel title="Por Grupo de Edad" labels={charts?.edad?.map(d=>d.grupo_edad)??[]} values={charts?.edad?.map(d=>Number(d.atenciones))??[]} colors={c[2]} horizontal dark={dark} loading={loading||!charts?.edad?.length} />
            </div>
          </div>
        )

      case 'geography':
        return (
          <div style={{ flex: 1, padding: '12px 12px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ height: CHART_H_MAIN + 80 }}>
              <ChartPanel title="Top Regiones" labels={charts?.region?.slice(0,14).map(d=>d.region)??[]} values={charts?.region?.slice(0,14).map(d=>Number(d.atenciones))??[]} colors={c[0]} horizontal dark={dark} loading={loading||!charts?.region?.length} />
            </div>
            <div style={{ height: CHART_H_MAIN + 80 }}>
              <ChartPanel title="Por Nivel EESS" labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]} values={charts?.nivel?.map(d=>Number(d.atenciones))??[]} colors={[c[0],c[1],c[2],c[4]]} horizontal dark={dark} loading={loading||!charts?.nivel?.length} />
            </div>
          </div>
        )

      case 'services':
        return (
          <div style={{ flex: 1, padding: '12px 12px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div style={{ height: CHART_H_MAIN + 80 }}>
              <ChartPanel title="Top Servicios" labels={charts?.servicios?.map(d=>trunc(d.servicio||d.cod_servicio,32))??[]} values={charts?.servicios?.map(d=>Number(d.atenciones))??[]} colors={c[1]} horizontal dark={dark} loading={loading||!charts?.servicios?.length} />
            </div>
            <div style={{ height: CHART_H_MAIN + 80 }}>
              <ChartPanel title="Por Plan de Seguro" labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]} values={charts?.plan?.map(d=>Number(d.atenciones))??[]} colors={c} horizontal dark={dark} loading={loading||!charts?.plan?.length} />
            </div>
          </div>
        )

      case 'trends':
        return (
          <div style={{ flex: 1, padding: '12px 12px 6px' }}>
            <div style={{ height: CHART_H_MAIN + 120 }}>
              <ChartPanel title="Atenciones por Año" labels={charts?.anio?.map(d=>d.anio)??[]} values={charts?.anio?.map(d=>Number(d.atenciones))??[]} colors={c[0]} horizontal={false} dark={dark} loading={loading||!charts?.anio?.length} />
            </div>
          </div>
        )

      default: // overview
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Main row */}
            <div style={{ display: 'flex', gap: 6, height: 496, padding: '12px 12px 6px' }} className="main-row">
              <div style={{ flex: '0 0 57%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <MapPanel regionData={charts?.region} dark={dark} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
                <div style={{ flex: '0 0 55%', minHeight: 0 }}>
                  <ChartPanel title="Atenciones por Año" labels={charts?.anio?.map(d=>d.anio)??[]} values={charts?.anio?.map(d=>Number(d.atenciones))??[]} colors={c[0]} horizontal={false} dark={dark} loading={loading||!charts?.anio?.length} />
                </div>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, minHeight: 0 }}>
                  <ChartPanel title="Por Sexo" labels={charts?.sexo?.map(d=>d.sexo)??[]} values={charts?.sexo?.map(d=>Number(d.atenciones))??[]} colors={[c[0],c[2]]} horizontal dark={dark} loading={loading||!charts?.sexo?.length} />
                  <ChartPanel title="Por Nivel EESS" labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]} values={charts?.nivel?.map(d=>Number(d.atenciones))??[]} colors={[c[0],c[1],c[2],c[4]]} horizontal dark={dark} loading={loading||!charts?.nivel?.length} />
                </div>
              </div>
            </div>
            {/* Bottom row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, padding: '0 12px 6px' }} className="bottom-row">
              {[
                { title:'Top Regiones',     labels:charts?.region?.slice(0,14).map(d=>d.region)??[],              values:charts?.region?.slice(0,14).map(d=>Number(d.atenciones))??[], colors:c[0] },
                { title:'Top Servicios',    labels:charts?.servicios?.map(d=>trunc(d.servicio||d.cod_servicio,32))??[], values:charts?.servicios?.map(d=>Number(d.atenciones))??[],            colors:c[1] },
                { title:'Por Grupo de Edad',labels:charts?.edad?.map(d=>d.grupo_edad)??[],                         values:charts?.edad?.map(d=>Number(d.atenciones))??[],                    colors:c[2] },
              ].map(p => (
                <div key={p.title} style={{ height: CHART_H_BOTTOM }}>
                  <ChartPanel {...p} horizontal dark={dark} loading={loading||!p.labels.length} />
                </div>
              ))}
            </div>
            <div style={{ height: CHART_H_BOTTOM, padding: '0 12px 12px' }}>
              <ChartPanel title="Por Plan de Seguro" labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]} values={charts?.plan?.map(d=>Number(d.atenciones))??[]} colors={c} horizontal dark={dark} loading={loading||!charts?.plan?.length} />
            </div>
          </div>
        )
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <Sidebar
        active={module}
        onModule={setModule}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
        airflowUrl={airflowUrl}
      />

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Navbar dark={dark} onToggleTheme={() => setDark(d => !d)} status={status} />
        <MvBanner ready={mvStatus.ready} total={mvStatus.total} />
        <KPIStrip data={kpis} rawData={charts} />
        {moduleContent()}
      </div>

      <style>{`
        @media (max-width:860px) {
          .main-row { flex-direction:column!important; height:auto!important; }
          .main-row > div:first-child { flex:none!important; height:360px; }
          .bottom-row { grid-template-columns:repeat(2,1fr)!important; }
        }
        @media (max-width:540px) {
          .main-row > div:first-child { height:300px; }
          .bottom-row { grid-template-columns:1fr!important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
