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
import Acciones    from './components/Acciones.jsx'
import Onboarding   from './components/Onboarding.jsx'
import { fmt, fmtFull, trunc } from './lib/format.js'
import { SlidersHorizontal, X } from 'lucide-react'

const CL = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const CD = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']
const H_BOT = 320

export default function App() {
  const [dark, setDark]            = useState(() => localStorage.getItem('theme')==='dark')
  const [collapsed, setCollapsed]  = useState(false)
  const [module, setModule]        = useState('overview')
  const [moduleKey, setModuleKey]  = useState(0)  // triggers re-animation on switch
  const [kpis, setKpis]            = useState(null)
  const [charts, setCharts]        = useState(null)
  const [mvStatus, setMvStatus]    = useState({ ready:0, total:8 })
  const [status, setStatus]        = useState('Cargando…')
  const [showOnboarding, setOnboarding] = useState(() => !localStorage.getItem('visited_v1'))
  // Chart expansion (Progressive Disclosure — UCD Ch.7)
  const [expandedChart, setExpandedChart] = useState(null)
  // Filters (Hick's Law: keep choices simple)
  const [showFilters, setShowFilters] = useState(false)
  const [filterTopN, setFilterTopN]   = useState(12)  // número de items en rankings
  const [filterYears, setFilterYears] = useState([])  // [] = todos

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark?'dark':'light')
  }, [dark])

  const closeOnboarding = () => { localStorage.setItem('visited_v1','1'); setOnboarding(false) }

  const [pdfLoading, setPdfLoading] = useState(false)

  // PDF server-side via ReportLab+matplotlib — gráficos reales sin problemas de canvas
  const handlePrint = async () => {
    setPdfLoading(true)
    try {
      const resp = await fetch('/api/pdf')
      if (!resp.ok) throw new Error(`Error ${resp.status}`)
      const blob = await resp.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `DataMart_SIS_${new Date().toISOString().slice(0,10)}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch(e) {
      alert('Error generando PDF: ' + e.message)
    } finally {
      setPdfLoading(false)
    }
  }

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

  // Helper: apply year filter client-side (filtra si hay años seleccionados)
  const applyYearFilter = (data, yearKey='anio') =>
    filterYears.length === 0 ? data : (data||[]).filter(d => filterYears.includes(String(d[yearKey])))

  // Expand helper — Progressive Disclosure (show full detail on demand)
  const expand = (title, type, labels, values, colors) =>
    setExpandedChart({ title, type, labels, values, colors })

  // Filter bar — Hick's Law: pocas opciones, simples (UCD Ch.7 Hick's Law)
  const availableYears = [...new Set((charts?.anio||[]).map(d=>String(d.anio)))].sort()
  const FilterBar = () => !showFilters ? null : (
    <div style={{ background:'var(--surface)', borderBottom:'2px solid var(--navy)', padding:'10px 14px', display:'flex', alignItems:'center', flexWrap:'wrap', gap:12 }} className="no-print filter-bar-anim">
      {/* Top N filter */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, whiteSpace:'nowrap' }}>Top N rankings:</span>
        {[5, 10, 12, 26].map(n => (
          <button key={n} onClick={()=>setFilterTopN(n)}
            style={{ padding:'3px 10px', border:'1px solid', borderRadius:3, cursor:'pointer', fontSize:11, fontWeight:600,
              background: filterTopN===n ? 'var(--navy)' : 'transparent',
              borderColor: filterTopN===n ? 'var(--navy)' : 'var(--border)',
              color: filterTopN===n ? '#fff' : 'var(--text)',
            }}>
            {n===26?'Todos':n}
          </button>
        ))}
      </div>
      {/* Year filter (only if multiple years available) */}
      {availableYears.length > 1 && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:600, whiteSpace:'nowrap' }}>Años:</span>
          {availableYears.map(yr => (
            <button key={yr}
              onClick={() => setFilterYears(p => p.includes(yr) ? p.filter(y=>y!==yr) : [...p, yr])}
              style={{ padding:'3px 10px', border:'1px solid', borderRadius:3, cursor:'pointer', fontSize:11, fontWeight:600,
                background: filterYears.includes(yr) ? 'var(--navy)' : 'transparent',
                borderColor: filterYears.includes(yr) ? 'var(--navy)' : 'var(--border)',
                color: filterYears.includes(yr) ? '#fff' : 'var(--text)',
              }}>
              {yr}
            </button>
          ))}
          {filterYears.length > 0 && (
            <button onClick={()=>setFilterYears([])} style={{ padding:'3px 8px', border:'1px solid var(--accent)', borderRadius:3, cursor:'pointer', fontSize:10, color:'var(--accent)', background:'transparent', display:'flex', alignItems:'center', gap:3 }}>
              <X size={10}/> Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  )

  const moduleContent = () => {
    switch (module) {
      case 'acerca':       return <Acerca dark={dark} />
      case 'glosario':     return <Glosario />
      case 'acciones':     return <Acciones dark={dark} />
      case 'predicciones': return <Predicciones dark={dark} />

      case 'map':
        return (
          <div style={{ flex:1, padding:'12px', overflow:'hidden' }}>
            <div style={{ height:'calc(100vh - 175px)', display:'flex', flexDirection:'column' }}>
              <MapPanel regionData={charts?.region} dark={dark} />
            </div>
          </div>
        )

      case 'demographics':
        return (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <FilterBar />
            <div style={{ flex:1, padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
              <div style={{ height:340 }}>
                <ChartPanel type="donut" title="Atenciones por Sexo"
                  labels={charts?.sexo?.map(d=>d.sexo)??[]} values={charts?.sexo?.map(d=>Number(d.atenciones))??[]}
                  colors={[c[0],c[4]]} dark={dark} loading={loading||!charts?.sexo?.length}
                  onExpand={()=>expand('Atenciones por Sexo','donut',charts?.sexo?.map(d=>d.sexo),charts?.sexo?.map(d=>Number(d.atenciones)),[c[0],c[4]])} />
              </div>
              <div style={{ height:340 }}>
                <ChartPanel type="hbar" title="Por Grupo de Edad"
                  labels={charts?.edad?.map(d=>d.grupo_edad)??[]} values={charts?.edad?.map(d=>Number(d.atenciones))??[]}
                  colors={c[2]} dark={dark} loading={loading||!charts?.edad?.length}
                  onExpand={()=>expand('Por Grupo de Edad','hbar',charts?.edad?.map(d=>d.grupo_edad),charts?.edad?.map(d=>Number(d.atenciones)),c[2])} />
              </div>
            </div>
          </div>
        )

      case 'geography':
        return (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <FilterBar />
            <div style={{ flex:1, padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
              <div style={{ height:380 }}>
                <ChartPanel type="hbar" title={`Top ${filterTopN} Regiones`}
                  labels={charts?.region?.slice(0,filterTopN).map(d=>d.region)??[]} values={charts?.region?.slice(0,filterTopN).map(d=>Number(d.atenciones))??[]}
                  colors={c[0]} dark={dark} loading={loading||!charts?.region?.length}
                  onExpand={()=>expand(`Top ${filterTopN} Regiones`,'hbar',charts?.region?.slice(0,filterTopN).map(d=>d.region),charts?.region?.slice(0,filterTopN).map(d=>Number(d.atenciones)),c[0])} />
              </div>
              <div style={{ height:380 }}>
                <ChartPanel type="hbar" title="Por Nivel EESS"
                  labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]} values={charts?.nivel?.map(d=>Number(d.atenciones))??[]}
                  colors={[c[0],c[1],c[2],c[4]]} dark={dark} loading={loading||!charts?.nivel?.length}
                  onExpand={()=>expand('Por Nivel EESS','hbar',charts?.nivel?.map(d=>d.nivel||d.nivel_eess),charts?.nivel?.map(d=>Number(d.atenciones)),[c[0],c[1],c[2],c[4]])} />
              </div>
            </div>
          </div>
        )

      case 'services':
        return (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <FilterBar />
            <div style={{ flex:1, padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, overflowY:'auto' }}>
              <div style={{ height:380 }}>
                <ChartPanel type="hbar" title={`Top ${filterTopN} Servicios`}
                  labels={charts?.servicios?.slice(0,filterTopN).map(d=>trunc(d.servicio||d.cod_servicio,30))??[]} values={charts?.servicios?.slice(0,filterTopN).map(d=>Number(d.atenciones))??[]}
                  colors={c[1]} dark={dark} loading={loading||!charts?.servicios?.length}
                  onExpand={()=>expand(`Top ${filterTopN} Servicios`,'hbar',charts?.servicios?.slice(0,filterTopN).map(d=>trunc(d.servicio||d.cod_servicio,40)),charts?.servicios?.slice(0,filterTopN).map(d=>Number(d.atenciones)),c[1])} />
              </div>
              <div style={{ height:380 }}>
                <ChartPanel type="donut" title="Por Plan de Seguro"
                  labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]} values={charts?.plan?.map(d=>Number(d.atenciones))??[]}
                  colors={c} dark={dark} loading={loading||!charts?.plan?.length}
                  onExpand={()=>expand('Por Plan de Seguro','donut',charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro),charts?.plan?.map(d=>Number(d.atenciones)),c)} />
              </div>
            </div>
          </div>
        )

      case 'trends': {
        const anioData = applyYearFilter(charts?.anio)
        return (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <FilterBar />
            <div style={{ flex:1, padding:'12px', overflowY:'auto' }}>
              <div style={{ height:400 }}>
                <ChartPanel type="line" title="Evolución de Atenciones por Año"
                  labels={anioData?.map(d=>String(d.anio))??[]} values={anioData?.map(d=>Number(d.atenciones))??[]}
                  colors={[c[0]]} dark={dark} loading={loading||!charts?.anio?.length}
                  onExpand={()=>expand('Evolución por Año','line',anioData?.map(d=>String(d.anio)),anioData?.map(d=>Number(d.atenciones)),[c[0]])} />
              </div>
            </div>
          </div>
        )
      }

      default: // overview
        return (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflowY:'auto' }}>
            {/* Toolbar: filtros + PDF */}
            <div style={{ padding:'6px 12px 0', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }} className="no-print">
              <button onClick={()=>setShowFilters(v=>!v)}
                style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color: showFilters?'#fff':'var(--navy)', background: showFilters?'var(--navy)':'var(--bg)', border:'1px solid', borderColor: showFilters?'var(--navy)':'var(--border)', borderRadius:4, padding:'5px 12px', cursor:'pointer', fontFamily:"'Signika',sans-serif" }}>
                <SlidersHorizontal size={12}/> Filtros{filterYears.length>0||filterTopN!==12 ? ` (${filterYears.length>0?'Años ':''}${filterTopN!==12?'Top '+filterTopN:''})` : ''}
              </button>
              <button onClick={handlePrint} disabled={pdfLoading}
                style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600, color: pdfLoading?'var(--muted)':'var(--navy)', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'5px 12px', cursor: pdfLoading?'wait':'pointer', fontFamily:"'Signika',sans-serif", opacity: pdfLoading?0.7:1 }}>
                {pdfLoading ? '⏳ Generando PDF (~40s)…' : '⬇ Descargar PDF'}
              </button>
            </div>

            <FilterBar />

            {/* Main row */}
            <div style={{ display:'flex', gap:8, height:480, padding:'6px 12px' }} className="main-row">
              <div style={{ flex:'0 0 56%', minHeight:0, display:'flex', flexDirection:'column' }}>
                <MapPanel regionData={charts?.region} dark={dark} />
                {/* Print-only: tabla de top regiones (reemplaza mapa en PDF) */}
                <div className="print-map-replacement" style={{ display:'none', height:'100%', background:'var(--surface)', border:'1px solid var(--border)' }}>
                  <div style={{ padding:'8px 12px', fontSize:10, fontWeight:700, fontFamily:"'Montserrat',sans-serif", textTransform:'uppercase', letterSpacing:'.07em', color:'var(--navy)', borderBottom:'1px solid var(--border)', borderLeft:'3px solid var(--navy)' }}>Atenciones por Departamento</div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
                    <thead><tr style={{ background:'#f0f2f8' }}><th style={{ padding:'4px 8px', textAlign:'left', fontWeight:700 }}>Región</th><th style={{ padding:'4px 8px', textAlign:'right', fontWeight:700 }}>Atenciones</th><th style={{ padding:'4px 8px', textAlign:'right', fontWeight:700 }}>%</th></tr></thead>
                    <tbody>
                      {(()=>{ const total=(charts?.region||[]).reduce((s,r)=>s+Number(r.atenciones),0); return (charts?.region||[]).slice(0,14).map((r,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid #eee' }}>
                          <td style={{ padding:'3px 8px', color:'#333' }}>{r.region}</td>
                          <td style={{ padding:'3px 8px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{Number(r.atenciones).toLocaleString('es-PE')}</td>
                          <td style={{ padding:'3px 8px', textAlign:'right', color:'#666' }}>{(Number(r.atenciones)/total*100).toFixed(1)}%</td>
                        </tr>
                      ))})()}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6, minHeight:0 }}>
                <div style={{ flex:'0 0 52%', minHeight:0 }}>
                  <ChartPanel type="line" title="Atenciones por Año"
                    labels={applyYearFilter(charts?.anio)?.map(d=>String(d.anio))??[]}
                    values={applyYearFilter(charts?.anio)?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0]]} dark={dark} loading={loading||!charts?.anio?.length}
                    onExpand={()=>expand('Atenciones por Año','line',applyYearFilter(charts?.anio)?.map(d=>String(d.anio)),applyYearFilter(charts?.anio)?.map(d=>Number(d.atenciones)),[c[0]])} />
                </div>
                <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, minHeight:0 }}>
                  <ChartPanel type="donut" title="Por Sexo"
                    labels={charts?.sexo?.map(d=>d.sexo)??[]} values={charts?.sexo?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0],c[4]]} dark={dark} loading={loading||!charts?.sexo?.length}
                    onExpand={()=>expand('Por Sexo','donut',charts?.sexo?.map(d=>d.sexo),charts?.sexo?.map(d=>Number(d.atenciones)),[c[0],c[4]])} />
                  <ChartPanel type="hbar" title="Por Nivel EESS"
                    labels={charts?.nivel?.map(d=>d.nivel||d.nivel_eess)??[]} values={charts?.nivel?.map(d=>Number(d.atenciones))??[]}
                    colors={[c[0],c[1],c[2],c[4]]} dark={dark} loading={loading||!charts?.nivel?.length}
                    onExpand={()=>expand('Por Nivel EESS','hbar',charts?.nivel?.map(d=>d.nivel||d.nivel_eess),charts?.nivel?.map(d=>Number(d.atenciones)),[c[0],c[1],c[2],c[4]])} />
                </div>
              </div>
            </div>

            {/* Bottom 3 charts */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, padding:'0 12px 8px' }}>
              {[
                { title:`Top ${filterTopN} Regiones`,  labels:charts?.region?.slice(0,filterTopN).map(d=>d.region)??[],              values:charts?.region?.slice(0,filterTopN).map(d=>Number(d.atenciones))??[],  colors:c[0] },
                { title:`Top ${filterTopN} Servicios`, labels:charts?.servicios?.slice(0,filterTopN).map(d=>trunc(d.servicio||d.cod_servicio,26))??[], values:charts?.servicios?.slice(0,filterTopN).map(d=>Number(d.atenciones))??[], colors:c[1] },
                { title:'Por Grupo de Edad',           labels:charts?.edad?.map(d=>d.grupo_edad)??[],                                values:charts?.edad?.map(d=>Number(d.atenciones))??[],                          colors:c[2] },
              ].map((p, i) => (
                <div key={p.title} style={{ height:H_BOT, animationDelay:`${i*60}ms` }}>
                  <ChartPanel type="hbar" {...p} dark={dark} loading={loading||!p.labels.length}
                    onExpand={()=>expand(p.title,'hbar',p.labels,p.values,p.colors)} />
                </div>
              ))}
            </div>

            {/* Plan de seguro */}
            <div style={{ padding:'0 12px 12px' }}>
              <div style={{ height:240 }}>
                <ChartPanel type="donut" title="Por Plan de Seguro"
                  labels={charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro)??[]}
                  values={charts?.plan?.map(d=>Number(d.atenciones))??[]}
                  colors={c} dark={dark} loading={loading||!charts?.plan?.length}
                  onExpand={()=>expand('Por Plan de Seguro','donut',charts?.plan?.map(d=>d.desc_plan_seguro||d.cod_plan_seguro),charts?.plan?.map(d=>Number(d.atenciones)),c)} />
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
      {/* Modal de expansión de gráfico (Visual prominence — UCD Ch.7) */}
      {expandedChart && <ChartModal chart={expandedChart} dark={dark} onClose={()=>setExpandedChart(null)} />}

      <Sidebar active={module}
        onModule={m => { setModule(m); setModuleKey(k => k+1) }}
        collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)} airflowUrl={null} />
      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Navbar dark={dark} onToggleTheme={()=>setDark(d=>!d)} status={status} />
        <MvBanner ready={mvStatus.ready} total={mvStatus.total} />
        <KPIStrip data={kpis} rawData={charts} />
        <div key={moduleKey} className="anim-module" style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
          {moduleContent()}
        </div>
      </div>

      {/* Footer de citas (solo en print) */}
      <div className="print-footer-citation" style={{ display:'none' }}>
        <div style={{ display:'flex', justifyContent:'space-between' }}>
          <div><strong>Autores:</strong> Alejandro Seminario Medina · Sigidiego Ortega Vilela · Sergio Mena Delgado<br/><strong>Docente:</strong> Balcazar Chumacero, Oscar Eduardo | <strong>Curso:</strong> Inteligencia de Negocios | Universidad Tecnológica del Perú — 2025–2026</div>
          <div style={{ textAlign:'right' }}><strong>Fuente:</strong> SIS — MINSA · datosabiertos.gob.pe · ODC-By<br/>github.com/seminarioA/datamart-sis</div>
        </div>
      </div>

      <style>{`
        @media (max-width:860px){ .main-row{ flex-direction:column!important; height:auto!important; } .main-row>div:first-child{ flex:none!important; height:340px; } }
        @keyframes spin{ to{ transform:rotate(360deg); } }
        @media print {
          @page { size:A4 landscape; margin:1cm 1.2cm 2.8cm 1.2cm; }
          aside, .no-print, nav, button { display:none !important; }
          body, html { height:auto !important; overflow:visible !important; background:#fff !important; }
          * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
          #root > div { overflow:visible !important; height:auto !important; }

          /* Layout main-row A4 optimizado */
          .main-row { height:320px !important; page-break-inside:avoid; }
          .main-row > div:first-child { flex: 0 0 45% !important; position:relative; }

          /* Mapa: ocultar canvas, mostrar tabla de regiones */
          .leaflet-container { display:none !important; }
          .print-map-img { display:none !important; }
          .print-map-replacement { display:flex !important; flex-direction:column; height:320px !important; overflow:hidden; }

          /* Reducir altura de bottom charts para evitar corte de página */
          div[style*="height: 320px"], div[style*="height:320px"] { height:280px !important; }
          div[style*="height: 240px"], div[style*="height:240px"] { height:200px !important; }

          /* Ocultar spinners en print */
          div[style*="border-radius: 50%"][style*="animation"] { display:none !important; }

          /* Footer de citas */
          .print-footer-citation {
            display:block !important;
            position:fixed; bottom:0; left:0; right:0;
            background:#fff; border-top:2px solid #1a3a5c;
            padding:5px 14px; font-size:8px; color:#333;
            font-family:'Signika',sans-serif; line-height:1.6;
          }
        }
      `}</style>
    </div>
  )
}
