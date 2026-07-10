import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { fmt, fmtFull, norm } from '../lib/format.js'

const MAP_STOP_VARS = ['--map1', '--map2', '--map3', '--map4', '--map5']

// The --map1..5 custom properties are defined once in index.css (light values
// under :root, dark values under .dark) — read them from the live stylesheet
// instead of re-declaring the same hex palette in JS. Toggling the `dark`
// class on a detached root read is synchronous (no repaint happens between
// the two reads), so this is safe to call once on mount without any visible
// flash regardless of which theme is currently active.
function readMapStops() {
  const root = document.documentElement
  const hadDark = root.classList.contains('dark')
  root.classList.remove('dark')
  const light = MAP_STOP_VARS.map(v => getComputedStyle(root).getPropertyValue(v).trim())
  root.classList.add('dark')
  const dark = MAP_STOP_VARS.map(v => getComputedStyle(root).getPropertyValue(v).trim())
  root.classList.toggle('dark', hadDark)
  return { light, dark }
}

function mapColor(v, max, dark, stops) {
  const arr = dark ? stops.dark : stops.light
  if (!max || !v) return arr[0]
  const t = v / max
  const i = t > .8 ? 4 : t > .6 ? 3 : t > .4 ? 2 : t > .2 ? 1 : 0
  return arr[i]
}
const TILE = {
  light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
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
    ['IPRESS', info.ipress ? fmtFull(info.ipress) : '—'],
  ]
  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 800,
      background: 'var(--surface)',
      border: '1px solid var(--border-c)',
      minWidth: 190,
      boxShadow: '0 4px 20px hsl(var(--primary) / .12), 0 1px 4px hsl(var(--foreground) / .06)',
      borderRadius: 12,
      overflow: 'hidden',
      fontFamily: "'Signika', sans-serif",
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 10px 6px',
        borderBottom: '1px solid var(--border-c)',
        borderLeft: '3px solid var(--navy)',
        background: 'hsl(var(--muted) / .4)',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text)' }}>
          {info.name}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-c)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
      <div style={{ padding: '8px 10px', display: 'grid', gap: 5 }}>
        {rows.map(([l, v]) => (
          <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>{l}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Ranking</span>
          <span style={{
            background: 'var(--navy)', color: 'hsl(var(--primary-foreground))',
            fontSize: 10, fontWeight: 700,
            padding: '2px 7px', borderRadius: 6,
          }}>#{info.rank}</span>
        </div>
      </div>
    </div>
  )
}

export default function MapPanel({ regionData, dark }) {
  const mapRef      = useRef(null)
  const leafletRef  = useRef(null)
  const tileRef     = useRef(null)
  const geoLayerRef = useRef(null)
  const legendRef   = useRef(null)
  const selectedRef = useRef(null)
  const [geojson, setGeojson]   = useState(null)
  const [geojsonError, setGeojsonError] = useState(false)
  const [selected, setSelected] = useState(null)
  const [stops, setStops]       = useState(null)

  // Read the --map1..5 palette from the live stylesheet once on mount, before
  // first paint, so there's no flash of missing/fallback colors.
  useLayoutEffect(() => { setStops(readMapStops()) }, [])

  // Init map once — invalidateSize after 300ms so DOM has settled
  useEffect(() => {
    if (leafletRef.current || !mapRef.current) return
    leafletRef.current = L.map(mapRef.current, { zoomControl:false, scrollWheelZoom:false })
    L.control.zoom({ position:'bottomleft' }).addTo(leafletRef.current)
    leafletRef.current.setView([-9.2, -75.0], 5)
    // Force size recalculation after mount
    setTimeout(() => leafletRef.current?.invalidateSize(), 300)
  }, [])

  // Also invalidate on every render to handle tab switching
  useEffect(() => {
    const t = setTimeout(() => leafletRef.current?.invalidateSize(), 100)
    return () => clearTimeout(t)
  })

  useEffect(() => {
    fetch('/static/peru.geojson').then(r=>r.json()).then(setGeojson).catch(err => {
      console.error('failed to load peru.geojson:', err)
      setGeojsonError(true)
    })
  }, [])

  useEffect(() => {
    if (!leafletRef.current) return
    if (tileRef.current) leafletRef.current.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(dark ? TILE.dark : TILE.light, { attribution:'&copy; OSM, CARTO' }).addTo(leafletRef.current)
  }, [dark])

  useEffect(() => {
    if (!leafletRef.current || !geojson || !regionData?.length || !stops) return
    const { lookup, detail } = buildLookup(regionData)
    const max = Math.max(...Object.values(lookup).map(Number).filter(Boolean))
    if (geoLayerRef.current) leafletRef.current.removeLayer(geoLayerRef.current)
    if (legendRef.current) legendRef.current.remove()
    selectedRef.current = null; setSelected(null)

    geoLayerRef.current = L.geoJSON(geojson, {
      style: feat => {
        const key = norm(feat.properties.name||'')
        return { fillColor: mapColor(lookup[key]||0, max, dark, stops), weight:.8, color:'var(--muted-c)', fillOpacity:.85 }
      },
      onEachFeature: (feat, layer) => {
        const key = norm(feat.properties.name||'')
        const name = feat.properties.name||key
        const v = lookup[key]||0
        layer.bindTooltip(`<strong style="font-size:12px">${name}</strong><br>${fmtFull(v)} atenciones`, { sticky:true, offset:[8,0] })
        layer.on('mouseover', e => { if (e.target!==selectedRef.current) e.target.setStyle({ weight:2, color:'var(--text)', fillOpacity:.95 }) })
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
      el.style.cssText='background:var(--surface);border:1px solid var(--border-c);border-radius:8px;padding:7px 10px;font-size:10px;line-height:2;color:var(--text);font-family:Signika,sans-serif;box-shadow:0 2px 10px hsl(var(--primary)/.08)'
      const legendStops = dark ? stops.dark : stops.light
      el.innerHTML = '<div style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px">Atenciones</div>'+
        ['0–20 %','20–40 %','40–60 %','60–80 %','80–100 %'].map((l,i)=>
          `<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;background:${legendStops[i]};border:1px solid var(--border-c);flex-shrink:0"></div>${l}</div>`
        ).join('')
      return el
    }
    legend.addTo(leafletRef.current); legendRef.current=legend
  }, [geojson, regionData, dark, stops])

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', minHeight:0, flex:1 }}>
      <div style={{ padding:'8px 12px', fontSize:10, fontWeight:700, fontFamily:"'Montserrat',sans-serif", textTransform:'uppercase', letterSpacing:'.07em', color:'var(--navy)', borderBottom:'1px solid var(--border)', borderLeft:'3px solid var(--navy)', flexShrink:0 }}>
        Atenciones por Departamento
      </div>
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <div ref={mapRef} style={{ position:'absolute', inset:0 }} />
        {geojsonError && (
          <div style={{
            position:'absolute', inset:0, zIndex:700, display:'flex',
            alignItems:'center', justifyContent:'center', textAlign:'center',
            background:'var(--surface)', color:'var(--muted-c)', fontSize:12, padding:20,
          }}>
            No se pudo cargar el mapa. Intenta recargar la página.
          </div>
        )}
        <RegionCard info={selected} onClose={()=>setSelected(null)} />
      </div>
    </div>
  )
}
