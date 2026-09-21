'use client'
// app/scanner/page.tsx — SecureScan Pro v5.0 · Pentesting
//
// Experiencia dedicada a PENTESTING: evaluación de seguridad, reconocimiento,
// enumeración, web security, autenticación, SQL injection y explotación con
// las 12 herramientas reales del Skill Registry (lib/skills.ts). El estado y
// los resultados reales del análisis vienen de ScanProvider (ahora en
// app/layout.tsx, compartido con /footprint) a través de
// lib/scan-extractors.ts, que deriva las herramientas del Registry en vez de
// duplicar la lista aquí. Los resultados de Huella Digital que ese mismo
// análisis puede traer (threat_intel) NO se presentan en esta página — ver
// /footprint.

import { Suspense, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Header }           from '@/components/header'
import { ScanForm }         from '@/components/scan-form'
import { ScanProgress }     from '@/components/scan-progress'
import { ResultsDashboard } from '@/components/results-dashboard'
import { useScan } from '@/lib/scan-context'
import { CyberCard }   from '@/components/cyber/CyberCard'
import { RiskGauge }   from '@/components/cyber/RiskGauge'
import { ToolCard } from '@/components/cyber/ToolCard'
import { ToolDetailDrawer } from '@/components/cyber/ToolDetailDrawer'
import { ModuleHeader } from '@/components/cyber/ModuleHeader'
import { PENTESTING } from '@/lib/nav-config'
import { useNavDescription } from '@/lib/nav-i18n'
import { getToolDocs, getSkillSvgIcon } from '@/lib/tool-docs'
import {
  getPentestingToolStats, extractSeverityCounts, getScanScope,
  type Severity, type PentestToolStat,
} from '@/lib/scan-extractors'
import { useTranslations } from 'next-intl'
import type { SecurityScore } from '@/lib/api-client'
import { staggerContainer, staggerItem } from '@/lib/motion'
import {
  Loader2, Shield, AlertTriangle, ExternalLink, CheckCircle2, ArrowRight,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

// ─── Constantes ───────────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bar: string; dot: string }> = {
  critical:      { label: 'Critical', color: 'text-red-400',    bar: 'bg-red-500',    dot: 'bg-red-500'    },
  high:          { label: 'High',     color: 'text-orange-400', bar: 'bg-orange-500', dot: 'bg-orange-500' },
  medium:        { label: 'Medium',   color: 'text-amber-400',  bar: 'bg-amber-500',  dot: 'bg-amber-400'  },
  low:           { label: 'Low',      color: 'text-blue-400',   bar: 'bg-blue-500',   dot: 'bg-blue-400'   },
  info:          { label: 'Info',     color: 'text-slate-400',  bar: 'bg-slate-500',  dot: 'bg-slate-400'  },
  informational: { label: 'Info',     color: 'text-slate-400',  bar: 'bg-slate-500',  dot: 'bg-slate-400'  },
}

