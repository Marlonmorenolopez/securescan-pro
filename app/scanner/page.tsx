'use client'
// app/scanner/page.tsx — SecureScan Pro v5.0 · Dashboard SOC
//
// Semana 4: Transformación visual en Security Operations Center.
// Toda la lógica (extractSeverityCounts, extractToolStats, useScan,
// ScanProvider) se preserva intacta. Solo cambia la presentación:
//   - KPI cards con CyberStat y contadores animados
//   - ToolGrid con estado visual por herramienta
//   - GlobalScore con gauge SVG y barras de severidad cyber
//   - LabsBar con indicadores pulsantes
//   - Skeletons mejorados
//   - Fondo cyber-grid en el hero del scanner

import { Suspense, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Header }           from '@/components/header'
import { ScanForm }         from '@/components/scan-form'
import { ScanProgress }     from '@/components/scan-progress'
import { ResultsDashboard } from '@/components/results-dashboard'
import { ScanProvider, useScan } from '@/lib/scan-context'
import { CyberCard }   from '@/components/cyber/CyberCard'
import { CyberBadge }  from '@/components/cyber/CyberBadge'
import { RiskGauge }   from '@/components/cyber/RiskGauge'
import type { SecurityScore } from '@/lib/api-client'
import { staggerContainer, staggerItem, getVariants } from '@/lib/motion'
import {
  WappalyzerIcon, NmapIcon, GobusterIcon, FfufIcon,
  ZapIcon as ZapToolIcon, NucleiIcon, SqlmapIcon,
  SearchsploitIcon, MetasploitIcon, PatatorIcon,
} from '@/components/tool-icons'
import {
  Loader2, Shield, AlertTriangle,
  Layers, Network, Key, Skull, Wind, Search,
  Zap, Target, Database, FileText, ExternalLink,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'informational'

interface ToolStat {
  id:     string
  name:   string
  icon:   React.ElementType
  svgIcon?: React.FC<{ className?: string }>
  color:  string
  count:  number
  status: 'idle' | 'running' | 'completed' | 'error' | 'skipped'
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bar: string; dot: string }> = {
  critical:      { label: 'Critical', color: 'text-red-400',    bar: 'bg-red-500',    dot: 'bg-red-500'    },
  high:          { label: 'High',     color: 'text-orange-400', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  medium:        { label: 'Medium',   color: 'text-amber-400',  bar: 'bg-amber-500',  dot: 'bg-amber-400'  },
  low:           { label: 'Low',      color: 'text-blue-400',   bar: 'bg-blue-500',   dot: 'bg-blue-400'   },
  info:          { label: 'Info',     color: 'text-slate-400',  bar: 'bg-slate-500',  dot: 'bg-slate-400'  },
  informational: { label: 'Info',     color: 'text-slate-400',  bar: 'bg-slate-500',  dot: 'bg-slate-400'  },
}

const TOOL_META: Omit<ToolStat, 'count' | 'status'>[] = [
  { id: 'wappalyzer',   name: 'Wappalyzer',  icon: Layers,   svgIcon: WappalyzerIcon,  color: 'text-blue-400'   },
  { id: 'nmap',         name: 'Nmap',         icon: Network,  svgIcon: NmapIcon,        color: 'text-cyan-400'   },
  { id: 'patator',      name: 'Patator',      icon: Key,      svgIcon: PatatorIcon,     color: 'text-lime-400'   },
  { id: 'metasploit',   name: 'Metasploit',   icon: Skull,    svgIcon: MetasploitIcon,  color: 'text-violet-400' },
  { id: 'ffuf',         name: 'ffuf',         icon: Wind,     svgIcon: FfufIcon,        color: 'text-sky-400'    },
  { id: 'gobuster',     name: 'Gobuster',     icon: Search,   svgIcon: GobusterIcon,    color: 'text-teal-400'   },
  { id: 'zap',          name: 'OWASP ZAP',    icon: Zap,      svgIcon: ZapToolIcon,     color: 'text-blue-400'   },
  { id: 'nuclei',       name: 'Nuclei',       icon: Target,   svgIcon: NucleiIcon,      color: 'text-purple-400' },
  { id: 'sqlmap',       name: 'SQLMap',       icon: Database, svgIcon: SqlmapIcon,      color: 'text-red-400'    },
  { id: 'searchsploit', name: 'Searchsploit', icon: FileText, svgIcon: SearchsploitIcon,color: 'text-amber-400'  },
]

const LAB_APPS = [
  { name: 'Juice Shop', host: 'juice-shop:3000', url: 'http://localhost:3001', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  { name: 'DVWA',       host: 'dvwa:80',          url: 'http://localhost:3002', color: 'text-orange-400', dot: 'bg-orange-500'  },
  { name: 'WebGoat',    host: 'webgoat:8080',     url: 'http://localhost:3003', color: 'text-blue-400',   dot: 'bg-blue-500'    },
]

// ─── Helpers (sin cambios respecto a la versión anterior) ─────────────────────

function extractSeverityCounts(scan: any): Record<Severity, number> {
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

function extractToolStats(scan: any): ToolStat[] {
  const steps: any[] = scan?.steps ?? []
  const results = scan ?? {}
  return TOOL_META.map(meta => {
    const step   = steps.find((s: any) =>
      s.tool === meta.id || s.id === meta.id || s.name?.toLowerCase() === meta.name.toLowerCase()
    )
    const status = step?.status ?? 'idle'
    let count = 0
    if (meta.id === 'zap')          count = results.vulnerabilities?.length ?? results.zap_vulnerabilities?.length ?? 0
    if (meta.id === 'nuclei')       count = results.nuclei_findings?.length ?? 0
    if (meta.id === 'sqlmap')       count = results.sqli_results?.length ?? results.sqlmap_results?.length ?? 0
    if (meta.id === 'nmap')         count = results.ports?.length ?? 0
    if (meta.id === 'gobuster')     count = results.directories?.length ?? 0
    if (meta.id === 'ffuf')         count = results.ffuf_endpoints?.length ?? 0
    if (meta.id === 'wappalyzer')   count = results.technologies?.length ?? 0
    if (meta.id === 'searchsploit') count = results.exploits?.length ?? results.searchsploit_results?.length ?? 0
    if (meta.id === 'patator')      count = results.brute_force_results?.filter((r: any) => r.success)?.length ?? 0
    if (meta.id === 'metasploit')   count = results.metasploit?.length ?? results.msf_results?.length ?? 0
    return { ...meta, count, status }
  })
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards({ counts, toolStats }: {
  counts:    Record<Severity, number>
  toolStats: ToolStat[]
}) {
  const completed = toolStats.filter(t => t.status === 'completed').length
  const total     = toolStats.length

  const kpis = [
    { label: 'Critical',   value: counts.critical,      color: 'text-red-400',    border: 'border-red-900/50',    bg: 'bg-red-500/5'    },
    { label: 'High',       value: counts.high,          color: 'text-orange-400', border: 'border-orange-900/50', bg: 'bg-orange-500/5' },
    { label: 'Medium',     value: counts.medium,        color: 'text-amber-400',  border: 'border-amber-900/50',  bg: 'bg-amber-500/5'  },
    { label: 'Low',        value: counts.low,           color: 'text-blue-400',   border: 'border-blue-900/50',   bg: 'bg-blue-500/5'   },
    { label: 'Completadas',value: completed,             color: 'text-emerald-400',border: 'border-emerald-900/50',bg: 'bg-emerald-500/5' },
    { label: 'Total Hallazgos', value: Object.values(counts).reduce((a,b)=>a+b,0), color: 'text-[var(--cyber-accent)]', border: 'border-[rgba(var(--cyber-accent-rgb),0.20)]', bg: 'bg-[rgba(var(--cyber-accent-rgb),0.04)]' },
  ]

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {kpis.map((kpi) => (
        <motion.div key={kpi.label} variants={staggerItem}>
          <AnimatedKpiCard {...kpi} total={total} />
        </motion.div>
      ))}
    </motion.div>
  )
}

function AnimatedKpiCard({ label, value, color, border, bg }: {
  label: string; value: number; color: string; border: string; bg: string; total?: number
}) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    const duration = 700
    const start    = performance.now()
    const from     = displayed
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const e = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(from + (value - from) * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className={cn(
      'relative flex flex-col gap-1 rounded-lg border p-4 transition-all duration-300',
      'hover:shadow-cyber-sm corner-brackets',
      border, bg
    )}>
      <span className={cn('font-mono text-2xl font-bold tabular-nums leading-none', color)}>
        {displayed.toLocaleString()}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground leading-tight">
        {label}
      </span>
    </div>
  )
}

// ─── Labs Bar ─────────────────────────────────────────────────────────────────
function LabsBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Labs →</span>
      {LAB_APPS.map(lab => (
        <a
          key={lab.name}
          href={lab.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))]',
            'bg-[hsl(var(--card))] px-3 py-1 font-mono text-xs transition-all duration-200',
            'hover:border-[rgba(var(--cyber-accent-rgb),0.35)] hover:shadow-cyber-sm',
            lab.color
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full animate-[cyber-pulse_2s_ease-in-out_infinite]', lab.dot)} />
          {lab.name}
          <ExternalLink className="h-2.5 w-2.5 opacity-50" />
        </a>
      ))}
    </div>
  )
}

