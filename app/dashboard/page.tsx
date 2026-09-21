'use client'
// app/dashboard/page.tsx — SecureScan Pro v5.0 · Cyber Security Command Center
//
// FASE 3: reorganización visual sobre el Design System de Fase 2
// (surface-0/1/2/3, glow-*, border-cyber/*). Reutiliza CyberStat (existía
// pero no se usaba en ningún lado — encaja perfecto con la jerarquía
// LABEL→VALOR→CONTEXTO→INDICADOR pedida). Toda la lógica de datos
// (getDashboardStats, loading/error/stats) queda IDÉNTICA a como estaba.
//
// Decisión de diseño documentada: se evaluó usar ThreatMap para la sección
// central de "actividad", pero se descartó — es un componente ilustrativo
// genérico (mapa mundial ficticio, sin relación con los datos reales del
// usuario) pensado para el landing. Usarlo aquí habría sido exactamente el
// tipo de "animación decorativa sin significado" que esta fase pide evitar.
// En su lugar, la sección central usa los datos reales ya existentes
// (severidad agregada + actividad por módulo), con más peso visual.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Loader2, AlertTriangle, Code2, Search, Globe,
  Activity, ExternalLink, Sparkles, ShieldCheck,
} from 'lucide-react'
import { Header } from '@/components/header'
import { useTranslations } from 'next-intl'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberStat } from '@/components/cyber/CyberStat'
import { RiskGauge } from '@/components/cyber/RiskGauge'
import { SecurityMetrics } from '@/components/cyber/SecurityMetrics'
import { EmptyState } from '@/components/cyber/EmptyState'
import { CategoryCard } from '@/components/cyber/CategoryCard'
import { getDashboardStats } from '@/lib/api-client'
import type { DashboardStats } from '@/lib/api-client'
import {
  PENTESTING, OSINT, HUELLA_DIGITAL, CODE_SECURITY, LABS, ANALYSIS,
  OPERATIONS, OPERATIONS_LEAVES, COLOR_VARS, type NavSection, type NavLeaf,
} from '@/lib/nav-config'
import { useNavLabel, useNavDescription, useLeafLabel } from '@/lib/nav-i18n'
import { fadeIn, slideInUp, staggerContainer, staggerItem, getVariants } from '@/lib/motion'
import { useReducedMotion } from 'framer-motion'

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const FAMILY_META: Record<string, { label: string; icon: typeof Globe }> = {
  web:   { label: 'Web Scan',   icon: Globe },
  code:  { label: 'Code Scan',  icon: Code2 },
  osint: { label: 'OSINT',      icon: Search },
}

function statusBadgeType(status: string): 'completed' | 'error' | 'running' {
  if (status === 'completed') return 'completed'
  if (status === 'error' || status === 'failed') return 'error'
  return 'running'
}

// Conteo de herramientas por sección — derivado del catálogo estático del
// frontend (lib/nav-config, que a su vez deriva de lib/skills.ts), NUNCA
// del backend.
function toolCount(section: typeof PENTESTING) {
  return section.groups.reduce((n, g) => n + g.tools.length, 0)
}

const OVERVIEW_STATS = [
  { section: PENTESTING,     count: toolCount(PENTESTING),     key: 'pentestingTools' as const },
  { section: HUELLA_DIGITAL, count: toolCount(HUELLA_DIGITAL), key: 'footprintTools' as const },
  { section: CODE_SECURITY,  count: toolCount(CODE_SECURITY),  key: 'codeSecurityTools' as const },
  { section: LABS,           count: toolCount(LABS),           key: 'labsAvailable' as const },
]

const CATEGORY_CARDS = [PENTESTING, HUELLA_DIGITAL, OSINT, CODE_SECURITY]

function StatChip({ section, count, statKey }: { section: NavSection; count: number; statKey: 'pentestingTools' | 'footprintTools' | 'codeSecurityTools' | 'labsAvailable' }) {
  const c = COLOR_VARS[section.color]
  const Icon = section.icon
  const tOverview = useTranslations('navCatalog.overview')

  return (
    <div
      className="surface-2 flex items-center gap-3 rounded-lg border p-3 transition-all duration-300 hover:-translate-y-px"
      style={{ borderColor: `rgba(${c.rgb},0.25)` }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ color: c.fg, background: `rgba(${c.rgb},0.12)` }}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="font-mono text-lg font-bold leading-none text-foreground">{count}+</div>
        <div className="truncate text-[10px] leading-tight text-muted-foreground">{tOverview(statKey)}</div>
      </div>
    </div>
  )
}