const LAB_APPS = [
  { name: 'Juice Shop', host: 'juice-shop:3000', url: 'http://localhost:3001', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  { name: 'DVWA',       host: 'dvwa:80',          url: 'http://localhost:3002', color: 'text-orange-400', dot: 'bg-orange-500'  },
  { name: 'WebGoat',    host: 'webgoat:8080',     url: 'http://localhost:3003', color: 'text-blue-400',   dot: 'bg-blue-500'    },
]

// ─── KPI Cards ────────────────────────────────────────────────────────────────
function KpiCards({ counts, toolStats }: {
  counts:    Record<Severity, number>
  toolStats: PentestToolStat[]
}) {
  const completed = toolStats.filter(t => t.status === 'completed').length
  const total     = toolStats.length

  const t = useTranslations('scanner')
  const kpis = [
    { label: t('kpi.critical'),   value: counts.critical,      color: 'text-red-400',    border: 'border-red-900/50',    bg: 'bg-red-500/5'    },
    { label: t('kpi.high'),       value: counts.high,          color: 'text-orange-400', border: 'border-orange-900/50', bg: 'bg-orange-500/5' },
    { label: t('kpi.medium'),     value: counts.medium,        color: 'text-amber-400',  border: 'border-amber-900/50',  bg: 'bg-amber-500/5'  },
    { label: t('kpi.low'),        value: counts.low,           color: 'text-blue-400',   border: 'border-blue-900/50',   bg: 'bg-blue-500/5'   },
    { label: t('kpi.completed'),  value: completed,             color: 'text-emerald-400',border: 'border-emerald-900/50',bg: 'bg-emerald-500/5' },
    { label: t('kpi.totalFindings'), value: Object.values(counts).reduce((a,b)=>a+b,0), color: 'text-[var(--cyber-accent)]', border: 'border-[rgba(var(--cyber-accent-rgb),0.20)]', bg: 'bg-[rgba(var(--cyber-accent-rgb),0.04)]' },
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
  const t = useTranslations('scanner')
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t('labs')} →</span>
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

// Claves traducidas en messages/{es,en}.json → scanner.riskLevel.<clave>
const RISK_LEVEL_STYLE: Record<string, { color: string }> = {
  COMPROMETIDO: { color: 'text-red-400' },
  EXPUESTO:     { color: 'text-orange-400' },
  VULNERABLE:   { color: 'text-amber-400' },
  PROTEGIDO:    { color: 'text-emerald-400' },
  // compatibilidad con valores anteriores
  CRITICAL: { color: 'text-red-400' },
  HIGH:     { color: 'text-orange-400' },
  MEDIUM:   { color: 'text-amber-400' },
  LOW:      { color: 'text-blue-400' },
  MINIMAL:  { color: 'text-emerald-400' },
}

function GlobalScore({ score, counts }: { score: SecurityScore; counts: Record<Severity, number> }) {
  const t = useTranslations('scanner')
  const tRisk = useTranslations('scanner.riskLevel')
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const riskKey = score.riskLevel in RISK_LEVEL_STYLE ? score.riskLevel : 'MINIMAL'
  const risk  = RISK_LEVEL_STYLE[riskKey]

  return (
    <CyberCard padding="p-5" glow>
      <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {t('globalRisk')}
      </p>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={cn('font-mono text-xs font-semibold', risk.color)}>
            {tRisk(riskKey)}
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
          {t('noFindings')}
        </div>
      )}
    </CyberCard>
  )
}

// ─── Tool Grid ────────────────────────────────────────────────────────────────
function ToolGrid({ stats, onSelectTool }: { stats: PentestToolStat[]; onSelectTool: (id: string) => void }) {
  const t = useTranslations('scanner')
  return (
    <CyberCard padding="p-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {t('toolStateTitle')}
      </p>
      <motion.div
        className="grid grid-cols-2 gap-2"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {stats.map(({ skill, status, count }) => (
          <motion.div key={skill.id} layout variants={staggerItem}>
            <ToolCard
              compact
              name={skill.name}
              icon={skill.icon}
              svgIcon={getSkillSvgIcon(skill.id)}
              color="cyan"
              status={status}
              resultLabel={count > 0 ? String(count) : undefined}
              onClick={() => onSelectTool(skill.id)}
            />
          </motion.div>
        ))}
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
  const tError = useTranslations('scanner.errorPage')
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-2xl space-y-6 px-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{tError('title')}</AlertTitle>
            <AlertDescription>
              {error.message || tError('unexpected')}
            </AlertDescription>
          </Alert>
          <CyberCard className="space-y-4">
            <p className="font-mono text-sm font-semibold text-foreground">{tError('checklist')}</p>
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
              {tError('retry')}
            </button>
          </CyberCard>
        </div>
      </main>
    </div>
  )
}

