import React, { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar      from './components/Sidebar.jsx'
import Navbar       from './components/Navbar.jsx'
import MvBanner     from './components/MvBanner.jsx'
import KPIStrip     from './components/KPIStrip.jsx'
import ChartPanel   from './components/ChartPanel.jsx'
import MapPanel     from './components/MapPanel.jsx'
import Predicciones from './components/Predicciones.jsx'
import Acerca       from './components/Acerca.jsx'
import { fmt, fmtFull, trunc } from './lib/format.js'

const C_L = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const C_D = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']

// Alturas fijas para paneles
const H_MAIN = 290   // charts en la fila principal
const H_BOT  = 320   // charts en la fila inferior

export default function App() {
  const [dark, setDark]         = useState(() => localStorage.getItem('theme')==='dark')
  const [collapsed, setCollapsed]= useState(false)
  const [module, setModule]     = useState('overview')
  const [kpis, setKpis]         = useState(null)
  const [charts, setCharts]     = useState(null)
  const [mvStatus, setMvStatus] = useState({ ready:0, total:8 })
  const [status, setStatus]     = useState('Cargando…')
  const printRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark':'light')
  }, [dark])

  const fetchKPIs = useCallback(async () => {
    try {
      const d = await fetch('/api/kpis').then(r=>r.json())
      setKpis(d)
      setStatus(`${fmtFull(d.total_registros)} registros · ${new Date().toLocaleTimeString('es-PE')}`)
    } catch { setStatus('Error') }
  }, [])

  const fetchCharts = useCallback(async () => {
    try {
      const d = await fetch('/api/dashboard').then(r=>r.json())
      const { kpis:kd, anio, region, edad, sexo, servicios, nivel, plan } = d
      if (kd?.total_atenciones != null) setKpis(kd)
      setCharts({ anio:anio||[], region:region||[], edad:edad||[], sexo:sexo||[], servicios:servicios||[], nivel:nivel||[], plan:plan||[] })
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

  const c = dark ? C_D : C_L
  const loading = !charts

  // ── PDF Download ─────────────────────────────────────────────────────────────
  const downloadPDF = () => {
    window.print()
  }

  // ── Content por módulo ────────────────────────────────────────────────────────
  const moduleContent = () => {
    switch (module) {
      case 'acerca':
        return <Acerca dark={dark} />

      case 'predicciones':
        return <Predicciones dark={dark} />

      case 'map':
        return (
          <div style={{ flex:1, padding:'12px', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ flex:1, minHeight:400 }}>
              <MapPanel regionData={charts?.region} dark={dark} />
            </div>
          </div>
        )

      case 'demographics':
        return (
          <div style={{ flex:1, padding:'12px 12px 6px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
            <div style={{ height:340 }}>
              <ChartPanel type="donut" title="Por Sexo"
                labels={charts?.sexo?.map(d=>d.sexo)??[]}
                values={charts?.sexo?.map(d=>Number(d.atenciones))??[]}
                colors={[c[0],c[4]]} dark={dark} loading={loading||!charts?.sexo?.length} />
            </div>
            <div style={{ height:340 }}>
              <ChartPanel type="hbar" title="Por Grupo de Edad"
                labels={charts?.edad?.map(d=>d.grupo_edad)??[]}
                values={charts?.edad?.map(d=>Number(d.atenciones))??[]}
                colors={c[2]} dark={dark} loading={loading||!charts?.edad?.length} />
            </div>
          </div>
        )

      case 'geography':
        return (
          <div style={{ flex:1, padding:'12px 12px 6px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
            <div style={{ height:360 }}>
              <ChartPanel type="hbar" title="Top Regiones"
                labels={charts?.region?.slice(0,14).map(d=>d.region)??[]}
                values={charts?.region?.slice(0,14).map(d=>Number(d.atenciones))??[]}
                colors={c[0]} dark={dark} loading={loading||!charts?.region?.length} />
            </div>
            <div style={{ height:360 }}>
              <ChartPanel type="hbar" title="Por Nivel EESS"
                labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]}
                values={charts?.nivel?.map(d=>Number(d.atenciones))??[]}
                colors={[c[0],c[1],c[2],c[4]]} dark={dark} loading={loading||!charts?.nivel?.length} />
            </div>
          </div>
        )

      case 'services':
        return (
          <div style={{ flex:1, padding:'12px 12px 6px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
            <div style={{ height:380 }}>
              <ChartPanel type="hbar" title="Top Servicios"
                labels={charts?.servicios?.map(d=>trunc(d.servicio||d.cod_servicio,30))??[]}
                values={charts?.servicios?.map(d=>Number(d.atenciones))??[]}
                colors={c[1]} dark={dark} loading={loading||!charts?.servicios?.length} />
            </div>
            <div style={{ height:380 }}>
              <ChartPanel type="donut" title="Por Plan de Seguro"
                labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]}
                values={charts?.plan?.map(d=>Number(d.atenciones))??[]}
                colors={c} dark={dark} loading={loading||!charts?.plan?.length} />
            </div>
          </div>
        )

      case 'trends':
        return (
          <div style={{ flex:1, padding:'12px 12px 6px', overflowY:'auto' }}>
            <div style={{ height:380 }}>
              <ChartPanel type="line" title="Atenciones por Año (Tendencia)"
                labels={charts?.anio?.map(d=>String(d.anio))??[]}
                values={charts?.anio?.map(d=>Number(d.atenciones))??[]}
                colors={[c[0]]} dark={dark} loading={loading||!charts?.anio?.length} />
            </div>
          </div>
        )

      default: // overview
        return (
          <div ref={printRef} style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
            {/* PDF Button */}
            <div style={{ padding:'8px 12px 0', display:'flex', justifyContent:'flex-end' }}>
              <button onClick={downloadPDF}
                className="no-print"
                style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color:'var(--navy)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontFamily:"'Signika',sans-serif" }}>
                ⬇ Descargar PDF
              </button>
            </div>

            {/* Main row */}
            <div style={{ display:'flex', gap:8, height:480, padding:'8px 12px 6px' }} className="main-row">
              {/* Mapa */}
              <div style={{ flex:'0 0 56%', display:'flex', flexDirection:'column', minHeight:0 }}>
                <MapPanel regionData={charts?.region} dark={dark} />
              </div>
              {/* Columna derecha */}
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
                {/* Línea de tendencia anual */}
                <div style={{ flex:'0 0 52%', minHeight:0 }}>
                  <ChartPanel type="line" title="Atenciones por Año"
                    labels={charts?.anio?.map(d=>String(d.anio))??[]}
                    values={charts?.anio?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0]]} dark={dark} loading={loading||!charts?.anio?.length} />
                </div>
                {/* Par Sexo + Nivel */}
                <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, minHeight:0 }}>
                  <ChartPanel type="donut" title="Por Sexo"
                    labels={charts?.sexo?.map(d=>d.sexo)??[]}
                    values={charts?.sexo?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0],c[4]]} dark={dark} loading={loading||!charts?.sexo?.length} />
                  <ChartPanel type="hbar" title="Por Nivel EESS"
                    labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]}
                    values={charts?.nivel?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0],c[1],c[2],c[4]]} dark={dark} loading={loading||!charts?.nivel?.length} />
                </div>
              </div>
            </div>

            {/* Fila inferior */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'0 12px 8px' }}>
              <div style={{ height:H_BOT }}>
                <ChartPanel type="hbar" title="Top Regiones"
                  labels={charts?.region?.slice(0,12).map(d=>d.region)??[]}
                  values={charts?.region?.slice(0,12).map(d=>Number(d.atenciones))??[]}
                  colors={c[0]} dark={dark} loading={loading||!charts?.region?.length} />
              </div>
              <div style={{ height:H_BOT }}>
                <ChartPanel type="hbar" title="Top Servicios"
                  labels={charts?.servicios?.map(d=>trunc(d.servicio||d.cod_servicio,28))??[]}
                  values={charts?.servicios?.map(d=>Number(d.atenciones))??[]}
                  colors={c[1]} dark={dark} loading={loading||!charts?.servicios?.length} />
              </div>
              <div style={{ height:H_BOT }}>
                <ChartPanel type="hbar" title="Por Grupo de Edad"
                  labels={charts?.edad?.map(d=>d.grupo_edad)??[]}
                  values={charts?.edad?.map(d=>Number(d.atenciones))??[]}
                  colors={c[2]} dark={dark} loading={loading||!charts?.edad?.length} />
              </div>
            </div>

            {/* Fila plan de seguro */}
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
        @media print{
          .no-print{ display:none!important; }
          aside, nav, .kpi-strip{ display:none!important; }
          body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          @page{ size:A4 landscape; margin:1cm; }
        }
      `}</style>
    </div>
  )
}
