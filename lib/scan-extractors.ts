// lib/scan-extractors.ts — SecureScan Pro v5.0
//
// EXTRACCIÓN de resultados reales del scan para las dos experiencias de la
// plataforma:
//
//   · Pentesting     → las 12 herramientas del Skill Registry (categoría
//                      'pentesting'), con su estado y conteo real.
//   · Huella Digital → las 7 fuentes de Threat Intelligence del Registry
//                      (categoría 'huella-digital') leídas de
//                      `currentScan.threat_intel`.
//
// Este archivo NO inventa nada: solo mapea campos del contrato REAL del
// backend (ver ScanResult en lib/scan-context.tsx) a estructuras de vista.
// Las herramientas se derivan SIEMPRE del Skill Registry (lib/skills.ts, fuente
// única de verdad): aquí solo vive el mapeo "id de Skill → campo del scan /
// paso del pipeline", que es lógica de EJECUCIÓN acoplada al backend y por eso
// no forma parte de la metadata del Registry.
//
// Registrar una Skill en el Registry no la conecta al backend: para que
// tenga estado/resultados en la UI hay que añadir aquí su extractor. Si una
// Skill de Pentesting/Huella no tiene extractor, `assertExtractorCoverage()`
// lo avisa en desarrollo.

import { getSkillsByCategory, type Skill } from '@/lib/skills'
import type { ScanResult } from '@/lib/scan-context'
import type { VirusTotalResult } from '@/components/results/intel/VirusTotalPanel'
import type { AbuseIPDBResult } from '@/components/results/intel/AbuseIPDBPanel'
import type { ShodanResult } from '@/components/results/intel/ShodanPanel'
import type { CrtShResult } from '@/components/results/intel/CrtShPanel'
import type { TestSSLResult } from '@/components/results/intel/TestSSLPanel'
import type { DnstwistResult } from '@/components/results/intel/DnstwistPanel'
import type { SafeBrowsingResult } from '@/components/results/intel/SafeBrowsingPanel'

// ─── Tipos comunes ───────────────────────────────────────────────────────────

export type ToolRunStatus = 'idle' | 'running' | 'completed' | 'error' | 'skipped'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'informational'

type ScanLike = Partial<ScanResult> | null | undefined

// ─── Alcance del análisis (qué módulo participó) ─────────────────────────────

/** Flags de herramientas de Pentesting que el frontend envía en `options.tools`. */
const PENTEST_OPTION_FLAGS = [
  'wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit',
  'metasploit', 'nuclei', 'sqlmap', 'patator', 'ffuf',
] as const

export interface ScanScope {
  /** true si se pidió al menos una herramienta de Pentesting */
  pentesting: boolean
  /** true si la fase de Huella Digital estaba habilitada (default del backend: sí) */
  footprint: boolean
}

/**
 * Deduce qué módulos participaron a partir de `options.tools` (lo que el
 * backend devuelve dentro del scan). Si no hay `options` (escaneos viejos o
 * historial sin ese campo) se asume el comportamiento por defecto del
 * backend: ambos módulos.
 */
