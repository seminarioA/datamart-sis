import React, { useState, useEffect, useCallback } from 'react'
import Navbar     from './components/Navbar.jsx'
import MvBanner  from './components/MvBanner.jsx'
import KPIStrip  from './components/KPIStrip.jsx'
import ChartPanel from './components/ChartPanel.jsx'
import MapPanel  from './components/MapPanel.jsx'
import { fmt, fmtFull, trunc } from './lib/format.js'

const COLORS_LIGHT = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const COLORS_DARK  = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [kpis, setKpis] = useState(null)
  const [charts, setCharts] = useState(null)
  const [mvStatus, setMvStatus] = useState({ ready: 0, total: 8 })
  const [status, setStatus] = useState('Cargando…')

  // Apply dark class to root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  // Fetch KPIs
  const fetchKPIs = useCallback(async () => {
    try {
      const d = await fetch('/api/kpis').then(r => r.json())
      setKpis(d)
      setStatus(`${fmtFull(d.total_registros)} registros · ${new Date().toLocaleTimeString('es-PE')}`)
    } catch { setStatus('Error al cargar') }
  }, [])

  // Fetch charts
  const fetchCharts = useCallback(async () => {
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
  }, [])

  // Poll MV build status
  useEffect(() => {
    let timer
    const poll = async () => {
      try {
        const d = await fetch('/api/status').then(r => r.json())
        setMvStatus({ ready: d.mvs_ready, total: d.mvs_total })
        if (d.building) {
          timer = setTimeout(async () => { await poll(); fetchCharts(); fetchKPIs() }, 25000)
        }
      } catch {}
    }
    poll()
    return () => clearTimeout(timer)
  }, [fetchCharts, fetchKPIs])

  // Initial load
  useEffect(() => {
    fetchKPIs()
    fetchCharts()
  }, [fetchKPIs, fetchCharts])

  const c = dark ? COLORS_DARK : COLORS_LIGHT
  const loading = !charts

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar dark={dark} onToggleTheme={() => setDark(d => !d)} status={status} />
      <MvBanner ready={mvStatus.ready} total={mvStatus.total} />
      <KPIStrip data={kpis} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 12px 6px', gap: 6 }}>

        {/* ── Main row: map + right charts ─────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6,
          height: 496,
        }} className="main-row">

          {/* Map */}
          <div style={{ flex: '0 0 57%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <MapPanel regionData={charts?.region} dark={dark} />
          </div>

          {/* Right column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
            {/* Atenciones por año */}
            <div style={{ flex: '0 0 55%', minHeight: 0 }}>
              <ChartPanel
                title="Atenciones por Año"
                labels={charts?.anio?.map(d => d.anio) ?? []}
                values={charts?.anio?.map(d => Number(d.atenciones)) ?? []}
                colors={c[0]}
                horizontal={false}
                dark={dark}
                loading={loading || !charts?.anio?.length}
              />
            </div>
            {/* Pair: sexo + nivel */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, minHeight: 0 }}>
              <ChartPanel
                title="Por Sexo"
                labels={charts?.sexo?.map(d => d.sexo) ?? []}
                values={charts?.sexo?.map(d => Number(d.atenciones)) ?? []}
                colors={[c[0], c[2]]}
                horizontal
                dark={dark}
                loading={loading || !charts?.sexo?.length}
              />
              <ChartPanel
                title="Por Nivel EESS"
                labels={charts?.nivel?.map(d => d.nivel || d.nivel_eess) ?? []}
                values={charts?.nivel?.map(d => Number(d.atenciones)) ?? []}
                colors={[c[0], c[1], c[2], c[4]]}
                horizontal
                dark={dark}
                loading={loading || !charts?.nivel?.length}
              />
            </div>
          </div>
        </div>

        {/* ── Bottom row 1: región / servicios / edad ───────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6,
        }} className="bottom-row">
          {[
            {
              title: 'Top Regiones',
              labels: charts?.region?.slice(0,14).map(d => d.region) ?? [],
              values: charts?.region?.slice(0,14).map(d => Number(d.atenciones)) ?? [],
              colors: c[0],
            },
            {
              title: 'Top Servicios',
              labels: charts?.servicios?.map(d => trunc(d.servicio || d.cod_servicio, 32)) ?? [],
              values: charts?.servicios?.map(d => Number(d.atenciones)) ?? [],
              colors: c[1],
            },
            {
              title: 'Por Grupo de Edad',
              labels: charts?.edad?.map(d => d.grupo_edad) ?? [],
              values: charts?.edad?.map(d => Number(d.atenciones)) ?? [],
              colors: c[2],
            },
          ].map(p => (
            <div key={p.title} style={{ height: 290 }}>
              <ChartPanel {...p} horizontal dark={dark} loading={loading || !p.labels.length} />
            </div>
          ))}
        </div>

        {/* ── Bottom row 2: plan de seguro ─────────────────────────────────── */}
        <div style={{ height: 290, marginBottom: 6 }}>
          <ChartPanel
            title="Por Plan de Seguro"
            labels={charts?.plan?.map(d => d.desc_plan_seguro || d.cod_plan_seguro) ?? []}
            values={charts?.plan?.map(d => Number(d.atenciones)) ?? []}
            colors={c}
            horizontal
            dark={dark}
            loading={loading || !charts?.plan?.length}
          />
        </div>
      </main>

      <style>{`
        /* Responsive */
        @media (max-width: 1100px) {
          .kpi-strip > div { /* KPI */ }
        }
        @media (max-width: 860px) {
          .main-row { flex-direction: column !important; height: auto !important; }
          .main-row > div:first-child { flex: none !important; height: 360px; }
          .bottom-row { grid-template-columns: repeat(2,1fr) !important; }
          .status-pill { display: none !important; }
        }
        @media (max-width: 540px) {
          .main-row > div:first-child { height: 300px; }
          .bottom-row { grid-template-columns: 1fr !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
