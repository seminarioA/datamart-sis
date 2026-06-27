import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { fmt, fmtFull, norm } from '../lib/format.js'

const MAP_STOPS_LIGHT = ['#dce3f6','#a8b5e8','#7a8ed0','#5b6fb3','#2a3a7c']
const MAP_STOPS_DARK  = ['#151d3a','#1e2d5c','#2a3e7a','#3a52a0','#5b6fb3']
const TILE = {
  light: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
}

function mapColor(v, max, dark) {
  const stops = dark ? MAP_STOPS_DARK : MAP_STOPS_LIGHT
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
  return (
    <div style={{ position:'absolute', top:10, left:10, zIndex:800, background:'var(--surface)', border:'1px solid var(--border)', minWidth:180, boxShadow:'0 4px 16px rgba(0,0,0,.12)', borderRadius:4 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px 4px', borderBottom:'1px solid var(--border)', borderLeft:'3px solid var(--navy)' }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', color:'var(--text)' }}>{info.name}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:14 }}>×</button>
      </div>
      <div style={{ padding:'6px 8px', display:'grid', gap:4 }}>
        {[['Atenciones',fmtFull(info.atenciones)],['% del total',(info.pct*100).toFixed(1)+' %'],['IPRESS',info.ipress?fmtFull(info.ipress):'—']].map(([l,v])=>(
          <div key={l} style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
            <span style={{ fontSize:10, color:'var(--muted)' }}>{l}</span>
            <span style={{ fontSize:11, fontWeight:600, color:'var(--text)' }}>{v}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
          <span style={{ fontSize:10, color:'var(--muted)' }}>Ranking</span>
          <span style={{ background:'var(--navy)', color:'#fff', fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:3 }}>#{info.rank}</span>
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
  const [selected, setSelected] = useState(null)

  // Init map once — invalidateSize after 300ms so DOM has settled
  useEffect(() => {
    if (leafletRef.current || !mapRef.current) return
    leafletRef.current = L.map(mapRef.current, { zoomControl:true, scrollWheelZoom:false })
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
    fetch('/static/peru.geojson').then(r=>r.json()).then(setGeojson).catch(console.error)
  }, [])

  useEffect(() => {
    if (!leafletRef.current) return
    if (tileRef.current) leafletRef.current.removeLayer(tileRef.current)
    tileRef.current = L.tileLayer(dark ? TILE.dark : TILE.light, { attribution:'&copy; OSM, CARTO' }).addTo(leafletRef.current)
  }, [dark])

  useEffect(() => {
    if (!leafletRef.current || !geojson || !regionData?.length) return
    const { lookup, detail } = buildLookup(regionData)
    const max = Math.max(...Object.values(lookup).map(Number).filter(Boolean))
    if (geoLayerRef.current) leafletRef.current.removeLayer(geoLayerRef.current)
    if (legendRef.current) legendRef.current.remove()
    selectedRef.current = null; setSelected(null)

    geoLayerRef.current = L.geoJSON(geojson, {
      style: feat => {
        const key = norm(feat.properties.name||'')
        return { fillColor: mapColor(lookup[key]||0, max, dark), weight:.8, color:'#777', fillOpacity:.85 }
      },
      onEachFeature: (feat, layer) => {
        const key = norm(feat.properties.name||'')
        const name = feat.properties.name||key
        const v = lookup[key]||0
        layer.bindTooltip(`<strong style="font-size:12px">${name}</strong><br>${fmtFull(v)} atenciones`, { sticky:true, offset:[8,0] })
        layer.on('mouseover', e => { if (e.target!==selectedRef.current) e.target.setStyle({ weight:2, color:'#333', fillOpacity:.95 }) })
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
      el.style.cssText='background:var(--surface);border:1px solid var(--border);padding:6px 8px;font-size:10px;line-height:1.9;color:var(--text);font-family:Signika,sans-serif'
      const stops = dark ? MAP_STOPS_DARK : MAP_STOPS_LIGHT
      el.innerHTML = '<div style="font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:3px">Atenciones</div>'+
        ['0–20 %','20–40 %','40–60 %','60–80 %','80–100 %'].map((l,i)=>
          `<div style="display:flex;align-items:center;gap:5px"><div style="width:13px;height:13px;background:${stops[i]};border:1px solid #aaa;flex-shrink:0"></div>${l}</div>`
        ).join('')
      return el
    }
    legend.addTo(leafletRef.current); legendRef.current=legend
  }, [geojson, regionData, dark])

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', minHeight:0, flex:1 }}>
      <div style={{ padding:'8px 12px', fontSize:10, fontWeight:700, fontFamily:"'Montserrat',sans-serif", textTransform:'uppercase', letterSpacing:'.07em', color:'var(--navy)', borderBottom:'1px solid var(--border)', borderLeft:'3px solid var(--navy)', flexShrink:0 }}>
        Atenciones por Departamento
      </div>
      <div style={{ flex:1, position:'relative', minHeight:0 }}>
        <div ref={mapRef} style={{ position:'absolute', inset:0 }} />
        <RegionCard info={selected} onClose={()=>setSelected(null)} />
      </div>
    </div>
  )
}