export function getScanScope(scan: ScanLike): ScanScope {
  const tools = scan?.options?.tools
  if (!tools) return { pentesting: true, footprint: true }
  return {
    pentesting: PENTEST_OPTION_FLAGS.some(flag => tools[flag] === true),
    footprint: tools.threat_intel !== false,
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PENTESTING — 12 herramientas
// ═════════════════════════════════════════════════════════════════════════════

interface PentestExtractor {
  /** Nombre del paso en `scan.steps` (lo define el backend en _launch_scan_job) */
  step: string
  /** Flag de `options.tools` que activa la herramienta (para detectar "omitida") */
  optionFlag: string
  /** Conteo real de resultados de la herramienta */
  count: (scan: Partial<ScanResult>) => number
}

const isFinding = (r: any) => !!r && !r.error

/**
 * Mapeo id de Skill → paso/campo real del backend.
 *
 * Notas verificadas contra server/app.py y server/modules/orchestrator.py:
 *  - "ZAP Spider" tiene su propio paso; sus URLs llegan en `spider_results`.
 *    Se activa con el flag `zap` (ZAP full scan = spider + active).
 *  - "Injection Scanner" NO tiene paso propio: corre en el paso "SQLMap" y
 *    escribe en `sqli_results` con `tool: 'injection_scanner'`. Si el módulo
 *    no está disponible, el backend cae a SQLMap y los resultados llevan otro
 *    `tool` (o ninguno). Ambos se activan con el flag `sqlmap`.
 */
const PENTEST_EXTRACTORS: Record<string, PentestExtractor> = {
  wappalyzer:  { step: 'Wappalyzer',   optionFlag: 'wappalyzer',   count: s => s.technologies?.length ?? 0 },
  nmap:        { step: 'Nmap',         optionFlag: 'nmap',         count: s => s.ports?.length ?? 0 },
  gobuster:    { step: 'Gobuster',     optionFlag: 'gobuster',     count: s => s.directories?.length ?? 0 },
  ffuf:        { step: 'ffuf',         optionFlag: 'ffuf',         count: s => s.ffuf_endpoints?.length ?? 0 },
  zap:         { step: 'ZAP',          optionFlag: 'zap',          count: s => s.vulnerabilities?.length ?? 0 },
  'zap-spider': { step: 'ZAP Spider',  optionFlag: 'zap',          count: s => s.spider_results?.length ?? 0 },
  nuclei:      { step: 'Nuclei',       optionFlag: 'nuclei',       count: s => s.nuclei_findings?.length ?? 0 },
  'injection-scanner': {
    step: 'SQLMap', optionFlag: 'sqlmap',
    count: s => (s.sqli_results ?? []).filter(r => isFinding(r) && r.tool === 'injection_scanner').length,
  },
  patator:     { step: 'Patator',      optionFlag: 'patator',      count: s => (s.brute_force_results ?? []).filter((r: any) => r?.success).length },
  sqlmap: {
    step: 'SQLMap', optionFlag: 'sqlmap',
    count: s => (s.sqli_results ?? []).filter(r => isFinding(r) && r.tool !== 'injection_scanner').length,
  },
  metasploit:  { step: 'Metasploit',   optionFlag: 'metasploit',   count: s => s.metasploit?.length ?? 0 },
  searchsploit: { step: 'Searchsploit', optionFlag: 'searchsploit', count: s => s.exploits?.length ?? 0 },
}

export interface PentestToolStat {
  skill: Skill
  status: ToolRunStatus
  /** Resultados reales. 0 si no hay o la herramienta se omitió. */
  count: number
}

function stepStatus(scan: ScanLike, stepName: string): ToolRunStatus {
  const step = scan?.steps?.find(s => s.name.toLowerCase() === stepName.toLowerCase())
  switch (step?.status) {
    case 'running':   return 'running'
    case 'completed': return 'completed'
    case 'error':     return 'error'
    default:          return 'idle'
  }
}

/** Las herramientas de Pentesting del Registry, en el orden del Registry. */
export function getPentestingSkills(): Skill[] {
  return getSkillsByCategory('pentesting')
}

/**
 * Estado + conteo de cada herramienta de Pentesting. Sin scan → todas `idle`.
 * Una herramienta desactivada en las opciones del scan se marca `skipped`
 * (el backend la registra como "completada" al instante; mostrarla como tal
 * sería engañoso).
 */
export function getPentestingToolStats(scan: ScanLike): PentestToolStat[] {
  return getPentestingSkills().map(skill => {
    const ex = PENTEST_EXTRACTORS[skill.id]
    if (!ex || !scan) return { skill, status: 'idle', count: 0 }
    const flag = scan.options?.tools?.[ex.optionFlag]
    // Injection Scanner también se activa con el flag legado `injection`
    const enabled = flag !== false || (ex.optionFlag === 'sqlmap' && scan.options?.tools?.injection === true)
    if (!enabled) return { skill, status: 'skipped', count: 0 }
    return { skill, status: stepStatus(scan, ex.step), count: ex.count(scan) }
  })
}

/** Conteo de hallazgos por severidad de Pentesting (misma lógica que ya usaba /scanner). */
export function extractSeverityCounts(scan: any): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0, informational: 0 }
  const vulns: any[] = [
    ...(scan?.vulnerabilities ?? scan?.results?.vulnerabilities ?? []),
    ...(scan?.results?.zap_vulnerabilities ?? []),
    ...(scan?.nuclei_findings ?? scan?.results?.nuclei_findings ?? []),
    ...(scan?.sqli_results ?? scan?.results?.sqli_results ?? scan?.results?.sqlmap_results ?? []),
    ...(scan?.metasploit ?? scan?.results?.metasploit ?? []),
  ]
  for (const v of vulns) {
    const sev = (v?.severity ?? v?.risk ?? v?.level ?? '').toLowerCase() as Severity
    if (sev in counts) counts[sev]++
    else if (sev === 'informational') counts.info++
  }
  return counts
}

