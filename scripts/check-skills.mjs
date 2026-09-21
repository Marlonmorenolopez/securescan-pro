#!/usr/bin/env node
// scripts/check-skills.mjs — SecureScan Pro v5.0
//
// Valida la COHERENCIA del Skill Registry (lib/skills.ts) con todo lo que lo
// consume, para que agregar una Skill no deje piezas a medias en silencio:
//
//   · Registry: ids únicos, campos válidos, `planned` sin `docs`.
//   · Navegación: cada subgroup existe en lib/nav-config.tsx y tiene su label
//     traducido (ES/EN).
//   · Iconos: cada `svgIconKey` existe en TOOL_ICONS (components/tool-icons.tsx).
//   · i18n: cada Skill 'available' tiene skills.<id>.short; las que tienen
//     `docs` además description y features[] — en ES y EN, con la misma
//     cantidad de features. Paridad completa ES/EN en todo messages/.
//   · Extractores: cada Skill de Pentesting/Huella tiene extractor y viceversa.
//
// Uso:  npm run check:skills      (exit 1 si hay errores; las advertencias no fallan)
//
// No ejecuta el backend ni toca red. Usa el compilador `typescript` que ya es
// dependencia del proyecto para leer los .ts/.tsx reales (sin duplicar datos).

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(ROOT, 'package.json'))
const ts = require('typescript')

// ── Mini cargador de módulos TS/TSX (solo lectura, para este script) ─────────
const cache = new Map()
const iconStub = new Proxy({}, { get: (_t, name) => (name === '__esModule' ? false : function IconStub() { return null }) })

function resolveFile(spec, fromDir) {
  const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2)) : path.resolve(fromDir, spec)
  for (const ext of ['', '.ts', '.tsx', '.js', '.mjs']) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext
  }
  throw new Error(`No se pudo resolver ${spec}`)
}

function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  const src = fs.readFileSync(file, 'utf8')
  const out = ts.transpileModule(src, {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText
  const mod = { exports: {} }
  cache.set(file, mod)
  const dir = path.dirname(file)
  const localRequire = spec => {
    if (spec === 'lucide-react') return iconStub
    if (spec.startsWith('@/') || spec.startsWith('.')) return load(resolveFile(spec, dir))
    return require(spec)
  }
  new Function('require', 'module', 'exports', out)(localRequire, mod, mod.exports)
  return mod.exports
}

const skillsMod = load(path.join(ROOT, 'lib/skills.ts'))
const nav = load(path.join(ROOT, 'lib/nav-config.tsx'))
const icons = load(path.join(ROOT, 'components/tool-icons.tsx'))
const extractors = load(path.join(ROOT, 'lib/scan-extractors.ts'))
const messages = {
  es: JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/es.json'), 'utf8')),
  en: JSON.parse(fs.readFileSync(path.join(ROOT, 'messages/en.json'), 'utf8')),
}

const { SKILLS } = skillsMod
const TOOL_ICONS = icons.TOOL_ICONS
const SECTIONS = { pentesting: nav.PENTESTING, 'huella-digital': nav.HUELLA_DIGITAL, osint: nav.OSINT, 'code-security': nav.CODE_SECURITY }

const errors = []
const warnings = []
const err = m => errors.push(m)
const warn = m => warnings.push(m)
const get = (obj, pathStr) => pathStr.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)

// ── 1. Registry ──────────────────────────────────────────────────────────────
const ids = new Set()
for (const s of SKILLS) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) err(`[registry] id "${s.id}" no es kebab-case.`)
  if (ids.has(s.id)) err(`[registry] id duplicado: "${s.id}".`)
  ids.add(s.id)
  if (!s.name?.trim()) err(`[registry] "${s.id}" sin name.`)
  if (!SECTIONS[s.category]) err(`[registry] "${s.id}" tiene categoría desconocida "${s.category}".`)
  if (s.status !== 'available' && s.status !== 'planned') err(`[registry] "${s.id}" tiene status inválido "${s.status}".`)
  if (s.status === 'planned' && s.docs) err(`[registry] "${s.id}" es 'planned' y tiene docs: no se documenta lo que no existe.`)
  if (s.docs) {
    if (!s.docs.usage?.trim()) err(`[docs] "${s.id}" sin usage.`)
    if (!/^https:\/\//.test(s.docs.documentationUrl ?? '')) err(`[docs] "${s.id}" documentationUrl debe ser https.`)
  }
  if (s.svgIconKey && !TOOL_ICONS[s.svgIconKey]) err(`[icons] "${s.id}" svgIconKey "${s.svgIconKey}" no existe en TOOL_ICONS.`)
}
const names = new Map()
for (const s of SKILLS) {
  const k = `${s.category}:${s.name.toLowerCase()}`
  if (names.has(k)) warn(`[registry] nombre repetido en ${s.category}: "${s.name}" (${names.get(k)} y ${s.id}).`)
  names.set(k, s.id)
}

