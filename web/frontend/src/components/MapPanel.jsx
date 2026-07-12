import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Maximize2, Minimize2, Layers } from 'lucide-react'
import { fmt, fmtFull, norm } from '../lib/format.js'
import { resolveMapStops } from '../lib/chartColors.js'
import { cn } from '@/lib/utils'

const TILE = {
  light:     'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  sat_labels:'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
}
const TILE_ATTR = {
  default:   '&copy; OSM, CARTO',
  satellite: '&copy; Esri, Maxar, USGS',
}

function mapColor(v, max, stops) {
  if (!max || !v) return stops[0]
  const t = v / max
  const i = t > .8 ? 4 : t > .6 ? 3 : t > .4 ? 2 : t > .2 ? 1 : 0
  return stops[i]
}

function buildLookup(regionRows) {
  const lookup = {}, detail = {}
  const total = regionRows.reduce((s, d) => s + Number(d.atenciones), 0)
  const sorted = [...regionRows].sort((a, b) => Number(b.atenciones) - Number(a.atenciones))
  sorted.forEach((d, idx) => {
    let key = norm(d.region)
    const label = d.region
    if (key === 'LIMA METROPOLITANA') key = 'LIMA'
    else if (key === 'LIMA REGION') key = 'LIMA PROVINCE'
    if (key === 'SIN ESPECIFICAR' || !key) return
    const at = Number(d.atenciones)
    lookup[key] = (lookup[key] || 0) + at
    if (!detail[key]) detail[key] = { label, atenciones: at, ipress: Number(d.ipress||0), rank: idx+1, pct: at/total }
    else { detail[key].atenciones += at; detail[key].ipress += Number(d.ipress||0); detail[key].pct += at/total }
  })
  return { lookup, detail }
}