function OperationLeafLink({ leaf }: { leaf: NavLeaf }) {
  const label = useLeafLabel(leaf)
  const Icon = leaf.icon
  return (
    <Link
      href={leaf.href}
      className="surface-1 flex items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] p-3 text-xs transition-all duration-300 hover:-translate-y-px hover:border-[rgba(var(--cyber-accent-rgb),0.35)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
      <span className="truncate text-foreground">{label}</span>
    </Link>
  )
}

/** Indicador operacional del hero — deriva del estado REAL del fetch de
 *  stats (no de un health-check aparte, para no duplicar la llamada que
 *  ya hace el Header). loading→CHECKING, error→DEGRADED, ok→OPERATIONAL. */
function OperationalStatus({ loading, error }: { loading: boolean; error: string | null }) {
  const t = useTranslations('dashboard')
  const state = loading ? 'checking' : error ? 'degraded' : 'operational'
  const cfg = {
    checking:    { dot: 'bg-muted-foreground/50',            text: 'text-muted-foreground', label: t('statusChecking') },
    degraded:    { dot: 'bg-red-400 status-dot',              text: 'text-red-400',          label: t('statusDegraded') },
    operational: { dot: 'bg-emerald-400 status-dot',          text: 'text-emerald-400',      label: t('statusOperational') },
  }[state]

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-2.5 py-1">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${cfg.text}`}>{cfg.label}</span>
    </span>
  )
}