// ─── Contenido principal SOC ──────────────────────────────────────────────────
function ScannerContent() {
  const { currentScan: latestScan, error, clearError, isLoading } = useScan()
  // El estado del análisis es compartido con /footprint. Un análisis lanzado
  // desde Huella Digital SIN herramientas de Pentesting no es un resultado de
  // Pentesting: aquí no se presenta como tal (se avisa y se enlaza).
  const currentScan = latestScan && getScanScope(latestScan).pentesting ? latestScan : null
  const footprintOnlyScan = latestScan && !currentScan ? latestScan : null
  const [mounted, setMounted] = useState(false)
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const tDocs = useTranslations()
  const t = useTranslations('scanner')
  const description = useNavDescription(PENTESTING)
  const toolDocs = useMemo(() => getToolDocs(tDocs), [tDocs])

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

  const toolStats = useMemo(() => getPentestingToolStats(currentScan), [currentScan])
  const scope = useMemo(() => getScanScope(currentScan), [currentScan])

  if (!mounted) return <ScannerSkeleton />

  const selectedTool = toolStats.find(ts => ts.skill.id === selectedToolId)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

          <ModuleHeader
            section={PENTESTING}
            title={t('heroTitle')}
            description={description}
          >
            <p className="font-mono text-xs text-muted-foreground">
              {t('heroPipeline')}
            </p>
            <div className="mt-3">
              <LabsBar />
            </div>
          </ModuleHeader>

          {/* ── Error global ── */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('errorTitle')}</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <button onClick={clearError} className="shrink-0 text-xs underline hover:no-underline">
                  {t('close')}
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

          {/* ── Análisis de solo Huella Digital (no es un resultado de Pentesting) ── */}
          {footprintOnlyScan && (
            <CyberCard variant="ghost" padding="p-4" className="mx-auto w-full max-w-3xl border-[rgba(var(--cyber-accent-rgb),0.20)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {t('footprintOnlyNotice', { target: footprintOnlyScan.target })}
                </p>
                <Link
                  href="/footprint"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(var(--cyber-accent-rgb),0.35)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--cyber-accent)] transition-colors hover:bg-[rgba(var(--cyber-accent-rgb),0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]"
                >
                  {t('footprintOnlyAction')} <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            </CyberCard>
          )}

          {/* ── Iniciando ── */}
          {isLoading && !latestScan && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--cyber-accent)]" />
              <p className="font-mono text-sm">{t('startingPipeline')}</p>
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
                  <ToolGrid stats={toolStats} onSelectTool={setSelectedToolId} />
                </div>
              )}

              {/* Tool grid durante escaneo (fila completa) */}
              {isRunning && (
                <div className="lg:col-span-3">
                  <ToolGrid stats={toolStats} onSelectTool={setSelectedToolId} />
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

          {/* ── Huella Digital: aviso solo si este análisis no la incluyó ── */}
          {isCompleted && !scope.footprint && (
            <p className="text-center font-mono text-xs text-muted-foreground">
              {t('footprintNotIncluded')}
            </p>
          )}

          {/* ── Estado vacío ── */}
          {!latestScan && !isLoading && (
            <div className="py-16 text-center">
              <Shield className="mx-auto mb-4 h-14 w-14 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                {t('emptyState')}
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
          <p>{t('footerBrand')}</p>
          <p className="mt-0.5 opacity-50">{t('footerLegal')}</p>
        </div>
      </footer>

      <ToolDetailDrawer
        open={!!selectedToolId}
        onClose={() => setSelectedToolId(null)}
        doc={toolDocs.find(d => d.id === selectedToolId)}
        name={selectedTool?.skill.name ?? selectedToolId ?? ''}
        color="cyan"
        status={selectedTool?.status ?? 'idle'}
        resultLabel={selectedTool && selectedTool.count > 0 ? String(selectedTool.count) : undefined}
        target={currentScan?.target}
      />
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function ScannerPage() {
  const [error, setError] = useState<Error | null>(null)
  const reset = () => { setError(null); window.location.reload() }
  if (error) return <ScannerError error={error} reset={reset} />
  return (
    <Suspense fallback={<ScannerSkeleton />}>
      <ScannerContent />
    </Suspense>
  )
}
