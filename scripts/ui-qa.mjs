#!/usr/bin/env node
/**
 * scripts/ui-qa.mjs
 * Analiza los componentes JSX buscando antipatrones de diseño conocidos.
 * Exit 1 si hay violaciones ERROR → bloquea el push en CI.
 *
 * Uso: node scripts/ui-qa.mjs
 *
 * Suprimir una regla en una línea específica:
 *   // ui-qa-disable: <rule-id> — razón obligatoria
 *
 * Los antipatrones que detecta:
 *   no-pill-badge         rounded-full + background dinámico (badge vibecodeado)
 *   no-border-side-inline borderLeft/Right como inline style dinámico (pestaña vibecodeada)
 *   no-hex-in-style       Color hexadecimal hardcodeado en style prop
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT      = join(__dirname, '..')
const SRC_DIR   = join(ROOT, 'web/frontend/src/components')

// ── Colores para terminal ────────────────────────────────────────────────────
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const GREEN  = '\x1b[32m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'
const DIM    = '\x1b[2m'

// ── Reglas ──────────────────────────────────────────────────────────────────
const RULES = [
  {
    id: 'no-pill-badge',
    severity: 'error',
    message: 'Badge circular (rounded-full) con background dinámico.',
    hint:    'Usar clases Tailwind (bg-muted, bg-primary/10) en lugar de style={{ background }}.',
    /**
     * Detecta el patrón: className="...rounded-full..." style={{ background: ... }}
     * en la MISMA línea — la forma más común del antipatrón pill badge.
     */
    check(lines, disabledLines) {
      const violations = []
      lines.forEach((line, i) => {
        if (disabledLines.has(i + 1)) return
        if (
          line.includes('rounded-full') &&
          /style=\{[^}]*background/i.test(line)
        ) {
          violations.push({ line: i + 1, snippet: line.trim().slice(0, 100) })
        }
      })
      return violations
    },
  },

  {
    id: 'no-border-side-inline',
    severity: 'error',
    message: 'Borde lateral (borderLeft / borderRight) como inline style dinámico.',
    hint:    'Usar border-l-4 de Tailwind + una variable CSS, o diseñar la diferenciación sin borde.',
    /**
     * Detecta: style={{ borderLeft: ... }} o style={{ borderRight: ... }}
     * con template literal o variable (no valor estático como "1px solid #eee").
     */
    check(lines, disabledLines) {
      const violations = []
      lines.forEach((line, i) => {
        if (disabledLines.has(i + 1)) return
        if (/style=\{[^}]*border(Left|Right)\s*:/i.test(line) &&
            /[`$]/.test(line)) {          // solo flagea estilos dinámicos
          violations.push({ line: i + 1, snippet: line.trim().slice(0, 100) })
        }
      })
      return violations
    },
  },

  {
    id: 'no-hex-in-style',
    severity: 'warning',
    message: 'Color hexadecimal hardcodeado en style prop.',
    hint:    'Usar variables CSS (hsl(var(--primary))) o clases Tailwind.',
    check(lines, disabledLines) {
      const violations = []
      lines.forEach((line, i) => {
        if (disabledLines.has(i + 1)) return
        if (/style=\{[^}]*:\s*["']#[0-9a-fA-F]{3,6}["'][^}]*\}/i.test(line)) {
          violations.push({ line: i + 1, snippet: line.trim().slice(0, 100) })
        }
      })
      return violations
    },
  },
]

// ── Utilidades ───────────────────────────────────────────────────────────────
function walkJsx(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) files.push(...walkJsx(full))
    else if (entry.endsWith('.jsx') || entry.endsWith('.tsx')) files.push(full)
  }
  return files
}

/**
 * Parsea comentarios de supresión:
 *   // ui-qa-disable: rule-id — razón ...
 * Devuelve un Map<lineNumber, Set<ruleId>>
 */
function parseDisables(lines) {
  const map = new Map()   // lineNumber (1-indexed) → Set<ruleId>
  lines.forEach((line, i) => {
    const m = line.match(/ui-qa-disable:\s*([\w-]+)/)
    if (m) {
      // La supresión aplica a la siguiente línea que contiene código real
      const targetLine = i + 2   // próxima línea (1-indexed)
      if (!map.has(targetLine)) map.set(targetLine, new Set())
      map.get(targetLine).add(m[1])
    }
  })
  return map
}

// ── Runner ───────────────────────────────────────────────────────────────────
function checkFile(filePath) {
  const src        = readFileSync(filePath, 'utf8')
  const lines      = src.split('\n')
  const disableMap = parseDisables(lines)   // line → Set<ruleId>
  const results    = []

  for (const rule of RULES) {
    // Construir conjunto de líneas suprimidas para esta regla
    const disabledLines = new Set(
      [...disableMap.entries()]
        .filter(([, ids]) => ids.has(rule.id))
        .map(([ln]) => ln)
    )

    const violations = rule.check(lines, disabledLines)
    for (const v of violations) {
      results.push({ rule, file: filePath, ...v })
    }
  }
  return results
}

// ── Main ─────────────────────────────────────────────────────────────────────
const files      = walkJsx(SRC_DIR)
const allResults = []

for (const f of files) {
  allResults.push(...checkFile(f))
}

const errors   = allResults.filter(r => r.rule.severity === 'error')
const warnings = allResults.filter(r => r.rule.severity === 'warning')

if (allResults.length === 0) {
  console.log(`${GREEN}${BOLD}✓ UI QA: sin violaciones en ${files.length} componentes.${RESET}`)
  process.exit(0)
}

// ── Imprimir reporte ──────────────────────────────────────────────────────────
console.log(`\n${BOLD}UI QA — Reporte de antipatrones de diseño${RESET}`)
console.log(`Analizados: ${files.length} componentes JSX\n`)

for (const r of allResults) {
  const rel    = relative(ROOT, r.file)
  const color  = r.rule.severity === 'error' ? RED : YELLOW
  const label  = r.rule.severity === 'error' ? 'ERROR' : 'WARN '

  console.log(`${color}${BOLD}[${label}]${RESET} ${rel}:${r.line}`)
  console.log(`       ${BOLD}Regla:${RESET} ${r.rule.id}`)
  console.log(`       ${BOLD}Qué:${RESET}   ${r.rule.message}`)
  console.log(`       ${BOLD}Cómo:${RESET}  ${r.rule.hint}`)
  console.log(`       ${DIM}${r.snippet}${RESET}`)
  console.log()
}

const summary = []
if (errors.length)   summary.push(`${RED}${BOLD}${errors.length} error(es)${RESET}`)
if (warnings.length) summary.push(`${YELLOW}${warnings.length} aviso(s)${RESET}`)
console.log(`Resultado: ${summary.join(', ')}`)

if (errors.length > 0) {
  console.log(`\n${RED}${BOLD}Push bloqueado — corrige los errores antes de volver a intentarlo.${RESET}`)
  console.log(`${DIM}Para suprimir un caso excepcional justificado, agrega en la línea anterior:${RESET}`)
  console.log(`${DIM}  {/* ui-qa-disable: <rule-id> — razón */}${RESET}\n`)
  process.exit(1)
}

// Solo warnings → no bloquear
console.log(`\n${YELLOW}Push permitido con avisos. Considera resolverlos en el próximo ciclo.${RESET}\n`)
process.exit(0)
