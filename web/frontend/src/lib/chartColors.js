/**
 * Resolución de colores del brandbook SIS desde variables CSS.
 * Centraliza los tokens de color para que ApexCharts, Leaflet y cualquier
 * otra librería que no soporte CSS vars los obtenga en tiempo de ejecución.
 *
 * Llamar DENTRO de efectos/callbacks (nunca en el cuerpo del módulo)
 * para que getComputedStyle lea los valores del tema activo.
 */

const ROOT = () => document.documentElement

/** Lee el valor computado de una variable CSS (puede ser hex, rgb, hsl, raw-HSL, etc.) */
export function resolveColor(varName) {
  return getComputedStyle(ROOT()).getPropertyValue(varName).trim()
}

/**
 * Colores de las series de gráficos — en orden de aparición.
 * Siguen exactamente los tokens definidos en index.css.
 */
export function resolveChartSeries() {
  const g = resolveColor
  return [
    g('--navy'),     // #5b6fb3 light / #8a9fd8 dark
    g('--lblue'),    // #57c4f2 (estático)
    g('--green'),    // #afcc46 (estático)
    g('--orange'),   // #f6a64a (estático)
    g('--accent-c'), // #dc388d light / #e85fa0 dark
    g('--navy2'),
    g('--navy3'),
    g('--navy4'),
  ]
}

/** Colores de la grilla y etiquetas de ejes para ApexCharts */
export function resolveGridTick() {
  return {
    grid: resolveColor('--border-c'),
    tick: resolveColor('--muted-c'),
  }
}

/** Stops del mapa coroplético (adaptables al modo oscuro por CSS) */
export function resolveMapStops() {
  return [1, 2, 3, 4, 5].map(i => resolveColor(`--map${i}`))
}
