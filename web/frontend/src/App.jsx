import React, { useState, useEffect, useCallback } from 'react'
import Sidebar      from './components/Sidebar.jsx'
import Navbar       from './components/Navbar.jsx'
import MvBanner     from './components/MvBanner.jsx'
import KPIStrip     from './components/KPIStrip.jsx'
import ChartPanel   from './components/ChartPanel.jsx'
import MapPanel     from './components/MapPanel.jsx'
import Predicciones from './components/Predicciones.jsx'
import Acerca       from './components/Acerca.jsx'
import Glosario     from './components/Glosario.jsx'
import Onboarding   from './components/Onboarding.jsx'
import { fmt, fmtFull, trunc } from './lib/format.js'

const CL = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const CD = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']
const H_BOT = 320

export default function App() {
  const [dark, setDark]            = useState(() => localStorage.getItem('theme')==='dark')
  const [collapsed, setCollapsed]  = useState(false)
  const [module, setModule]        = useState('overview')
  const [kpis, setKpis]            = useState(null)
  const [charts, setCharts]        = useState(null)
  const [mvStatus, setMvStatus]    = useState({ ready:0, total:8 })
  const [status, setStatus]        = useState('Cargando…')
  const [showOnboarding, setOnboarding] = useState(() => !localStorage.getItem('visited_v1'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark?'dark':'light')
  }, [dark])

  const closeOnboarding = () => {
    localStorage.setItem('visited_v1', '1')
    setOnboarding(false)
  }

  const fetchKPIs = useCallback(async () => {
    try {
      const d = await fetch('/api/kpis').then(r=>r.json())
      setKpis(d)
      setStatus(`${fmtFull(d.total_registros)} registros · ${new Date().toLocaleTimeString('es-PE')}`)
    } catch { setStatus('Error al cargar') }
  }, [])

  const fetchCharts = useCallback(async () => {
    try {
      const d = await fetch('/api/dashboard').then(r=>r.json())
      if (d.kpis?.total_atenciones != null) setKpis(d.kpis)
      setCharts({ anio:d.anio||[], region:d.region||[], edad:d.edad||[], sexo:d.sexo||[], servicios:d.servicios||[], nivel:d.nivel||[], plan:d.plan||[] })
    } catch {
      const [anio,region,edad,sexo,servicios,nivel,plan] = await Promise.all([
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
    let t
    const poll = async () => {
      try {
        const d = await fetch('/api/status').then(r=>r.json())
        setMvStatus({ ready:d.mvs_ready, total:d.mvs_total })
        if (d.building) t = setTimeout(async()=>{ await poll(); fetchCharts(); fetchKPIs() }, 25000)
      } catch {}
    }
    poll()
    return () => clearTimeout(t)
  }, [fetchCharts, fetchKPIs])

  useEffect(() => { fetchKPIs(); fetchCharts() }, [fetchKPIs, fetchCharts])

  const c = dark ? CD : CL
  const loading = !charts

  const moduleContent = () => {
    switch (module) {

      case 'acerca':     return <Acerca dark={dark} />
      case 'glosario':   return <Glosario />
      case 'predicciones': return <Predicciones dark={dark} />

      case 'map':
        return (
          <div style={{ flex:1, padding:'12px', overflow:'hidden' }}>
            {/* display:flex+flexDirection:column es CRÍTICO: sin esto flex:1 de MapPanel da h=0 */}
            <div style={{ height:'calc(100vh - 175px)', display:'flex', flexDirection:'column' }}>
              <MapPanel regionData={charts?.region} dark={dark} />
            </div>
          </div>
        )

      case 'demographics':
        return (
          <div style={{ flex:1, padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
            <div style={{ height:340 }}>
              <ChartPanel type="donut" title="Atenciones por Sexo"
                labels={charts?.sexo?.map(d=>d.sexo)??[]} values={charts?.sexo?.map(d=>Number(d.atenciones))??[]}
                colors={[c[0],c[4]]} dark={dark} loading={loading||!charts?.sexo?.length} />
            </div>
            <div style={{ height:340 }}>
              <ChartPanel type="hbar" title="Por Grupo de Edad"
                labels={charts?.edad?.map(d=>d.grupo_edad)??[]} values={charts?.edad?.map(d=>Number(d.atenciones))??[]}
                colors={c[2]} dark={dark} loading={loading||!charts?.edad?.length} />
            </div>
          </div>
        )

      case 'geography':
        return (
          <div style={{ flex:1, padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
            <div style={{ height:380 }}>
              <ChartPanel type="hbar" title="Top Regiones"
                labels={charts?.region?.slice(0,14).map(d=>d.region)??[]} values={charts?.region?.slice(0,14).map(d=>Number(d.atenciones))??[]}
                colors={c[0]} dark={dark} loading={loading||!charts?.region?.length} />
            </div>
            <div style={{ height:380 }}>
              <ChartPanel type="hbar" title="Por Nivel EESS"
                labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]} values={charts?.nivel?.map(d=>Number(d.atenciones))??[]}
                colors={[c[0],c[1],c[2],c[4]]} dark={dark} loading={loading||!charts?.nivel?.length} />
            </div>
          </div>
        )

      case 'services':
        return (
          <div style={{ flex:1, padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
            <div style={{ height:380 }}>
              <ChartPanel type="hbar" title="Top 15 Servicios"
                labels={charts?.servicios?.map(d=>trunc(d.servicio||d.cod_servicio,30))??[]} values={charts?.servicios?.map(d=>Number(d.atenciones))??[]}
                colors={c[1]} dark={dark} loading={loading||!charts?.servicios?.length} />
            </div>
            <div style={{ height:380 }}>
              <ChartPanel type="donut" title="Por Plan de Seguro"
                labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]} values={charts?.plan?.map(d=>Number(d.atenciones))??[]}
                colors={c} dark={dark} loading={loading||!charts?.plan?.length} />
            </div>
          </div>
        )

      case 'trends':
        return (
          <div style={{ flex:1, padding:'12px', overflowY:'auto' }}>
            <div style={{ height:400 }}>
              <ChartPanel type="line" title="Evolución de Atenciones por Año"
                labels={charts?.anio?.map(d=>String(d.anio))??[]} values={charts?.anio?.map(d=>Number(d.atenciones))??[]}
                colors={[c[0]]} dark={dark} loading={loading||!charts?.anio?.length} />
            </div>
          </div>
        )

      default: // overview
        return (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
            {/* Botón PDF */}
            <div style={{ padding:'6px 12px 0', display:'flex', justifyContent:'flex-end' }} className="no-print">
              <button onClick={()=>window.print()}
                style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color:'var(--navy)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontFamily:"'Signika',sans-serif" }}>
                ⬇ Descargar PDF
              </button>
            </div>

            {/* Fila 1: Mapa + columna derecha */}
            <div style={{ display:'flex', gap:8, height:480, padding:'6px 12px' }} className="main-row">
              <div style={{ flex:'0 0 56%', minHeight:0 }}>
                <MapPanel regionData={charts?.region} dark={dark} />
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
                <div style={{ flex:'0 0 52%', minHeight:0 }}>
                  <ChartPanel type="line" title="Atenciones por Año"
                    labels={charts?.anio?.map(d=>String(d.anio))??[]} values={charts?.anio?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0]]} dark={dark} loading={loading||!charts?.anio?.length} />
                </div>
                <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, minHeight:0 }}>
                  <ChartPanel type="donut" title="Por Sexo"
                    labels={charts?.sexo?.map(d=>d.sexo)??[]} values={charts?.sexo?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0],c[4]]} dark={dark} loading={loading||!charts?.sexo?.length} />
                  <ChartPanel type="hbar" title="Por Nivel EESS"
                    labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]} values={charts?.nivel?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0],c[1],c[2],c[4]]} dark={dark} loading={loading||!charts?.nivel?.length} />
                </div>
              </div>
            </div>

            {/* Fila 2: 3 columnas */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'0 12px 8px' }}>
              {[
                { title:'Top Regiones',     labels:charts?.region?.slice(0,12).map(d=>d.region)??[],               values:charts?.region?.slice(0,12).map(d=>Number(d.atenciones))??[],  colors:c[0] },
                { title:'Top Servicios',    labels:charts?.servicios?.map(d=>trunc(d.servicio||d.cod_servicio,26))??[], values:charts?.servicios?.map(d=>Number(d.atenciones))??[],       colors:c[1] },
                { title:'Por Grupo de Edad',labels:charts?.edad?.map(d=>d.grupo_edad)??[],                           values:charts?.edad?.map(d=>Number(d.atenciones))??[],              colors:c[2] },
              ].map(p => (
                <div key={p.title} style={{ height:H_BOT }}>
                  <ChartPanel type="hbar" {...p} dark={dark} loading={loading||!p.labels.length} />
                </div>
              ))}
            </div>

            {/* Fila 3: Plan de seguro (ancho completo) */}
            <div style={{ padding:'0 12px 12px' }}>
              <div style={{ height:240 }}>
                <ChartPanel type="donut" title="Por Plan de Seguro"
                  labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]}
                  values={charts?.plan?.map(d=>Number(d.atenciones))??[]}
                  colors={c} dark={dark} loading={loading||!charts?.plan?.length} />
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {/* Onboarding primera visita */}
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}

      <Sidebar active={module} onModule={setModule} collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)} airflowUrl={null} />

      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Navbar dark={dark} onToggleTheme={()=>setDark(d=>!d)} status={status} />
        <MvBanner ready={mvStatus.ready} total={mvStatus.total} />
        <KPIStrip data={kpis} rawData={charts} />
        {moduleContent()}
      </div>

      <style>{`
        @media (max-width:860px){ .main-row{ flex-direction:column!important; height:auto!important; } .main-row>div:first-child{ flex:none!important; height:340px; } }
        @keyframes spin{ to{ transform:rotate(360deg); } }

        /* ── Print / PDF ──────────────────────────────────────────────────────── */
        @media print {
          @page { size:A4 landscape; margin:1.2cm; }
          aside, .no-print, nav { display:none !important; }
          body, html { height:auto !important; overflow:visible !important; }
          .main-row { height:420px !important; }
          /* Gráficos usan 100% del ancho disponible */
          .main-row > div:first-child { flex: 0 0 52% !important; }
          * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          /* Forzar colores de fondo en PDF */
          body { background:#fff !important; color:#000 !important; }
          [style*="var(--surface)"] { background:#fff !important; }
          [style*="var(--bg)"] { background:#f5f5f5 !important; }
        }
      `}</style>
    </div>
  )
}