export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const tHero = useTranslations('dashboard')
  const operationsLabel = useNavLabel(OPERATIONS)
  const operationsDescription = useNavDescription(OPERATIONS)
  const prefersReduced = useReducedMotion() ?? false
  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getDashboardStats()
    if (err) setError(err.error)
    else setStats(data ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="surface-0 flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

          {/* ── COMMAND BAR / HERO ───────────────────────────────────── */}
          <motion.div
            variants={sv(fadeIn)} initial="hidden" animate="visible"
            className="holo-edge surface-3 relative overflow-hidden rounded-xl border border-[rgba(var(--cyber-accent-rgb),0.25)] p-6 sm:p-8"
          >
            <div
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(var(--cyber-accent-rgb),0.35), transparent 70%)' }}
            />
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(var(--cyber-accent-rgb),0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--cyber-accent-rgb),0.10) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
                maskImage: 'radial-gradient(ellipse at top right, black, transparent 70%)',
              }}
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--cyber-accent)]">
                <Sparkles className="h-4 w-4" />
                <span className="text-caption">{tHero('securityOverview')}</span>
              </div>
              <OperationalStatus loading={loading} error={error} />
            </div>
            <h1 className="text-h1 relative mt-2 text-foreground">
              {tHero('welcomePrefix')} <span className="text-[var(--cyber-accent)]">SecureScan Pro</span>
            </h1>
            <p className="text-body relative mt-1.5 max-w-2xl text-muted-foreground">
              {tHero('subtitle')}
            </p>

            <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OVERVIEW_STATS.map(({ section, count, key }) => (
                <StatChip key={section.id} section={section} count={count} statKey={key} />
              ))}
            </div>
          </motion.div>

          {/* ── ESTADOS DE CARGA / ERROR / VACÍO (datos reales) ──────── */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {tHero('loadingStats')}
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3 text-center">
              <EmptyState icon={AlertTriangle} title={tHero('loadErrorTitle')} detail={error} />
              <CyberButton size="sm" onClick={load}>{tHero('retry')}</CyberButton>
            </div>
          )}

          {!loading && !error && stats && stats.totalScans === 0 && (
            <EmptyState
              icon={Activity}
              title={tHero('emptyScansTitle')}
              detail={tHero('emptyScansDetail')}
            />
          )}

          {/* ── SECURITY POSTURE — el Security Score es el elemento principal ── */}
          {!loading && !error && stats && stats.totalScans > 0 && (
            <motion.div variants={sv(slideInUp)} initial="hidden" animate="visible" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-[var(--cyber-accent)]" />
                <div>
                  <h2 className="text-h2 text-foreground">{tHero('securityPosture')}</h2>
                  <p className="text-small">{tHero('securityPostureSubtitle')}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {/* Security Score — surface-3, elemento visual principal */}
                <CyberCard surface={3} glow className="flex flex-col items-center justify-center gap-3 lg:col-span-1">
                  <RiskGauge total={stats.averageScore} grade={stats.averageGrade} label={tHero('scoreAverage')} />
                  <CyberBadge type="completed" label={stats.riskLevel} size="sm" />
                </CyberCard>

                {/* Métricas — CyberStat, jerarquía label→valor→contexto */}
                <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-4">
                  <CyberCard surface={2} className="flex items-center justify-center">
                    <CyberStat label={tHero('statTotalScans')} value={stats.totalScans} color="cyber" icon={Activity} />
                  </CyberCard>
                  <CyberCard surface={2} className="flex items-center justify-center">
                    <CyberStat label={tHero('statTotalFindings')} value={stats.totalFindings} color="blue" icon={ShieldCheck} />
                  </CyberCard>
                  <CyberCard surface={2} className="flex items-center justify-center">
                    <CyberStat label={tHero('statCritical')} value={stats.breakdown.critical} color="red" pulse={stats.breakdown.critical > 0} />
                  </CyberCard>
                  <CyberCard surface={2} className="flex items-center justify-center">
                    <CyberStat label={tHero('statHigh')} value={stats.breakdown.high} color="orange" />
                  </CyberCard>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── TARJETAS DE SECCIÓN (módulos de seguridad) ───────────── */}
          <motion.div
            variants={sv(staggerContainer)} initial="hidden" animate="visible"
            className="grid gap-4 lg:grid-cols-2"
          >
            {CATEGORY_CARDS.map((section) => (
              <motion.div key={section.id} variants={sv(staggerItem)}>
                <CategoryCard section={section} />
              </motion.div>
            ))}
          </motion.div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CategoryCard section={LABS} />
            <CategoryCard section={ANALYSIS} />
          </div>

          {/* ── OPERACIONES ──────────────────────────────────────────── */}
          <CyberCard variant="ghost" padding="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                  {operationsLabel}
                </h3>
                <p className="text-xs text-muted-foreground">{operationsDescription}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OPERATIONS_LEAVES.map((leaf) => (
                <OperationLeafLink key={leaf.id} leaf={leaf} />
              ))}
            </div>
          </CyberCard>

          {/* ── SECURITY OPERATIONS — actividad real por módulo + severidad ── */}
          {!loading && !error && stats && stats.totalScans > 0 && (
            <>
              <div className="flex items-center gap-2.5 pt-2">
                <LayoutDashboard className="h-5 w-5 text-[var(--cyber-accent)]" />
                <div>
                  <h2 className="text-h2 text-foreground">{tHero('securityOperations')}</h2>
                  <p className="text-small">{tHero('securityOperationsSubtitle')}</p>
                </div>
              </div>

              <CyberCard surface={2} glow>
                <h3 className="mb-3 font-semibold text-foreground">{tHero('byModuleTitle')}</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['web', 'code', 'osint'] as const).map(fam => {
                    const meta = FAMILY_META[fam]
                    const Icon = meta.icon
                    return (
                      <div key={fam} className="surface-1 flex flex-col items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-4">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-mono text-xl font-bold text-foreground">{stats.byFamily[fam]}</span>
                        <span className="text-xs text-muted-foreground">{meta.label}</span>
                      </div>
                    )
                  })}
                </div>
              </CyberCard>

              <SecurityMetrics
                breakdown={stats.breakdown}
                byTool={stats.byTool}
                severityTitle={tHero('severityTitle')}
                severitySubtitle={tHero('severitySubtitle')}
                toolTitle={tHero('toolTitle')}
                toolSubtitle={tHero('toolSubtitle')}
              />

              {/* ── RECENT SECURITY ACTIVITY — feed tipo SOC ─────────── */}
              <CyberPanel title={tHero('recentActivityTitle')} subtitle={tHero('recentActivitySubtitle')}>
                <div className="space-y-2">
                  {stats.recentActivity.map(s => {
                    const meta = FAMILY_META[s.family]
                    const Icon = meta?.icon || Activity
                    const badgeType = statusBadgeType(s.status)
                    const edgeColor =
                      badgeType === 'error'     ? 'rgba(248,113,113,0.5)' :
                      badgeType === 'completed' ? 'rgba(16,185,129,0.4)'  :
                                                   'rgba(var(--cyber-accent-rgb),0.4)'
                    return (
                      <Link
                        key={s.id}
                        href={s.family === 'code' ? `/code-scan?id=${s.id}` : s.family === 'osint' ? '/osint' : '/history'}
                        className="surface-1 flex items-center gap-3 rounded-lg border-l-2 border-y border-r border-[hsl(var(--border))] p-3 text-sm transition-all duration-300 hover:-translate-y-px hover:border-r-[rgba(var(--cyber-accent-rgb),0.3)]"
                        style={{ borderLeftColor: edgeColor }}
                      >
                        <CyberBadge type={badgeType} size="sm" />
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <code className="flex-1 truncate font-mono text-xs text-foreground">{s.target}</code>
                        {s.score !== null && (
                          <span className="font-mono text-xs text-muted-foreground">{s.score}/100</span>
                        )}
                        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                          {formatDate(s.startTime)}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                      </Link>
                    )
                  })}
                </div>
              </CyberPanel>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