// ─── Global Score ─────────────────────────────────────────────────────────────
// Usa EXACTAMENTE el mismo score real (currentScan.score, calculado por
// scoring.py en el backend) que ScoreCard en results-dashboard.tsx — una sola
// fuente de verdad para todo el Scanner, sin heurísticas duplicadas en el
// cliente que puedan no coincidir con el cálculo real.

const RISK_LEVEL_STYLE: Record<string, { label: string; color: string; emoji: string }> = {
  COMPROMETIDO: { label: 'Comprometido', color: 'text-red-400',     emoji: '☠️'  },
  EXPUESTO:     { label: 'Expuesto',     color: 'text-orange-400',  emoji: '🚨' },
  VULNERABLE:   { label: 'Vulnerable',   color: 'text-amber-400',   emoji: '⚠️'  },
  PROTEGIDO:    { label: 'Protegido',    color: 'text-emerald-400', emoji: '🛡️'  },
  // compatibilidad con valores anteriores
  CRITICAL: { label: 'Comprometido', color: 'text-red-400',     emoji: '☠️'  },
  HIGH:     { label: 'Expuesto',     color: 'text-orange-400',  emoji: '🚨' },
  MEDIUM:   { label: 'Vulnerable',   color: 'text-amber-400',   emoji: '⚠️'  },
  LOW:      { label: 'Vulnerable',   color: 'text-blue-400',    emoji: '⚠️'  },
  MINIMAL:  { label: 'Protegido',    color: 'text-emerald-400', emoji: '🛡️'  },
}

