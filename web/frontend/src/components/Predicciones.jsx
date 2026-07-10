import React, { useState, useEffect, useRef } from 'react'
import ApexCharts from 'apexcharts'
import { fmt, fmtFull } from '../lib/format.js'
import { CL, GRID, TICK, BELOW_AVG } from '../lib/chartColors.js'
import { TrendingUp, TrendingDown, Info, BarChart2, Calendar, MapPin } from 'lucide-react'

const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Tooltip simple ─────────────────────────────────────────────────────────────
function InfoTip({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', marginLeft: 5 }}>
      <Info
        size={12}
        style={{ cursor: 'pointer', color: 'var(--muted)' }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      />
      {open && (
        <div style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: 'var(--surface)',
          fontSize: 11, lineHeight: 1.6, padding: '8px 10px',
          borderRadius: 4, width: 240, zIndex: 999,
          boxShadow: '0 4px 16px rgba(0,0,0,.25)', pointerEvents: 'none',
        }}>
          {text}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '5px 5px 0', borderStyle: 'solid', borderColor: 'var(--text) transparent transparent' }} />
        </div>
      )}
    </span>
  )
}

// ── Tarjeta de métrica ────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent, tip }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 16px', borderLeft: '3px solid var(--navy)' }}>
      <div style={{ fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center' }}>
        {label}{tip && <InfoTip text={tip} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: accent ? 'var(--accent)' : 'var(--navy)', marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Chart de forecast anual ───────────────────────────────────────────────────
function ForecastChart({ historico, prediccion, dark }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || !historico?.length) return
    const grid  = dark ? GRID.dark : GRID.light
    const tick  = dark ? TICK.dark : TICK.light

    const allData = [...historico, ...prediccion]
    const cats = allData.map(d => d.anio)

    const series = [
      {
        name: 'Atenciones reales',
        type: 'line',
        data: historico.map(d => ({ x: d.anio, y: d.atenciones })),
      },
      {
        name: 'Tendencia lineal',
        type: 'line',
        data: historico.map(d => ({ x: d.anio, y: d.tendencia })),
      },
      {
        name: 'Proyección 2026–2028',
        type: 'line',
        data: prediccion.map(d => ({ x: d.anio, y: d.atenciones })),
      },
    ]

    const opts = {
      chart: {
        type: 'line', height: '100%',
        toolbar: { show: false }, background: 'transparent',
        animations: { speed: 400 },
        fontFamily: "'Signika', sans-serif",
      },
      theme: { mode: dark ? 'dark' : 'light' },
      series,
      xaxis: {
        categories: cats,
        labels: { style: { colors: tick, fontSize: '11px' } },
        axisBorder: { show: false }, axisTicks: { show: false },
      },
      yaxis: {
        labels: { style: { colors: tick, fontSize: '10px' }, formatter: v => fmt(v) },
      },
      colors: [CL[0], CL[2], CL[4]],
      stroke: {
        curve: 'smooth',
        width: [3, 1.5, 3],
        dashArray: [0, 4, 0],
      },
      markers: { size: [4, 0, 5], strokeWidth: 0 },
      tooltip: {
        shared: true,
        theme: dark ? 'dark' : 'light',
        x: { formatter: v => `Año ${v}` },
        y: { formatter: v => v != null ? fmtFull(v) + ' atenciones' : '—' },
      },
      legend: {
        show: true, position: 'top', horizontalAlign: 'left',
        fontSize: '11px', fontFamily: "'Signika', sans-serif",
        labels: { colors: tick },
        markers: { width: 10, height: 10 },
      },
      grid: { borderColor: grid, strokeDashArray: 3 },
      annotations: {
        xaxis: [{
          x: Math.max(...historico.map(d => d.anio)),
          borderColor: 'var(--muted)',
          strokeDashArray: 4,
          label: {
            text: 'Inicio proyección',
            style: { color: 'var(--muted)', background: 'var(--surface)', fontSize: '10px' },
          },
        }],
      },
    }

    if (chartRef.current) {
      chartRef.current.updateOptions(opts, true)
    } else {
      chartRef.current = new ApexCharts(ref.current, opts)
      chartRef.current.render()
    }
    return () => undefined
  }, [historico, prediccion, dark])

  useEffect(() => () => chartRef.current?.destroy(), [])
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Chart estacionalidad ──────────────────────────────────────────────────────
function SeasonalChart({ data, dark }) {
  const ref = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || !data?.length) return
    const tick = dark ? TICK.dark : TICK.light
    const opts = {
      chart: { type: 'bar', height: '100%', toolbar: { show: false }, background: 'transparent', fontFamily: "'Signika',sans-serif" },
      theme: { mode: dark ? 'dark' : 'light' },
      series: [{ name: 'Índice estacional', data: data.map(d => d.indice) }],
      xaxis: { categories: data.map(d => d.nombre), labels: { style: { colors: tick, fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { colors: tick, fontSize: '10px' }, formatter: v => v + '%' } },
      colors: data.map(d => d.indice >= 100 ? CL[0] : BELOW_AVG),
      plotOptions: { bar: { borderRadius: 3, columnWidth: '60%', distributed: true } },
      dataLabels: { enabled: true, formatter: v => v + '%', style: { fontSize: '10px', fontWeight: 600 } },
      tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: v => v + '% vs. promedio' } },
      legend: { show: false },
      grid: { borderColor: dark ? GRID.dark : GRID.light, strokeDashArray: 3, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
      annotations: { yaxis: [{ y: 100, borderColor: 'var(--accent)', strokeDashArray: 4, label: { text: 'Promedio', style: { color: 'var(--accent)', fontSize: '10px', background: 'transparent' } } }] },
    }
    if (chartRef.current) { chartRef.current.updateOptions(opts, true) }
    else { chartRef.current = new ApexCharts(ref.current, opts); chartRef.current.render() }
  }, [data, dark])

  useEffect(() => () => chartRef.current?.destroy(), [])
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Predicciones({ dark }) {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetch('/api/predicciones')
      .then(r => r.json())
      .then(d => { setData(d); setLoad(false) })
      .catch(() => { setError('Error al cargar predicciones'); setLoad(false) })
  }, [])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--navy)', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
        Calculando modelos predictivos…
      </div>
    </div>
  )

  if (error || data?.error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
      {error || data.error}
    </div>
  )

  const { forecast_anual, estacionalidad, regiones_proyeccion } = data
  const fa = forecast_anual
  const creciente = fa.tendencia === 'creciente'
  const nextYear = fa.prediccion?.[0]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: 6, padding: '12px 12px 16px' }}>

      {/* ── Aviso de modelo ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Modelo: <strong>Regresión Lineal OLS</strong> sobre datos anuales {Math.min(...fa.historico.map(d => d.anio))}–{Math.max(...fa.historico.map(d => d.anio))}.
          Las proyecciones asumen continuidad de la tendencia histórica y no incorporan cambios de política sanitaria ni eventos externos.
          IC 90%: ±1.645σ de los residuos históricos.
        </span>
      </div>

      {/* ── KPIs del modelo ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
        <MetricCard label="R² del modelo" value={fa.r2}
          tip="R² (coeficiente de determinación): porción de la varianza histórica explicada por el modelo. 1.0 = ajuste perfecto."
          sub="Bondad de ajuste" />
        <MetricCard label="RMSE" value={fmt(fa.rmse)}
          tip="Root Mean Square Error: error cuadrático medio del modelo sobre datos históricos. Menor es mejor."
          sub="Error medio histórico" />
        <MetricCard label={`Proyección ${nextYear?.anio ?? '2026'}`} value={fmt(nextYear?.atenciones)} accent
          tip={`Valor puntual proyectado. Intervalo de confianza 90%: ${fmt(nextYear?.lower)} – ${fmt(nextYear?.upper)}`}
          sub={`IC 90%: ${fmt(nextYear?.lower)} – ${fmt(nextYear?.upper)}`} />
        <MetricCard label="Tendencia anual" value={`${creciente ? '+' : ''}${fmt(fa.pendiente_anual)}`}
          tip="Incremento absoluto de atenciones proyectado por año según la pendiente de la regresión lineal."
          sub={creciente ? '↑ Creciente' : '↓ Decreciente'} />
      </div>

      {/* ── Interpretación ──────────────────────────────────────────────── */}
      <div style={{ background: creciente ? 'rgba(175,204,70,.1)' : 'rgba(220,56,141,.08)', border: `1px solid ${creciente ? 'var(--green)' : 'var(--accent)'}`, padding: '10px 14px', fontSize: 12, color: 'var(--text)', display: 'flex', gap: 10, alignItems: 'flex-start', borderRadius: 2 }}>
        {creciente ? <TrendingUp size={16} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} /> : <TrendingDown size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />}
        <span>{fa.interpretacion}</span>
      </div>

      {/* ── Forecast chart ──────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--navy)', fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart2 size={12} /> Forecast de Atenciones 2026–2028
        </div>
        <div style={{ height: 280, padding: 8 }}>
          <ForecastChart historico={fa.historico} prediccion={fa.prediccion} dark={dark} />
        </div>
      </div>

      {/* ── Estacionalidad + Regiones ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>

        {/* Estacionalidad mensual */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--navy)', fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} /> Índice de Estacionalidad Mensual
            <InfoTip text="Índice 100 = promedio histórico del mes. >100 = mes con mayor demanda que el promedio. Calculado sobre todos los años disponibles." />
          </div>
          <div style={{ height: 220, padding: 8 }}>
            {estacionalidad?.length
              ? <SeasonalChart data={estacionalidad} dark={dark} />
              : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12 }}>Datos mensuales no disponibles aún</div>
            }
          </div>
        </div>

        {/* Proyección regional */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', borderLeft: '3px solid var(--navy)', fontSize: 10, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} /> Proyección 2026 por Región (Top 10)
            <InfoTip text="Proyección basada en CAGR (tasa de crecimiento anual compuesta) del modelo global aplicada a cada región. No captura tendencias regionales individuales." />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {regiones_proyeccion?.map((r, i) => (
              <div key={r.region} style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: i < regiones_proyeccion.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', width: 18, flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.region}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{fmt(r.atenciones)} actuales → <strong style={{ color: 'var(--navy)' }}>{fmt(r.proyeccion_2026)}</strong></div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.share_pct}%</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: r.crecimiento_pct >= 0 ? 'var(--green)' : 'var(--accent)' }}>
                    {r.crecimiento_pct >= 0 ? '+' : ''}{r.crecimiento_pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
