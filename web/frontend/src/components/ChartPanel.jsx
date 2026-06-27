import React, { useRef, useEffect } from 'react'
import ApexCharts from 'apexcharts'
import { fmt, fmtFull, trunc } from '../lib/format.js'

// Formatter compacto para ejes (sin decimales, sin espacio)
const fmtAxis = n => {
  const v = Number(n)
  if (v >= 1e9) return (v/1e9).toFixed(0)+'B'
  if (v >= 1e6) return (v/1e6).toFixed(0)+'M'
  if (v >= 1e3) return (v/1e3).toFixed(0)+'K'
  return String(Math.round(v))
}

const COLORS_LIGHT = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const COLORS_DARK  = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']

function buildOpts(type, labels, values, colors, dark) {
  const grid = dark ? '#252840' : '#d8dced'
  const tick = dark ? '#8890b8' : '#6b7190'
  const colArr = Array.isArray(colors) ? colors : [colors]

  // ── Donut / Pie ─────────────────────────────────────────────────────────────
  if (type === 'donut' || type === 'pie') {
    return {
      chart: { type, height:'100%', toolbar:{ show:false }, background:'transparent', fontFamily:"'Signika', sans-serif", animations:{ speed:350 } },
      theme: { mode: dark?'dark':'light' },
      series: values,
      labels,
      colors: colArr.length >= values.length ? colArr : COLORS_LIGHT,
      dataLabels: { enabled:true, style:{ fontSize:'11px', fontFamily:"'Signika', sans-serif" }, dropShadow:{ enabled:false }, formatter: (val) => val.toFixed(1)+'%' },
      legend: { show:true, position:'bottom', fontSize:'11px', fontFamily:"'Signika', sans-serif", labels:{ colors:tick } },
      tooltip: { theme:dark?'dark':'light', y:{ formatter: v => fmtFull(v)+' atenciones' } },
      plotOptions: { pie: { donut:{ size:'60%' } } },
      stroke: { width:2 },
    }
  }

  // ── Line ────────────────────────────────────────────────────────────────────
  if (type === 'line') {
    return {
      chart: { type:'line', height:'100%', toolbar:{ show:false }, background:'transparent', fontFamily:"'Signika', sans-serif", animations:{ speed:350 } },
      theme: { mode:dark?'dark':'light' },
      series: [{ name:'Atenciones', data:values }],
      colors: colArr,
      xaxis: { categories:labels, labels:{ style:{ colors:tick, fontSize:'11px' } }, axisBorder:{ show:false }, axisTicks:{ show:false } },
      yaxis: { labels:{ style:{ colors:tick, fontSize:'10px' }, formatter:fmtAxis } },
      stroke: { curve:'smooth', width:3 },
      markers: { size:5, strokeWidth:0 },
      dataLabels: { enabled:false },
      tooltip: { theme:dark?'dark':'light', y:{ formatter:v=>fmtFull(v)+' atenciones' } },
      grid: { borderColor:grid, strokeDashArray:3, padding:{ top:4, right:8, bottom:4, left:8 } },
      fill: { type:'gradient', gradient:{ shade: dark?'dark':'light', type:'vertical', shadeIntensity:.3, opacityFrom:.8, opacityTo:.1 } },
    }
  }

  // ── Bar horizontal / vertical ────────────────────────────────────────────────
  const horizontal = type === 'hbar'
  return {
    chart: { type:'bar', height:'100%', toolbar:{ show:false }, background:'transparent', animations:{ speed:350 }, fontFamily:"'Signika', sans-serif" },
    theme: { mode:dark?'dark':'light' },
    series: [{ name:'Atenciones', data:values }],
    colors: colArr,
    plotOptions: {
      bar: { horizontal, distributed: colArr.length>1, barHeight: horizontal?'45%':undefined, columnWidth:!horizontal?'55%':undefined, borderRadius:3, borderRadiusApplication:'end' }
    },
    xaxis: {
      categories: labels,
      labels: {
        style:{ colors:tick, fontSize:'10px' },
        formatter: horizontal ? fmtAxis : undefined,
        rotate: !horizontal && labels.length>6 ? -35 : 0,
        trim: true, hideOverlappingLabels: true,
      },
      axisBorder:{ show:false }, axisTicks:{ show:false },
    },
    yaxis: {
      labels: {
        style:{ colors:tick, fontSize:'10px' },
        formatter: !horizontal ? fmtAxis : undefined,
        maxWidth: horizontal ? 110 : 40,
        trim: true,
      }
    },
    dataLabels: { enabled:false },
    tooltip: { theme:dark?'dark':'light', y:{ formatter:v=>fmtFull(v)+' atenciones' } },
    grid: { borderColor:grid, strokeDashArray:3, xaxis:{ lines:{ show:horizontal } }, yaxis:{ lines:{ show:!horizontal } }, padding:{ top:4, right:8, bottom:4, left:8 } },
    legend: { show:false },
    states: { hover:{ filter:{ type:'lighten', value:.1 } } },
  }
}

export default function ChartPanel({ title, type='hbar', labels, values, colors, dark, loading }) {
  const elRef    = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!elRef.current || !labels?.length || !values?.length) return
    const opts = buildOpts(type, labels, values, colors, dark)
    if (chartRef.current) {
      chartRef.current.updateOptions(opts, true, false)
    } else {
      chartRef.current = new ApexCharts(elRef.current, opts)
      chartRef.current.render()
    }
  }, [type, labels, values, colors, dark])

  useEffect(() => () => { chartRef.current?.destroy() }, [])

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', minHeight:0, height:'100%' }}>
      <div style={{ padding:'8px 12px', fontSize:10, fontWeight:700, fontFamily:"'Montserrat',sans-serif", textTransform:'uppercase', letterSpacing:'.07em', color:'var(--navy)', borderBottom:'1px solid var(--border)', borderLeft:'3px solid var(--navy)', flexShrink:0 }}>
        {title}
      </div>
      <div style={{ flex:1, padding:8, minHeight:0, position:'relative' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
            <div style={{ width:28, height:28, border:'3px solid var(--border)', borderTopColor:'var(--navy)', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
          </div>
        ) : (
          <div ref={elRef} style={{ width:'100%', height:'100%' }} />
        )}
      </div>
    </div>
  )
}