// ═════════════════════════════════════════════════════════════════════════════
// HUELLA DIGITAL — 7 fuentes
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Estado de una fuente de Huella Digital, derivado del contrato real
 * (`simulated`, `error`) de cada módulo del backend:
 *
 *  - notRun → la clave no existe en `threat_intel` (no se ejecutó / fue
 *             desactivada / el análisis aún no la devolvió).
 *  - noData → `simulated: true`. El módulo devolvió un resultado vacío de
 *             marcador: sin API key, host interno/privado, o herramienta no
 *             instalada. NO es "0 resultados": es "no hay dato real".
 *  - error  → se intentó de verdad (`simulated: false`) pero falló
 *             (`error` informado: timeout, sin TLS, etc.).
 *  - data   → resultado real.
 */
export type SourceState = 'data' | 'noData' | 'error' | 'notRun'

interface FootprintRawMap {
  crtsh?: CrtShResult
  dnstwist?: DnstwistResult
  shodan?: ShodanResult
  virustotal?: VirusTotalResult
  abuseipdb?: AbuseIPDBResult
  safebrowsing?: SafeBrowsingResult
  testssl?: TestSSLResult
}

/** id de Skill → clave dentro de `threat_intel` (coinciden hoy; se declara para no depender de ello). */
const FOOTPRINT_KEYS: Record<string, keyof FootprintRawMap> = {
  crtsh: 'crtsh', dnstwist: 'dnstwist', shodan: 'shodan',
  virustotal: 'virustotal', abuseipdb: 'abuseipdb',
  safebrowsing: 'safebrowsing', testssl: 'testssl',
}

export function getFootprintSkills(): Skill[] {
  return getSkillsByCategory('huella-digital')
}

export function classifySource(raw: { simulated?: boolean; error?: string | null } | undefined | null): SourceState {
  if (!raw) return 'notRun'
  if (raw.simulated === true) return 'noData'
  if (raw.error) return 'error'
  return 'data'
}

export interface FootprintSourceView<T = any> {
  skill: Skill
  state: SourceState
  raw: T | undefined
  /** Motivo informado por el backend cuando no hay dato real o hubo error */
  reason: string | null
}

export interface FootprintGroupView {
  /** subgroup del Registry = key del grupo en nav-config (dominios, infraestructura, reputacion, tlsSsl) */
  key: string
  sources: FootprintSourceView[]
  /** Fuentes con dato real / total de fuentes del grupo */
  withData: number
  total: number
}

export interface FootprintMetrics {
  /** null = no hay dato real (se pinta "—"), nunca 0 */
  subdomains: number | null
  certificates: number | null
  lookalikes: number | null
  lookalikeCandidates: number | null
  ips: string[] | null
  hostnames: string[] | null
  openPorts: number[] | null
  cves: string[] | null
  tags: string[] | null
  vtFlagged: number | null
  abuseScore: number | null
  safeBrowsingFlagged: boolean | null
  tlsWarnings: number | null
  /** Señales de riesgo sumadas entre las fuentes con dato real; null si ninguna tiene dato */
  riskSignals: number | null
}

export interface FootprintModel {
  hasAnyResult: boolean
  sources: FootprintSourceView[]
  bySkill: Record<string, FootprintSourceView>
  groups: FootprintGroupView[]
  metrics: FootprintMetrics
  /** Fuentes con dato real / total */
  withData: number
  total: number
}

const RISKY_SHODAN_TAGS = ['compromised', 'malware', 'honeypot', 'tor']