function GlobalScore({ score, counts }: { score: SecurityScore; counts: Record<Severity, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const risk  = RISK_LEVEL_STYLE[score.riskLevel] ?? RISK_LEVEL_STYLE.MINIMAL

  return (
    <CyberCard padding="p-5" glow>
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        Riesgo Global
      </p>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={cn('font-mono text-xs font-semibold', risk.color)}>
            {risk.label}
          </p>
        </div>
        <RiskGauge total={score.total} grade={score.grade} size={64} strokeWidth={6} />
      </div>

      {/* Barras de severidad */}
      {total > 0 && (
        <div className="mt-4 space-y-2">
          {(Object.entries(counts) as [Severity, number][])
            .filter(([k, n]) => n > 0 && k !== 'informational')
            .map(([sev, n]) => {
              const cfg = SEVERITY_CONFIG[sev]
              return (
                <div key={sev} className="flex items-center gap-2">
                  <span className={cn('w-12 font-mono text-[10px]', cfg.color)}>{cfg.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/30">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                      style={{ width: `${Math.min(100, (n / total) * 100)}%` }}
                    />
                  </div>
                  <span className={cn('w-5 text-right font-mono text-[10px] font-bold', cfg.color)}>{n}</span>
                </div>
              )
            })}
        </div>
      )}

      {total === 0 && (
        <div className="mt-4 flex items-center justify-center gap-1.5 font-mono text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sin hallazgos detectados
        </div>
      )}
    </CyberCard>
  )
}

// ─── Tool Grid ────────────────────────────────────────────────────────────────
function ToolGrid({ stats }: { stats: ToolStat[] }) {
  return (
    <CyberCard padding="p-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        Estado de Herramientas
      </p>
      <motion.div
        className="grid grid-cols-2 gap-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {stats.map(tool => {
          const SvgIcon = tool.svgIcon
          const LucideIcon = tool.icon

          const statusIcon =
            tool.status === 'completed' ? <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" /> :
            tool.status === 'error'     ? <XCircle      className="h-3 w-3 text-red-500 shrink-0"     /> :
            tool.status === 'running'   ? <Loader2      className="h-3 w-3 animate-spin text-[var(--cyber-accent)] shrink-0" /> :
                                          <Clock        className="h-3 w-3 text-muted-foreground/40 shrink-0" />

          const rowBg =
            tool.status === 'running'   ? 'bg-[rgba(var(--cyber-accent-rgb),0.06)] border-[rgba(var(--cyber-accent-rgb),0.20)]' :
            tool.status === 'completed' ? 'bg-emerald-500/5 border-emerald-900/30' :
            tool.status === 'error'     ? 'bg-red-500/5 border-red-900/30' :
            'bg-transparent border-transparent'

          return (
            <motion.div
              key={tool.id}
              layout
              variants={staggerItem}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors duration-200',
                rowBg
              )}
            >
              {/* Icono herramienta */}
              <div className="shrink-0">
                {SvgIcon
                  ? <SvgIcon className={cn('h-3.5 w-3.5', tool.color)} />
                  : <LucideIcon className={cn('h-3.5 w-3.5', tool.color)} />
                }
              </div>

              {/* Nombre */}
              <span className="flex-1 truncate font-mono text-[10px] text-foreground/75">
                {tool.name}
              </span>

              {/* Conteo */}
              {tool.count > 0 && (
                <span className={cn('font-mono text-[10px] font-bold tabular-nums shrink-0', tool.color)}>
                  {tool.count}
                </span>
              )}

              {/* Estado */}
              {statusIcon}
            </motion.div>
          )
        })}
      </motion.div>
    </CyberCard>
  )
}

