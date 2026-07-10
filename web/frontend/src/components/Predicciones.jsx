import React, { useState, useEffect, useRef } from 'react'
import ApexCharts from 'apexcharts'
import { fmt, fmtFull } from '../lib/format.js'
import { TrendingUp, TrendingDown, Info, BarChart2, Calendar, MapPin } from 'lucide-react'
import { resolveColor, resolveGridTick, resolveChartSeries } from '../lib/chartColors.js'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

function MetricCard({ label, value, sub, accent, tip }) {
  const content = (
    <div className="island p-4">
      <div className="flex items-center gap-1 text-[10px] font-bold font-heading uppercase tracking-wider text-muted-foreground mb-2">
        {label}
        {tip && (
          <button className="text-muted-foreground/60 hover:text-muted-foreground bg-transparent border-0 p-0 cursor-help inline-flex ml-1">
            <Info size={11} />
          </button>
        )}
      </div>
      <div
        className="font-heading font-bold text-[22px] tabular-nums leading-none mb-1"
        style={{ color: accent ? 'hsl(var(--accent))' : 'hsl(var(--primary))' }}
      >
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )

  if (!tip) return content
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">{content}</div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-[11px]">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function PanelHeader({ icon: Icon, title, tip }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/60 shrink-0">
      <Icon size={12} className="text-primary" />
      <span className="font-heading text-[10px] font-bold uppercase tracking-[.07em] text-primary">{title}</span>
      {tip && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="text-muted-foreground/50 hover:text-muted-foreground bg-transparent border-0 p-0 cursor-help inline-flex ml-0.5">
                <Info size={11} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-[11px]">{tip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

function ForecastChart({ historico, prediccion, dark }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || !historico?.length) return
    const { grid, tick } = resolveGridTick()
    const palette = resolveChartSeries()
    const allData = [...historico, ...prediccion]
    const cats    = allData.map(d => d.anio)

    const opts = {
      chart: { type: 'line', height: '100%', toolbar: { show: false }, background: 'transparent', animations: { speed: 400 }, fontFamily: "'Signika', sans-serif" },
      theme: { mode: dark ? 'dark' : 'light' },
      series: [
        { name: 'Atenciones reales',    type: 'line', data: historico.map(d => ({ x: d.anio, y: d.atenciones })) },
        { name: 'Tendencia lineal',     type: 'line', data: historico.map(d => ({ x: d.anio, y: d.tendencia })) },
        { name: 'Proyección 2026–2028', type: 'line', data: prediccion.map(d => ({ x: d.anio, y: d.atenciones })) },
      ],
      xaxis: { categories: cats, labels: { style: { colors: tick, fontSize: '11px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { colors: tick, fontSize: '10px' }, formatter: v => fmt(v) } },
      colors: [palette[0], palette[2], palette[4]],   // navy, green, accent
      stroke: { curve: 'smooth', width: [3, 1.5, 3], dashArray: [0, 4, 0] },
      markers: { size: [4, 0, 5], strokeWidth: 0 },
      tooltip: { shared: true, theme: dark ? 'dark' : 'light', x: { formatter: v => `Año ${v}` }, y: { formatter: v => v != null ? fmtFull(v) + ' atenciones' : '—' } },
      legend: { show: true, position: 'top', horizontalAlign: 'left', fontSize: '11px', fontFamily: "'Signika', sans-serif", labels: { colors: tick }, markers: { width: 10, height: 10 } },
      grid: { borderColor: grid, strokeDashArray: 3 },
      annotations: {
        xaxis: [{
          x: Math.max(...historico.map(d => d.anio)),
          borderColor: tick, strokeDashArray: 4,
          label: { text: 'Inicio proyección', style: { color: tick, background: 'transparent', fontSize: '10px' } },
        }],
      },
    }

    if (chartRef.current) chartRef.current.updateOptions(opts, true)
    else { chartRef.current = new ApexCharts(ref.current, opts); chartRef.current.render() }
  }, [historico, prediccion, dark])

  useEffect(() => () => chartRef.current?.destroy(), [])
  return <div ref={ref} className="w-full h-full" />
}

function SeasonalChart({ data, dark }) {
  const ref      = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current || !data?.length) return
    const { grid, tick } = resolveGridTick()
    const palette = resolveChartSeries()
    const opts = {
      chart: { type: 'bar', height: '100%', toolbar: { show: false }, background: 'transparent', fontFamily: "'Signika',sans-serif" },
      theme: { mode: dark ? 'dark' : 'light' },
      series: [{ name: 'Índice estacional', data: data.map(d => d.indice) }],
      xaxis: { categories: data.map(d => d.nombre), labels: { style: { colors: tick, fontSize: '10px' } }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { labels: { style: { colors: tick, fontSize: '10px' }, formatter: v => v + '%' } },
      colors: data.map(d => d.indice >= 100 ? palette[0] : palette[6]),   // navy / navy3
      plotOptions: { bar: { borderRadius: 3, columnWidth: '60%', distributed: true } },
      dataLabels: { enabled: true, formatter: v => v + '%', style: { fontSize: '10px', fontWeight: 600 } },
      tooltip: { theme: dark ? 'dark' : 'light', y: { formatter: v => v + '% vs. promedio' } },
      legend: { show: false },
      grid: { borderColor: grid, strokeDashArray: 3, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
      annotations: { yaxis: [{ y: 100, borderColor: palette[4], strokeDashArray: 4, label: { text: 'Promedio', style: { color: palette[4], fontSize: '10px', background: 'transparent' } } }] },
    }
    if (chartRef.current) chartRef.current.updateOptions(opts, true)
    else { chartRef.current = new ApexCharts(ref.current, opts); chartRef.current.render() }
  }, [data, dark])

  useEffect(() => () => chartRef.current?.destroy(), [])
  return <div ref={ref} className="w-full h-full" />
}

export default function Predicciones({ dark }) {
  const [data, setData]    = useState(null)
  const [loading, setLoad] = useState(true)
  const [error, setError]  = useState(null)

  useEffect(() => {
    fetch('/api/predicciones')
      .then(r => r.json())
      .then(d => { setData(d); setLoad(false) })
      .catch(() => { setError('Error al cargar predicciones'); setLoad(false) })
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center flex-col gap-3 text-[13px] text-muted-foreground">
      <div className="w-8 h-8 border-[3px] border-border border-t-primary rounded-full animate-spin-slow" />
      Calculando modelos predictivos…
    </div>
  )

  if (error || data?.error) return (
    <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground">
      {error || data.error}
    </div>
  )

  const { forecast_anual, estacionalidad, regiones_proyeccion } = data
  const fa        = forecast_anual
  const creciente = fa.tendencia === 'creciente'
  const nextYear  = fa.prediccion?.[0]

  return (
    <div className="flex-1 flex flex-col overflow-y-auto gap-3 p-3 min-h-0">

      {/* Aviso modelo */}
      <div className="island flex items-start gap-2.5 px-4 py-3 text-[11px] text-muted-foreground">
        <Info size={13} className="shrink-0 mt-0.5" />
        <span>
          <strong className="text-foreground">Modelo:</strong> Regresión Lineal OLS sobre datos anuales {Math.min(...fa.historico.map(d => d.anio))}–{Math.max(...fa.historico.map(d => d.anio))}.
          Las proyecciones asumen continuidad de la tendencia histórica y no incorporan cambios de política sanitaria ni eventos externos.
          IC 90%: ±1.645σ de los residuos históricos.
        </span>
      </div>

      {/* KPIs del modelo */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="R² del modelo" value={fa.r2} sub="Bondad de ajuste"
          tip="R² (coeficiente de determinación): porción de la varianza histórica explicada por el modelo. 1.0 = ajuste perfecto." />
        <MetricCard label="RMSE" value={fmt(fa.rmse)} sub="Error medio histórico"
          tip="Root Mean Square Error: error cuadrático medio del modelo sobre datos históricos. Menor es mejor." />
        <MetricCard
          label={`Proyección ${nextYear?.anio ?? '2026'}`}
          value={fmt(nextYear?.atenciones)} accent
          sub={`IC 90%: ${fmt(nextYear?.lower)} – ${fmt(nextYear?.upper)}`}
          tip={`Valor puntual proyectado. Intervalo de confianza 90%: ${fmt(nextYear?.lower)} – ${fmt(nextYear?.upper)}`}
        />
        <MetricCard
          label="Tendencia anual" value={`${creciente ? '+' : ''}${fmt(fa.pendiente_anual)}`}
          sub={creciente ? 'Tendencia creciente' : 'Tendencia decreciente'}
          tip="Incremento absoluto de atenciones proyectado por año según la pendiente de la regresión lineal."
        />
      </div>

      {/* Interpretación */}
      <div className="island flex items-start gap-2.5 px-4 py-3 text-[12px] text-foreground leading-relaxed"
           style={{ borderLeft: `3px solid ${creciente ? 'var(--green)' : 'hsl(var(--accent))'}` }}>
        {creciente
          ? <TrendingUp size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--green)' }} />
          : <TrendingDown size={15} className="text-accent shrink-0 mt-0.5" />}
        <span>{fa.interpretacion}</span>
      </div>

      {/* Forecast chart */}
      <div className="chart-panel-wrap" style={{ minHeight: 300 }}>
        <PanelHeader icon={BarChart2} title="Forecast de Atenciones 2026–2028" />
        <div className="flex-1 p-2" style={{ height: 280 }}>
          <ForecastChart historico={fa.historico} prediccion={fa.prediccion} dark={dark} />
        </div>
      </div>

      {/* Estacionalidad + Regiones */}
      <div className="grid grid-cols-2 gap-3">
        <div className="chart-panel-wrap" style={{ minHeight: 280 }}>
          <PanelHeader icon={Calendar} title="Índice de Estacionalidad Mensual"
            tip="Índice 100 = promedio histórico del mes. Mayor que 100 = mes con mayor demanda que el promedio." />
          <div className="flex-1 p-2" style={{ height: 220 }}>
            {estacionalidad?.length
              ? <SeasonalChart data={estacionalidad} dark={dark} />
              : <div className="h-full flex items-center justify-center text-[12px] text-muted-foreground">Datos mensuales no disponibles</div>
            }
          </div>
        </div>

        <div className="chart-panel-wrap" style={{ minHeight: 280 }}>
          <PanelHeader icon={MapPin} title="Proyección 2026 por Región (Top 10)"
            tip="Proyección basada en CAGR del modelo global aplicada a cada región. No captura tendencias regionales individuales." />
          <div className="flex-1 overflow-y-auto">
            {regiones_proyeccion?.map((r, i) => (
              <div key={r.region}
                   className={cn('flex items-center gap-2 px-3 py-2', i < regiones_proyeccion.length - 1 && 'border-b border-border/50')}>
                <span className="text-[11px] font-bold text-muted-foreground w-5 shrink-0 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-foreground truncate">{r.region}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {fmt(r.atenciones)} → <strong className="text-primary">{fmt(r.proyeccion_2026)}</strong>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground">{r.share_pct}%</div>
                  <div className="text-[10px] font-semibold"
                       style={{ color: r.crecimiento_pct >= 0 ? 'var(--green)' : 'hsl(var(--accent))' }}>
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
