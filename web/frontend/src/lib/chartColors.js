// Single source of truth for the chart color palettes used across the app
// (App.jsx, ChartPanel.jsx, Predicciones.jsx). Previously these arrays were
// copy-pasted verbatim in all three files — any palette tweak had to be
// applied in three places and inevitably drifted.
//
// The light-palette hexes mirror `theme.extend.colors.sis` in
// tailwind.config.js, imported directly so the two never fall out of sync.
// A couple of values (dark-mode chart variants, ApexCharts grid/tick colors)
// don't have a Tailwind token of their own and live here as the literal
// source of truth instead.
import tailwindConfig from '../../tailwind.config.js'

const sis = tailwindConfig.theme.extend.colors.sis

// Light-theme chart palette (matches sis.* Tailwind tokens)
export const CL = [sis.navy, sis.blue, sis.green, sis.orange, sis.accent, sis.navy2, sis.navy3, '#2a3a7c']

// Dark-theme chart palette (lighter tints for contrast against dark backgrounds)
export const CD = ['#8a9fd8', '#7ad5f5', '#c4df6a', '#f9b870', '#e85fa0', '#a0b2e8', '#6a80c4', sis.navy]

// ApexCharts grid line / axis tick colors, per theme
export const GRID = { light: '#d8dced', dark: '#252840' }
export const TICK = { light: '#6b7190', dark: '#8890b8' }

// Muted tint used for "below average" bars (e.g. seasonality chart)
export const BELOW_AVG = '#a8b5e8'