// ─── Skeleton SOC ─────────────────────────────────────────────────────────────
function ScannerSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-7xl space-y-8 px-4">
          <div className="space-y-3 text-center">
            <div className="mx-auto h-6 w-64 animate-pulse rounded-full bg-muted/40" />
            <div className="mx-auto h-10 w-96 animate-pulse rounded-lg bg-muted/40" />
            <div className="mx-auto h-4 w-80 animate-pulse rounded bg-muted/30" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
          <div className="mx-auto h-56 max-w-3xl animate-pulse rounded-xl bg-muted/40" />
        </div>
      </main>
    </div>
  )
}

// ─── Error ────────────────────────────────────────────────────────────────────
function ScannerError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-2xl space-y-6 px-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error en el Scanner</AlertTitle>
            <AlertDescription>
              {error.message || 'Ha ocurrido un error inesperado.'}
            </AlertDescription>
          </Alert>
          <CyberCard className="space-y-4">
            <p className="font-mono text-sm font-semibold text-foreground">Verifica que estén activos:</p>
            <ul className="space-y-2">
              {[
                ['Backend Flask',  'http://localhost:5000'],
                ['Redis',          'localhost:6379'],
                ['Docker Compose', 'docker compose ps'],
              ].map(([label, hint]) => (
                <li key={label} className="flex items-center gap-2 font-mono text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">{label}</span>
                  <code className="ml-auto rounded bg-muted px-2 py-0.5 text-muted-foreground">{hint}</code>
                </li>
              ))}
            </ul>
            <button
              onClick={reset}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Reintentar
            </button>
          </CyberCard>
        </div>
      </main>
    </div>
  )
}