// ── 2. Navegación: subgroups y labels ────────────────────────────────────────
for (const s of SKILLS) {
  const section = SECTIONS[s.category]
  if (section && !section.groups.some(g => g.key === s.subgroup)) {
    err(`[nav] "${s.id}": subgroup "${s.subgroup}" no existe en nav-config (${section.id}). Sin ese group la Skill queda invisible.`)
  }
}
for (const [cat, section] of Object.entries(SECTIONS)) {
  for (const g of section.groups) {
    const available = SKILLS.filter(s => s.category === cat && s.subgroup === g.key && s.status === 'available')
    if (available.length === 0) warn(`[nav] el group "${cat}/${g.key}" no tiene Skills 'available'.`)
    for (const lang of ['es', 'en']) {
      if (typeof get(messages[lang], `navCatalog.sections.${section.id}.groups.${g.key}`) !== 'string') {
        err(`[i18n:${lang}] falta navCatalog.sections.${section.id}.groups.${g.key}.`)
      }
    }
  }
}

// ── 3. i18n por Skill ────────────────────────────────────────────────────────
for (const s of SKILLS.filter(x => x.status === 'available')) {
  for (const lang of ['es', 'en']) {
    const base = `skills.${s.id}`
    const short = get(messages[lang], `${base}.short`)
    if (typeof short !== 'string' || !short.trim()) err(`[i18n:${lang}] falta ${base}.short.`)
    if (s.docs) {
      const d = get(messages[lang], `${base}.description`)
      const f = get(messages[lang], `${base}.features`)
      if (typeof d !== 'string' || !d.trim()) err(`[i18n:${lang}] falta ${base}.description.`)
      if (!Array.isArray(f) || f.length === 0 || f.some(x => typeof x !== 'string' || !x.trim())) err(`[i18n:${lang}] ${base}.features debe ser una lista de textos no vacía.`)
    }
  }
  if (s.docs) {
    const a = get(messages.es, `skills.${s.id}.features`), b = get(messages.en, `skills.${s.id}.features`)
    if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) err(`[i18n] skills.${s.id}.features tiene ${a.length} en ES y ${b.length} en EN.`)
  }
}
for (const lang of ['es', 'en']) {
  for (const id of Object.keys(messages[lang].skills ?? {})) {
    if (!ids.has(id)) warn(`[i18n:${lang}] skills.${id} no corresponde a ninguna Skill del Registry.`)
    else if (SKILLS.find(s => s.id === id).status === 'planned' && messages[lang].skills[id].description) warn(`[i18n:${lang}] skills.${id} es 'planned' y tiene description (no se muestra: los planned no se documentan).`)
  }
}

// ── 4. Paridad ES/EN completa ────────────────────────────────────────────────
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
const kes = new Set(flat(messages.es)), ken = new Set(flat(messages.en))
for (const k of kes) if (!ken.has(k)) err(`[i18n] "${k}" existe en ES pero no en EN.`)
for (const k of ken) if (!kes.has(k)) err(`[i18n] "${k}" existe en EN pero no en ES.`)

// ── 5. Extractores (contrato con el backend) ─────────────────────────────────
for (const gap of extractors.getExtractorCoverageGaps()) err(`[extractors] ${gap}`)

// ── Reporte ──────────────────────────────────────────────────────────────────
console.log('Skill Registry — resumen')
for (const cat of Object.keys(SECTIONS)) {
  const all = SKILLS.filter(s => s.category === cat)
  const av = all.filter(s => s.status === 'available').length
  console.log(`  ${cat.padEnd(15)} ${String(all.length).padStart(2)} Skills (${av} available, ${all.length - av} planned)`)
}
console.log(`  ${'TOTAL'.padEnd(15)} ${String(SKILLS.length).padStart(2)} Skills`)
for (const w of warnings) console.log(`WARN  ${w}`)
for (const e of errors) console.log(`ERROR ${e}`)
console.log(errors.length ? `\ncheck:skills FALLÓ (${errors.length} error(es), ${warnings.length} advertencia(s))` : `\ncheck:skills OK (${warnings.length} advertencia(s))`)
process.exit(errors.length ? 1 : 0)
