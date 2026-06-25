import React, { useRef, useEffect } from 'react'
import ApexCharts from 'apexcharts'
import { fmt, fmtFull, trunc } from '../lib/format.js'

const COLORS_LIGHT = ['#5b6fb3','#57c4f2','#afcc46','#f6a64a','#dc388d','#4a5fa0','#7a8ed0','#2a3a7c']
const COLORS_DARK  = ['#8a9fd8','#7ad5f5','#c4df6a','#f9b870','#e85fa0','#a0b2e8','#6a80c4','#5b6fb3']

function buildOpts(labels, values, colors, horizontal, dark) {
  const grid  = dark ? '#252840' : '#d8dced'
  const tick  = dark ? '#8890b8' : '#6b7190'
  const colArr = Array.isArray(colors) ? colors : [colors]

  return {
    chart: {
      type: 'bar', height: '100%',
      toolbar: { show: false },
      background: 'transparent',
      animations: { enabled: true, speed: 350, animateGradually: { enabled: false } },
      fontFamily: "'Signika', -apple-system, sans-serif",
    },
    theme: { mode: dark ? 'dark' : 'light' },
    series: [{ name: 'Atenciones', data: values }],
    colors: colArr,
    plotOptions: {
      bar: {
        horizontal,
        distributed: colArr.length > 1,
        barHeight: horizontal ? '45%' : undefined,
        columnWidth: !horizontal ? '55%' : undefined,
        borderRadius: 3,
        borderRadiusApplication: 'end',
      },
    },
    xaxis: {
      categories: labels,
      labels: {
        style: { colors: tick, fontSize: '11px' },
        formatter: horizontal ? (v => fmt(v)) : undefined,
        rotate: !horizontal && labels.length > 6 ? -35 : 0,
        trim: true,
        hideOverlappingLabels: true,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: tick, fontSize: '11px' },
        formatter: !horizontal ? (v => fmt(v)) : undefined,
        maxWidth: horizontal ? 150 : 40,
      },
    },
    dataLabels: { enabled: false },
    tooltip: {
      theme: dark ? 'dark' : 'light',
      y: { formatter: v => fmtFull(v) + ' atenciones' },
    },
    grid: {
      borderColor: grid, strokeDashArray: 3,
      xaxis: { lines: { show: horizontal } },
      yaxis: { lines: { show: !horizontal } },
      padding: { top: 4, right: 8, bottom: 4, left: 8 },
    },
    legend: { show: false },
    states: {
      hover: { filter: { type: 'lighten', value: 0.1 } },
      active: { filter: { type: 'darken', value: 0.15 } },
    },
  }
}

export default function ChartPanel({ title, labels, values, colors, horizontal = true, dark, loading }) {
  const elRef  = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!elRef.current || !labels || !values) return

    const opts = buildOpts(labels, values, colors, horizontal, dark)

    if (chartRef.current) {
      chartRef.current.updateOptions(opts, true, false)
    } else {
      chartRef.current = new ApexCharts(elRef.current, opts)
      chartRef.current.render()
    }
  }, [labels, values, colors, horizontal, dark])

  // Theme-only update (no data change)
  useEffect(() => {
    if (!chartRef.current || !labels) return
    const dark_ = dark
    const grid  = dark_ ? '#252840' : '#d8dced'
    const tick  = dark_ ? '#8890b8' : '#6b7190'
    chartRef.current.updateOptions({
      theme: { mode: dark_ ? 'dark' : 'light' },
      tooltip: { theme: dark_ ? 'dark' : 'light' },
      grid: { borderColor: grid },
      xaxis: { labels: { style: { colors: tick } } },
      yaxis: { labels: { style: { colors: tick } } },
    }, false, false)
  }, [dark])

  useEffect(() => () => { chartRef.current?.destroy() }, [])

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      minHeight: 0,
    }}>
      <div style={{
        padding: '8px 12px',
        fontSize: 10, fontWeight: 700,
        fontFamily: "'Montserrat', sans-serif",
        textTransform: 'uppercase', letterSpacing: '.07em',
        color: 'var(--navy)',
        borderBottom: '1px solid var(--border)',
        borderLeft: '3px solid var(--navy)',
        flexShrink: 0,
      }}>
        {title}
      </div>

      <div style={{ flex: 1, padding: 10, minHeight: 0, position: 'relative' }}>
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%',
          }}>
            <div style={{
              width: 28, height: 28,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--navy)',
              borderRadius: '50%',
              animation: 'spin .7s linear infinite',
            }} />
          </div>
        ) : (
          <div ref={elRef} style={{ width: '100%', height: '100%' }} />
        )}
      </div>
    </div>
  )
}