function RegionCard({ info, onClose }) {
  if (!info) return null
  const rows = [
    ['Atenciones', fmtFull(info.atenciones)],
    ['% del total', (info.pct * 100).toFixed(1) + ' %'],
    ['IPRESS',      info.ipress ? fmtFull(info.ipress) : '—'],
  ]
  return (
    <div className="island overflow-hidden" style={{
      position: 'absolute', top: 12, left: 12, zIndex: 800, minWidth: 190,
    }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60 bg-muted/40">
        <span className="text-[11px] font-bold uppercase tracking-[.04em] text-foreground">
          {info.name}
        </span>
        <button onClick={onClose} aria-label="Cerrar"
          className="text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer text-base leading-none px-0.5">
          ×
        </button>
      </div>
      <div className="px-2.5 py-2 grid gap-1.5">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between items-center gap-3">
            <span className="text-[10px] text-muted-foreground">{l}</span>
            <span className="text-[11px] font-semibold text-foreground">{v}</span>
          </div>
        ))}
        <div className="flex justify-between items-center gap-3">
          <span className="text-[10px] text-muted-foreground">Ranking</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: 'var(--navy)', color: 'hsl(var(--primary-foreground))' }}>
            #{info.rank}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function MapPanel({ regionData, dark }) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const leafletRef    = useRef(null)
  const tileRef       = useRef(null)
  const satLabelRef   = useRef(null)
  const geoLayerRef   = useRef(null)
  const legendRef     = useRef(null)
  const selectedRef   = useRef(null)
  const [geojson, setGeojson]       = useState(null)
  const [selected, setSelected]     = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [tileMode, setTileMode]     = useState('auto')

  useEffect(() => {
    const handler = () => {
      setFullscreen(!!document.fullscreenElement)
      setTimeout(() => leafletRef.current?.invalidateSize(), 150)
    }
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  useEffect(() => {
    if (leafletRef.current || !mapRef.current) return
    leafletRef.current = L.map(mapRef.current, { zoomControl:false, scrollWheelZoom:false })
    L.control.zoom({ position:'bottomleft' }).addTo(leafletRef.current)
    leafletRef.current.setView([-9.2, -75.0], 5)
    setTimeout(() => leafletRef.current?.invalidateSize(), 300)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => leafletRef.current?.invalidateSize(), 100)
    return () => clearTimeout(t)
  })

  useEffect(() => {
    fetch('/static/peru.geojson').then(r=>r.json()).then(setGeojson).catch(console.error)
  }, [])

  useEffect(() => {
    if (!leafletRef.current) return
    const isSat = tileMode === 'satellite'
    const url = isSat ? TILE.satellite : (dark ? TILE.dark : TILE.light)
    if (tileRef.current) leafletRef.current.removeLayer(tileRef.current)
    if (satLabelRef.current) { leafletRef.current.removeLayer(satLabelRef.current); satLabelRef.current = null }
    tileRef.current = L.tileLayer(url, { attribution: isSat ? TILE_ATTR.satellite : TILE_ATTR.default }).addTo(leafletRef.current)
    if (isSat) {
      satLabelRef.current = L.tileLayer(TILE.sat_labels, { attribution: '' }).addTo(leafletRef.current)
    }
  }, [dark, tileMode])

  useEffect(() => {
    if (!leafletRef.current || !geojson || !regionData?.length) return
    const { lookup, detail } = buildLookup(regionData)
    const max = Math.max(...Object.values(lookup).map(Number).filter(Boolean))
    // Lee stops del CSS vars para el tema activo (después de que .dark se aplica)
    const stops = resolveMapStops()
    if (geoLayerRef.current) leafletRef.current.removeLayer(geoLayerRef.current)
    if (legendRef.current) legendRef.current.remove()
    selectedRef.current = null; setSelected(null)

    geoLayerRef.current = L.geoJSON(geojson, {
      style: feat => {
        const key = norm(feat.properties.name||'')
        return { fillColor: mapColor(lookup[key]||0, max, stops), weight:.8, color: 'var(--border-c)', fillOpacity:.85 }
      },
      onEachFeature: (feat, layer) => {
        const key = norm(feat.properties.name||'')
        const name = feat.properties.name||key
        const v = lookup[key]||0
        layer.bindTooltip(`<strong style="font-size:12px">${name}</strong><br>${fmtFull(v)} atenciones`, { sticky:true, offset:[8,0] })
        layer.on('mouseover', e => { if (e.target!==selectedRef.current) e.target.setStyle({ weight:2, color:'var(--muted-c)', fillOpacity:.95 }) })
        layer.on('mouseout',  e => { if (e.target!==selectedRef.current) geoLayerRef.current.resetStyle(e.target) })
        layer.on('click', e => {
          L.DomEvent.stopPropagation(e)
          if (selectedRef.current && selectedRef.current!==e.target) geoLayerRef.current.resetStyle(selectedRef.current)
          selectedRef.current = e.target
          e.target.setStyle({ weight:2.5, color:'var(--navy)', fillOpacity:.95 })
          setSelected(detail[key] ? { name, ...detail[key] } : null)
        })
      }
    }).addTo(leafletRef.current)

    leafletRef.current.on('click', () => {
      if (selectedRef.current) { geoLayerRef.current?.resetStyle(selectedRef.current); selectedRef.current=null }
      setSelected(null)
    })

    const legend = L.control({ position:'bottomright' })
    legend.onAdd = () => {
      const el = L.DomUtil.create('div')
      el.style.cssText = [
        'background:var(--surface)',
        'border:1px solid var(--border-c)',
        'border-radius:8px',
        'padding:7px 10px',
        'font-size:10px',
        'line-height:2',
        'color:var(--text)',
        'font-family:Signika,sans-serif',
        'box-shadow:0 2px 10px rgba(0,0,0,.08)',
      ].join(';')
      el.innerHTML = '<div style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted-c);margin-bottom:3px">Atenciones</div>'+
        ['0–20 %','20–40 %','40–60 %','60–80 %','80–100 %'].map((l,i)=>
          `<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;background:${stops[i]};border:1px solid var(--border-c);flex-shrink:0;border-radius:2px"></div>${l}</div>`
        ).join('')
      return el
    }
    legend.addTo(leafletRef.current); legendRef.current=legend
  }, [geojson, regionData, dark])

  return (
    <div ref={containerRef} className="chart-panel-wrap">
      <div className="flex items-center px-3 py-2.5 shrink-0 border-b border-border/60">
        <span className="font-heading text-[10px] font-bold uppercase tracking-[.07em] text-primary">
          Atenciones por Departamento
        </span>
        <div className="flex-1" />
        {/* Toggle satélite / normal */}
        <button
          onClick={() => setTileMode(m => m === 'satellite' ? 'auto' : 'satellite')}
          title={tileMode === 'satellite' ? 'Vista normal' : 'Vista satélite'}
          className={cn(
            'p-1 rounded-md transition-colors mr-0.5',
            tileMode === 'satellite'
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <Layers size={13} />
        </button>
        <button
          onClick={toggleFullscreen}
          title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>
      {/* El mapa Leaflet necesita position:relative + flex:1 para llenarse correctamente */}
      <div className="flex-1 relative min-h-0">
        <div ref={mapRef} className="absolute inset-0" />
        <RegionCard info={selected} onClose={()=>setSelected(null)} />
      </div>
    </div>
  )
}