export function getFootprintModel(scan: ScanLike): FootprintModel {
  const intel = (scan?.threat_intel ?? {}) as FootprintRawMap

  const sources: FootprintSourceView[] = getFootprintSkills().map(skill => {
    const raw = intel[FOOTPRINT_KEYS[skill.id]] as any
    const state = classifySource(raw)
    return { skill, state, raw, reason: state === 'data' || state === 'notRun' ? null : (raw?.error ?? null) }
  })
  const bySkill = Object.fromEntries(sources.map(s => [s.skill.id, s]))

  const groupKeys = Array.from(new Set(sources.map(s => s.skill.subgroup)))
  const groups: FootprintGroupView[] = groupKeys.map(key => {
    const inGroup = sources.filter(s => s.skill.subgroup === key)
    return { key, sources: inGroup, total: inGroup.length, withData: inGroup.filter(s => s.state === 'data').length }
  })

  // Solo se leen datos de fuentes en estado 'data'
  const d = <T,>(id: string): T | null => (bySkill[id]?.state === 'data' ? (bySkill[id].raw as T) : null)
  const crt = d<CrtShResult>('crtsh')
  const dns = d<DnstwistResult>('dnstwist')
  const sho = d<ShodanResult>('shodan')
  const vt  = d<VirusTotalResult>('virustotal')
  const abu = d<AbuseIPDBResult>('abuseipdb')
  const sb  = d<SafeBrowsingResult>('safebrowsing')
  const tls = d<TestSSLResult>('testssl')

  const ipList = [sho?.ip, abu?.ip].filter((x): x is string => !!x)
  const ips = sho || abu ? Array.from(new Set(ipList)) : null

  let riskSignals: number | null = null
  const addRisk = (n: number) => { riskSignals = (riskSignals ?? 0) + n }
  if (vt)  addRisk((vt.malicious ?? 0) + (vt.suspicious ?? 0))
  if (abu) addRisk(abu.abuse_confidence_score >= 25 ? 1 : 0)
  if (sho) addRisk((sho.vulns?.length ?? 0) + (sho.tags ?? []).filter(t => RISKY_SHODAN_TAGS.includes(t.toLowerCase())).length)
  if (tls) addRisk(tls.warnings?.length ?? 0)
  if (dns) addRisk(dns.registered_variants?.length ?? 0)
  if (sb)  addRisk(sb.flagged ? 1 : 0)

  const metrics: FootprintMetrics = {
    subdomains: crt ? crt.subdomains.length : null,
    certificates: crt ? crt.certificate_count : null,
    lookalikes: dns ? dns.registered_variants.length : null,
    lookalikeCandidates: dns ? dns.candidates_checked : null,
    ips,
    hostnames: sho ? sho.hostnames : null,
    openPorts: sho ? sho.ports : null,
    cves: sho ? sho.vulns : null,
    tags: sho ? sho.tags : null,
    vtFlagged: vt ? vt.malicious + vt.suspicious : null,
    abuseScore: abu ? abu.abuse_confidence_score : null,
    safeBrowsingFlagged: sb ? sb.flagged : null,
    tlsWarnings: tls ? (tls.warnings?.length ?? 0) : null,
    riskSignals,
  }

  return {
    hasAnyResult: sources.some(s => s.state !== 'notRun'),
    sources, bySkill, groups, metrics,
    withData: sources.filter(s => s.state === 'data').length,
    total: sources.length,
  }
}

/** Estado del paso "Huella Digital" (fase paralela del backend). */
export function getFootprintStepStatus(scan: ScanLike): ToolRunStatus {
  return stepStatus(scan, 'Huella Digital')
}

// ─── TLS: hallazgos por severidad (para SeverityBars) ────────────────────────

export interface TlsSeverityBreakdown {
  critical: number; high: number; medium: number; low: number; info: number
}

/**
 * Cuenta los hallazgos con severidad de advertencia de testssl.sh
 * (protocolos + vulnerabilidades + defaults del servidor). OK/INFO/DEBUG no
 * cuentan: `info` queda en 0 a propósito (serían decenas de líneas informativas).
 */
export function getTlsSeverityBreakdown(tls: TestSSLResult): TlsSeverityBreakdown {
  const out: TlsSeverityBreakdown = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  const items = [...(tls.protocols ?? []), ...(tls.vulnerabilities ?? []), ...(tls.server_defaults ?? [])]
  for (const item of items) {
    switch (item.severity) {
      case 'CRITICAL': case 'FATAL': out.critical++; break
      case 'HIGH': out.high++; break
      case 'MEDIUM': case 'WARN': out.medium++; break
      case 'LOW': out.low++; break
    }
  }
  return out
}

// ─── Cobertura Registry ↔ extractores (aviso en desarrollo) ──────────────────

export function assertExtractorCoverage(): void {
  if (process.env.NODE_ENV === 'production') return
  for (const s of getPentestingSkills()) {
    if (!PENTEST_EXTRACTORS[s.id]) console.warn(`[scan-extractors] La Skill de Pentesting "${s.id}" no tiene extractor.`)
  }
  for (const s of getFootprintSkills()) {
    if (!FOOTPRINT_KEYS[s.id]) console.warn(`[scan-extractors] La Skill de Huella Digital "${s.id}" no tiene clave en threat_intel.`)
  }
}

// Aviso en desarrollo si el Registry y los extractores se desincronizan.
assertExtractorCoverage()