// ─── Contenido principal SOC ──────────────────────────────────────────────────
function ScannerContent() {
  const { currentScan, error, clearError, isLoading } = useScan()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (currentScan?.status === 'completed' || currentScan?.status === 'error') {
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 300)
    }
  }, [currentScan?.status])

  const isCompleted = currentScan?.status === 'completed'
  const isRunning   = currentScan?.status === 'running' || currentScan?.status === 'pending'
  const showResults = isCompleted || currentScan?.status === 'error'

  const severityCounts = useMemo(() =>
    isCompleted
      ? extractSeverityCounts(currentScan)
      : { critical: 0, high: 0, medium: 0, low: 0, info: 0, informational: 0 },
    [currentScan, isCompleted]
  )

  const toolStats = useMemo(() =>
    currentScan ? extractToolStats(currentScan) : TOOL_META.map(m => ({ ...m, count: 0, status: 'idle' as const })),
    [currentScan]
  )

  if (!mounted) return <ScannerSkeleton />

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

          {/* ── Hero del scanner ── */}
          <div className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-8 text-center">
            <div className="cyber-grid-bg pointer-events-none absolute inset-0 opacity-50" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_50%_0%,rgba(var(--cyber-accent-rgb),0.08),transparent)]" />
            <div className="relative space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--cyber-accent-rgb),0.25)] bg-[rgba(var(--cyber-accent-rgb),0.06)] px-4 py-1.5">
                <Shield className="h-3.5 w-3.5 text-[var(--cyber-accent)]" />
                <span className="font-mono text-xs tracking-widest text-[var(--cyber-accent)] uppercase">
                  SecureScan Pro v5.0 · 10 Herramientas Activas
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Análisis de Vulnerabilidades
              </h1>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Pipeline automatizado: Wappalyzer → Nmap → Patator → Metasploit →
                ffuf → Gobuster → ZAP → Nuclei → SQLMap → Searchsploit
              </p>
              <LabsBar />
            </div>
          </div>

          {/* ── Error global ── */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <button onClick={clearError} className="shrink-0 text-xs underline hover:no-underline">
                  Cerrar
                </button>
              </AlertDescription>
            </Alert>
          )}

          {/* ── KPI cards — siempre visibles cuando hay escaneo ── */}
          {(currentScan || isCompleted) && (
            <KpiCards counts={severityCounts} toolStats={toolStats} />
          )}

          {/* ── Formulario ── */}
          <div className="mx-auto w-full max-w-3xl">
            <ScanForm />
          </div>

          {/* ── Iniciando ── */}
          {isLoading && !currentScan && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--cyber-accent)]" />
              <p className="font-mono text-sm">Iniciando pipeline de escaneo...</p>
            </div>
          )}

          {/* ── Layout principal: progreso + score + tool grid ── */}
          {currentScan && (
            <div className={cn(
              'grid gap-6',
              isCompleted ? 'lg:grid-cols-3' : 'grid-cols-1'
            )}>
              {/* Columna izquierda: progreso (2/3) */}
              <div className={isCompleted ? 'lg:col-span-2' : ''}>
                <ScanProgress />
              </div>

              {/* Columna derecha: score + tool grid (1/3) */}
              {isCompleted && (
                <div className="flex flex-col gap-4">
                  {currentScan.score && (
                    <GlobalScore score={currentScan.score} counts={severityCounts} />
                  )}
                  <ToolGrid stats={toolStats} />
                </div>
              )}

              {/* Tool grid durante escaneo (fila completa) */}
              {isRunning && (
                <div className="lg:col-span-3">
                  <ToolGrid stats={toolStats} />
                </div>
              )}
            </div>
          )}

          {/* ── Resultados completos ── */}
          {showResults && (
            <section className="w-full">
              <ResultsDashboard />
            </section>
          )}

          {/* ── Estado vacío ── */}
          {!currentScan && !isLoading && (
            <div className="py-16 text-center">
              <Shield className="mx-auto mb-4 h-14 w-14 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                Introduce una URL objetivo para comenzar el análisis.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {LAB_APPS.map(lab => (
                  <code key={lab.name}
                    className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {lab.host}
                  </code>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="mt-auto border-t border-[hsl(var(--border))] py-5">
        <div className="container mx-auto px-4 text-center font-mono text-xs text-muted-foreground">
          <p>SecureScan Pro v5.0 · Proyecto Académico SENA</p>
          <p className="mt-0.5 opacity-50">Solo para uso ético y autorizado en entornos de prueba</p>
        </div>
      </footer>
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function ScannerPage() {
  const [error, setError] = useState<Error | null>(null)
  const reset = () => { setError(null); window.location.reload() }
  if (error) return <ScannerError error={error} reset={reset} />
  return (
    <ScanProvider>
      <Suspense fallback={<ScannerSkeleton />}>
        <ScannerContent />
      </Suspense>
    </ScanProvider>
  )
}
