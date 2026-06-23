export const fmt = n => {
  if (n == null) return '—'
  const v = Number(n)
  if (v >= 1e9) return (v / 1e9).toFixed(2) + ' B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + ' M'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + ' K'
  return v.toLocaleString('es-PE')
}

export const fmtFull = n =>
  n == null ? '—' : Number(n).toLocaleString('es-PE')

export const trunc = (s, n) =>
  s && s.length > n ? s.slice(0, n - 2) + '..' : (s || '')

export const norm = s =>
  !s ? '' : s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()
