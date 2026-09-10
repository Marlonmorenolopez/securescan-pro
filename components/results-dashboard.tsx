'use client'

import { useMemo } from 'react'
import {
  Shield,
  Server,
  Folder,
  Bug,
  Code2,
  Download,
  AlertTriangle,
  ChevronRight,
  FileText,
  CheckCircle2,
  XCircle,
  Crosshair,
  Cpu,
  BarChart3,
  Dna,
  Database,
  Key,
  Waves,
  Fingerprint,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { RiskGauge } from '@/components/cyber/RiskGauge'
import { SecurityMetrics } from '@/components/cyber/SecurityMetrics'
import { EmptyState } from '@/components/cyber/EmptyState'
import { ReportDownloadModal } from '@/components/report-download-modal'
import { VirusTotalPanel } from '@/components/results/intel/VirusTotalPanel'
import { AbuseIPDBPanel } from '@/components/results/intel/AbuseIPDBPanel'
import { ShodanPanel } from '@/components/results/intel/ShodanPanel'
import { CrtShPanel } from '@/components/results/intel/CrtShPanel'
import { TestSSLPanel } from '@/components/results/intel/TestSSLPanel'
import { DnstwistPanel } from '@/components/results/intel/DnstwistPanel'
import { SafeBrowsingPanel } from '@/components/results/intel/SafeBrowsingPanel'
import { useScan } from '@/lib/scan-context'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

// ── ScoreCard ─────────────────────────────────────────────────────────────────
interface ScoreCardProps {
  score: {
    total: number
    grade: string
    gradeDescription?: string
    breakdown: Record<string, number>
    recommendations?: string[]
    riskLevel?: string
  }
}

function ScoreCard({ score }: ScoreCardProps) {
  const t = useTranslations('results')
  const totalIssues  = Object.values(score.breakdown).reduce((a, b) => a + b, 0)
  const criticalHigh = (score.breakdown.critical ?? 0) + (score.breakdown.high ?? 0)
  const riskLevelToBadge: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
    COMPROMETIDO: 'critical',
    EXPUESTO:     'high',
    VULNERABLE:   'medium',
    PROTEGIDO:    'low',
    // compatibilidad con valores anteriores
    CRITICAL: 'critical',
    HIGH:     'high',
    MEDIUM:   'medium',
    LOW:      'low',
    MINIMAL:  'low',
  }
  const riskBadgeType = riskLevelToBadge[score.riskLevel ?? ''] ?? 'info'

  return (
    <CyberCard glow padding="p-6" className="overflow-hidden">
      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Shield className="h-5 w-5 text-[var(--cyber-accent)]" />
        <h3 className="font-mono text-base font-semibold uppercase tracking-wide text-foreground">
          {t('scoreTitle')}
        </h3>
        {score.riskLevel && (
          <CyberBadge type={riskBadgeType} label={`${t('risk')}: ${score.riskLevel}`} size="sm" />
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        {score.gradeDescription ?? t('gradeDescription')}
      </p>

      <div className="flex flex-col items-center gap-6 md:flex-row">
        {/* Gauge — mismo componente que el Home v3 */}
        <RiskGauge total={score.total} grade={score.grade} size={160} strokeWidth={10} />

        {/* Breakdown por severidad */}
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-5 w-full">
          {[
            { key: 'critical', label: t('severities.critical'), color: 'bg-red-600' },
            { key: 'high',     label: t('severities.high'),     color: 'bg-orange-500' },
            { key: 'medium',   label: t('severities.medium'),   color: 'bg-amber-500' },
            { key: 'low',      label: t('severities.low'),      color: 'bg-blue-500' },
            { key: 'info',     label: t('severities.info'),     color: 'bg-slate-500' },
          ].map(item => (
            <div key={item.key} className="rounded-md bg-[hsl(var(--muted))]/40 p-3 text-center">
              <span className={cn('mx-auto mb-2 block h-1.5 w-10 rounded-full', item.color)} />
              <span className="block font-mono text-2xl font-bold text-foreground">
                {score.breakdown[item.key] ?? 0}
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="w-full shrink-0 space-y-1 text-center md:w-auto md:text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {t('totalFindings')}
          </div>
          <div className="font-mono text-3xl font-bold text-foreground">{totalIssues}</div>
          {criticalHigh > 0 && (
            <div className="font-mono text-xs font-medium text-red-400">
              {criticalHigh} requieren atención urgente
            </div>
          )}
        </div>
      </div>

      {/* Recomendaciones */}
      {(score.recommendations?.length ?? 0) > 0 && (
        <div className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-amber-300">
              {t('recommendations')}
            </span>
          </div>
          <div className="space-y-1.5">
            {score.recommendations!.slice(0, 3).map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-amber-200/90">
                <span className="text-amber-400">•</span><span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CyberCard>
  )
}

// ── ResultsDashboard ─────────────────────────────────────────────────────────
export function ResultsDashboard() {
  const t = useTranslations('results')
  const { currentScan } = useScan()

  const hasResults = useMemo(() => {
    if (!currentScan) return false
    return (
      currentScan.technologies.length > 0 ||
      currentScan.ports.length > 0 ||
      currentScan.directories.length > 0 ||
      currentScan.vulnerabilities.length > 0 ||
      currentScan.exploits.length > 0 ||
      (currentScan.nuclei_findings?.length  ?? 0) > 0 ||
      (currentScan.sqli_results?.length    ?? 0) > 0 ||
      (currentScan.brute_force_results?.length ?? 0) > 0 ||
      (currentScan.ffuf_endpoints?.length  ?? 0) > 0
    )
  }, [currentScan])

  if (!currentScan || currentScan.status === 'pending') return null
  if (!hasResults && currentScan.status !== 'completed') return null

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    } catch { return dateStr }
  }

  const isCompleted = currentScan.status === 'completed'
  const hasErrors   = currentScan.status === 'error'

  // ── Datos reales para el tab "Resumen" (gráficos) ──────────────────────────
  // Mismo mapeo 1:1 que extractToolStats() en app/scanner/page.tsx — una sola
  // fuente de verdad sobre qué array de datos corresponde a cada herramienta.
  const byTool = [
    { tool: 'OWASP ZAP',    findings: currentScan.vulnerabilities?.length ?? 0 },
    { tool: 'Nuclei',       findings: currentScan.nuclei_findings?.length ?? 0 },
    { tool: 'SQLMap',       findings: currentScan.sqli_results?.length ?? 0 },
    { tool: 'Nmap',         findings: currentScan.ports?.length ?? 0 },
    { tool: 'Gobuster',     findings: currentScan.directories?.length ?? 0 },
    { tool: 'ffuf',         findings: currentScan.ffuf_endpoints?.length ?? 0 },
    { tool: 'Searchsploit', findings: currentScan.exploits?.length ?? 0 },
    { tool: 'Metasploit',   findings: currentScan.metasploit?.length ?? 0 },
    { tool: 'Patator',      findings: currentScan.brute_force_results?.filter((r: any) => r.success)?.length ?? 0 },
  ].filter(t => t.findings > 0)

  const totalFindingsAllTools = byTool.reduce((sum, t) => sum + t.findings, 0)

  // ── Huella Digital (Threat Intel) — suma de señales de todas las
  // herramientas del grupo. Al sumar Shodan, crt.sh, etc. solo hay que
  // sumar su propio conteo de señales acá.
  const vtResult      = currentScan.threat_intel?.virustotal
  const abuseResult   = currentScan.threat_intel?.abuseipdb
  const shodanResult  = currentScan.threat_intel?.shodan
  const crtshResult   = currentScan.threat_intel?.crtsh
  const testsslResult = currentScan.threat_intel?.testssl
  const dnstwistResult = currentScan.threat_intel?.dnstwist
  const safebrowsingResult = currentScan.threat_intel?.safebrowsing
  const shodanRiskyTags = ['compromised', 'malware', 'honeypot', 'tor']
  const threatIntelFlags =
    (vtResult?.malicious ?? 0) + (vtResult?.suspicious ?? 0) +
    (abuseResult && abuseResult.abuse_confidence_score >= 25 ? 1 : 0) +
    (shodanResult?.vulns?.length ?? 0) +
    (shodanResult?.tags?.filter((t: string) => shodanRiskyTags.includes(t.toLowerCase())).length ?? 0) +
    (testsslResult?.warnings?.length ?? 0) +
    (dnstwistResult?.registered_variants?.length ?? 0) +
    (safebrowsingResult?.flagged ? 1 : 0)

  // El breakdown real ya lo calcula scoring.py en el backend — currentScan.score.breakdown
  // es la misma fuente de verdad que usa ScoreCard, sin recalcular nada aquí.
  const severityBreakdown = currentScan.score?.breakdown ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_100%_50%,rgba(var(--cyber-accent-rgb),0.06),transparent)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
              <span>
                <span className="text-[var(--cyber-accent)]">target</span>{' '}
                <code className="rounded bg-muted px-1.5 py-0.5">{currentScan.target}</code>
              </span>
              <span>{formatDate(currentScan.startTime)}</span>
              {currentScan.endTime && <span>→ {formatDate(currentScan.endTime)}</span>}
            </div>
          </div>
          {isCompleted && <ReportDownloadModal scanId={currentScan.id} />}
        </div>
      </div>

      {/* ── Score Card ── */}
      <ScoreCard score={currentScan.score} />

      {/* ── Alertas de estado ── */}
      {isCompleted && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-900/50 bg-emerald-500/8 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="font-mono text-sm font-semibold text-emerald-400">{t('scanCompleted')}</p>
            <p className="font-mono text-xs text-emerald-400/70">{t('scanCompletedDetail')}</p>
          </div>
        </div>
      )}

      {hasErrors && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>{t('scanWithErrors')}</AlertTitle>
          <AlertDescription>
            {t('scanWithErrorsDetail')}
            {currentScan.error && (
              <div className="mt-2 text-sm font-mono bg-destructive/10 p-2 rounded">
                Error: {currentScan.error}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Tabs ── */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-auto gap-2 bg-transparent p-0 sm:grid-cols-6">

          {/* Resumen — gráficos agregados (donut + barras) */}
          <TabsTrigger value="summary" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-[rgba(var(--cyber-accent-rgb),0.40)] data-[state=active]:border-[var(--cyber-accent)] data-[state=active]:bg-[rgba(var(--cyber-accent-rgb),0.08)] data-[state=active]:shadow-cyber-sm">
            <div className="flex items-center gap-1.5 w-full">
              <BarChart3 className="h-4 w-4 text-[var(--cyber-accent)] shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Resumen</span>
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-[var(--cyber-accent)]">
              {totalFindingsAllTools}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">hallazgos totales</div>
          </TabsTrigger>

          {/* Huella Digital — Threat Intel, corre en paralelo (no es una fase secuencial) */}
          <TabsTrigger value="huella-digital" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-cyan-500/40 data-[state=active]:border-cyan-500 data-[state=active]:bg-cyan-500/8 data-[state=active]:shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            <div className="flex items-center gap-1.5 w-full">
              <Fingerprint className="h-4 w-4 text-cyan-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Huella Digital</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">∥</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", threatIntelFlags > 0 ? "text-red-400" : "text-cyan-400")}>
              {threatIntelFlags}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabThreatIntel')}</div>
          </TabsTrigger>

          {/* F1 — Wappalyzer */}
          <TabsTrigger value="technologies" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-blue-500/40 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/8 data-[state=active]:shadow-[0_0_12px_rgba(59,130,246,0.15)]">
            <div className="flex items-center gap-1.5 w-full">
              <Code2 className="h-4 w-4 text-blue-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Wappalyzer</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F1</span>
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-blue-400">{currentScan.technologies.length}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabTech')}</div>
          </TabsTrigger>

          {/* F2 — Nmap */}
          <TabsTrigger value="ports" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-emerald-500/40 data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-500/8 data-[state=active]:shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <div className="flex items-center gap-1.5 w-full">
              <Server className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Nmap</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F2</span>
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-emerald-400">{currentScan.ports.length}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabPorts')}</div>
          </TabsTrigger>

          {/* F3 — ffuf */}
          <TabsTrigger value="ffuf" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-sky-500/40 data-[state=active]:border-sky-500 data-[state=active]:bg-sky-500/8">
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-sm shrink-0">🌊</span>
              <span className="text-xs font-mono font-medium truncate">ffuf</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F3</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", (currentScan.ffuf_endpoints?.length ?? 0) > 0 ? "text-sky-400" : "text-foreground")}>
              {currentScan.ffuf_endpoints?.length ?? 0}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabEndpoints')}</div>
          </TabsTrigger>

          {/* F4 — Gobuster */}
          <TabsTrigger value="directories" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-amber-500/40 data-[state=active]:border-amber-500 data-[state=active]:bg-amber-500/8">
            <div className="flex items-center gap-1.5 w-full">
              <Folder className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Gobuster</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F4</span>
            </div>
            <div className="font-mono text-2xl font-bold leading-none text-amber-400">{currentScan.directories.filter((d: any) => !d.is_false_positive && !d.skipped && d.status !== 0).length}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabDirectories')}</div>
          </TabsTrigger>

          {/* F5 — ZAP */}
          <TabsTrigger value="vulnerabilities" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-red-500/40 data-[state=active]:border-red-500 data-[state=active]:bg-red-500/8 data-[state=active]:shadow-[0_0_12px_rgba(239,68,68,0.12)]">
            <div className="flex items-center gap-1.5 w-full">
              <Bug className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">OWASP ZAP</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F5</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", currentScan.vulnerabilities.length > 0 ? "text-red-400" : "text-foreground")}>
              {currentScan.vulnerabilities.length}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {t('tabVulns')}
              {(currentScan.spider_results?.length ?? 0) > 0 && (
                <> · {currentScan.spider_results!.length} URLs (Spider)</>
              )}
            </div>
          </TabsTrigger>

          {/* F6 — Nuclei */}
          <TabsTrigger value="nuclei" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-purple-500/40 data-[state=active]:border-purple-500 data-[state=active]:bg-purple-500/8">
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-sm shrink-0">🧬</span>
              <span className="text-xs font-mono font-medium truncate">Nuclei</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F6</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", (currentScan.nuclei_findings?.length ?? 0) > 0 ? "text-purple-400" : "text-foreground")}>
              {currentScan.nuclei_findings?.length ?? 0}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabNuclei')}</div>
          </TabsTrigger>

          {/* F7 — Injections */}
          <TabsTrigger value="sqlmap" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-red-600/40 data-[state=active]:border-red-600 data-[state=active]:bg-red-600/8">
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-sm shrink-0">💉</span>
              <span className="text-xs font-mono font-medium truncate">Injections</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F7</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", currentScan.sqli_results?.some((r: any) => ['critical','high'].includes(r.severity)) ? "text-red-500" : "text-foreground")}>
              {currentScan.sqli_results?.length ?? 0}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabInjections')}</div>
          </TabsTrigger>

          {/* F8 — Patator */}
          <TabsTrigger value="patator" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-lime-500/40 data-[state=active]:border-lime-500 data-[state=active]:bg-lime-500/8">
            <div className="flex items-center gap-1.5 w-full">
              <span className="text-sm shrink-0">🔑</span>
              <span className="text-xs font-mono font-medium truncate">Patator</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F8</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", currentScan.brute_force_results?.some((r: any) => r.success) ? "text-lime-400" : "text-foreground")}>
              {currentScan.brute_force_results?.length ?? 0}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabCredentials')}</div>
          </TabsTrigger>

          {/* F9 — Metasploit */}
          <TabsTrigger value="metasploit" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-violet-500/40 data-[state=active]:border-violet-500 data-[state=active]:bg-violet-500/8">
            <div className="flex items-center gap-1.5 w-full">
              <Crosshair className="h-4 w-4 text-violet-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Metasploit</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F9</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", (currentScan.metasploit?.length ?? 0) > 0 ? "text-violet-400" : "text-foreground")}>
              {currentScan.metasploit?.length ?? 0}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabMSF')}</div>
          </TabsTrigger>

          {/* F10 — Searchsploit */}
          <TabsTrigger value="exploits" className="flex flex-col items-start gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 h-auto text-left transition-all duration-200 hover:border-orange-400/40 data-[state=active]:border-orange-400 data-[state=active]:bg-orange-400/8">
            <div className="flex items-center gap-1.5 w-full">
              <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="text-xs font-mono font-medium truncate">Searchsploit</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/50">F10</span>
            </div>
            <div className={cn("font-mono text-2xl font-bold leading-none", currentScan.exploits.length > 0 ? "text-orange-400" : "text-foreground")}>
              {currentScan.exploits.length}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{t('tabExploits')}</div>
          </TabsTrigger>

        </TabsList>


        {/* ══ TAB: Resumen (gráficos con datos reales) ══ */}
        <TabsContent value="summary" className="space-y-4">
          <SecurityMetrics
            breakdown={severityBreakdown}
            byTool={byTool}
            severityTitle="Vulnerabilidades por severidad"
            severitySubtitle="Distribución real de este escaneo"
            toolTitle="Hallazgos por herramienta"
            toolSubtitle="Conteo real de este escaneo"
          />
        </TabsContent>

        {/* ══ TAB: Vulnerabilidades ══ */}
        <TabsContent value="vulnerabilities" className="space-y-4">
          {/* ZAP Spider — URLs descubiertas antes del active scan */}
          <CyberPanel
            title="ZAP Spider"
            subtitle="URLs descubiertas durante el rastreo, antes del active scan"
            action={
              (currentScan.spider_results?.length ?? 0) > 0 ? (
                <span className="flex items-center gap-1 whitespace-nowrap rounded border border-purple-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-purple-400">
                  <Compass className="h-3 w-3" />
                  {currentScan.spider_results!.length} URL(s)
                </span>
              ) : undefined
            }
          >
            {(currentScan.spider_results?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Compass}
                title="Sin URLs descubiertas"
                detail="El spider de ZAP no encontró (o no corrió) rutas adicionales para este objetivo."
              />
            ) : (
              <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {currentScan.spider_results!.map((s, index) => (
                  <div
                    key={`${s.url}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.35)] hover:text-foreground"
                  >
                    <Compass className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                    <code className="truncate">{s.url}</code>
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>

          {/* ZAP Active Scan — vulnerabilidades */}
          <CyberPanel title={t('vulnerabilities')} subtitle={t('vulnerabilitiesDesc')}>
            {currentScan.vulnerabilities.length === 0 ? (
              <EmptyState
                icon={Shield}
                title={t('noVulnerabilities')}
                detail={t('noVulnerabilitiesDetail')}
              />
            ) : (
              <div className="space-y-3">
                {currentScan.vulnerabilities.map((vuln, index) => (
                  <div
                    key={`${vuln.id}-${index}`}
                    className="rounded-lg border border-[hsl(var(--border))] p-4 transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.35)]"
                  >
                    <div className="flex items-start gap-3">
                      <CyberBadge type={(vuln.severity ?? 'info') as any} size="sm" className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold text-foreground">{vuln.name}</span>
                          {vuln.tool && (
                            <span className="rounded bg-[hsl(var(--muted))]/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                              {vuln.tool}
                            </span>
                          )}
                          {vuln.cweid && (
                            <span className="font-mono text-xs text-[var(--cyber-accent)]">CWE-{vuln.cweid}</span>
                          )}
                        </div>
                        {vuln.description && (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {vuln.description}
                          </p>
                        )}
                        {vuln.solution && (
                          <div className="mt-3 rounded-md border border-blue-500/25 bg-blue-500/[0.06] p-3">
                            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-blue-300">
                              {t('solution')}
                            </span>
                            <p className="mt-1 text-sm text-blue-200/90">{vuln.solution}</p>
                          </div>
                        )}
                        {vuln.url && (
                          <p className="mt-2 font-mono text-xs text-muted-foreground">
                            <strong>{t('url')}</strong>{' '}
                            <code className="text-xs">{vuln.url}</code>
                          </p>
                        )}
                      </div>
                      {vuln.cvss != null && (
                        <div className="shrink-0 text-right">
                          <div className={cn(
                            'font-mono text-2xl font-bold',
                            vuln.cvss >= 9 ? 'text-red-400' :
                            vuln.cvss >= 7 ? 'text-orange-400' :
                            vuln.cvss >= 4 ? 'text-amber-400' : 'text-blue-400'
                          )}>
                            {vuln.cvss.toFixed(1)}
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{t('cvss')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Tecnologías ══ */}
        <TabsContent value="huella-digital">
          <CyberPanel
            title={t('threatIntelTitle')}
            subtitle={t('threatIntelSubtitle')}
            action={
              vtResult || abuseResult || shodanResult || crtshResult || testsslResult || dnstwistResult || safebrowsingResult ? (
                <span className="flex items-center gap-1 whitespace-nowrap rounded border border-cyan-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-cyan-400">
                  <Fingerprint className="h-3 w-3" />
                  {[vtResult, abuseResult, shodanResult, crtshResult, testsslResult, dnstwistResult, safebrowsingResult].filter(Boolean).length} fuente(s) activa(s)
                </span>
              ) : undefined
            }
          >
            {!vtResult && !abuseResult && !shodanResult && !crtshResult && !testsslResult && !dnstwistResult && !safebrowsingResult ? (
              <div className="space-y-3 py-12 text-center">
                <Fingerprint className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">{t('threatIntelEmpty')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cada herramienta del grupo es su propio bloque, leyendo
                    currentScan.threat_intel.<herramienta>. Para sumar Shodan,
                    crt.sh, etc. se agrega un bloque más acá, igual a estos. */}
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    VirusTotal
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Reputación del dominio/IP contra 68+ motores antivirus.</p>
                  <VirusTotalPanel data={vtResult} />
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    AbuseIPDB
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Reportes de abuso conocidos para la IP del objetivo.</p>
                  <AbuseIPDBPanel data={abuseResult} />
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Shodan
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Puertos expuestos, tecnologías y CVEs conocidos por firma de banner.</p>
                  <ShodanPanel data={shodanResult} />
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    crt.sh
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Subdominios descubiertos vía certificados SSL/TLS emitidos públicamente.</p>
                  <CrtShPanel data={crtshResult} />
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    TestSSL
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Vulnerabilidades TLS con nombre propio (Heartbleed, POODLE...) y estado del certificado.</p>
                  <TestSSLPanel data={testsslResult} />
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    dnstwist
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Dominios parecidos (typosquatting/phishing) que ya están registrados.</p>
                  <DnstwistPanel data={dnstwistResult} />
                </div>
                <div>
                  <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                    Google Safe Browsing
                  </h4>
                  <p className="mb-2 text-[11px] text-muted-foreground">Si Google ya tiene este sitio marcado como malware o phishing.</p>
                  <SafeBrowsingPanel data={safebrowsingResult} />
                </div>
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        <TabsContent value="technologies">
          <CyberPanel title={t('technologies')} subtitle={t('technologiesDesc')}>
            {currentScan.technologies.length === 0 ? (
              <EmptyState icon={Code2} title={t('noTechnologies')} size="compact" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentScan.technologies.map((tech, index) => (
                  <div
                    key={`${tech.name}-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-4 transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.30)]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(var(--cyber-accent-rgb),0.10)] font-mono text-lg font-bold text-[var(--cyber-accent)]">
                      {tech.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="block truncate font-medium text-foreground">{tech.name}</span>
                        {tech.version && (
                          <span className="shrink-0 rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            v{tech.version}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono text-xs capitalize text-muted-foreground">
                          {tech.category ?? 'unknown'}
                        </span>
                        {tech.confidence != null && (
                          <span className="font-mono text-xs text-muted-foreground">
                            • {tech.confidence}% confianza
                          </span>
                        )}
                        {(tech as any).simulated && (
                          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-yellow-400">
                            Simulado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Puertos ══ */}
        <TabsContent value="ports">
          <CyberPanel title={t('ports')} subtitle={t('portsDesc')} noPadding>
            {currentScan.ports.length === 0 ? (
              <EmptyState icon={Server} title={t('noPorts')} size="compact" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[hsl(var(--border))] hover:bg-transparent">
                    <TableHead className="w-[120px] font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('port')}</TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('status')}</TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('service')}</TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('product')}</TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('version')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentScan.ports.map((port, index) => (
                    <TableRow key={`${port.port}-${index}`} className="border-[hsl(var(--border))]">
                      <TableCell className="font-mono font-medium text-foreground">
                        {port.port}/{port.protocol ?? 'tcp'}
                      </TableCell>
                      <TableCell>
                        <CyberBadge
                          type={port.state === 'open' ? 'completed' : 'idle'}
                          label={port.state}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm capitalize text-muted-foreground">{port.service ?? '–'}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{port.product ?? '–'}</TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">{port.version ?? '–'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Directorios ══ */}
        <TabsContent value="directories">
          <CyberPanel title={t('directories')} subtitle={t('directoriesDesc')}>
            {currentScan.directories.length === 0 ? (
              <EmptyState icon={Folder} title={t('noDirectories')} size="compact" />
            ) : (
              <div className="space-y-2">
                {currentScan.directories
                  .filter((dir: any) => !dir.is_false_positive && !dir.skipped && dir.status !== 0)
                  .map((dir, index) => (
                  <div
                    key={`${dir.path}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.30)]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <code className="truncate font-mono text-sm text-foreground">{dir.path}</code>
                      {dir.type && (
                        <span className="shrink-0 rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] capitalize text-muted-foreground">
                          {dir.type}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={cn(
                        'rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                        dir.status >= 200 && dir.status < 300 && 'border-emerald-500/40 text-emerald-400',
                        dir.status >= 300 && dir.status < 400 && 'border-amber-500/40 text-amber-400',
                        dir.status >= 400 && 'border-red-500/40 text-red-400',
                      )}>
                        {dir.status}
                      </span>
                      {dir.size != null && dir.size > 0 && (
                        <span className="w-16 text-right font-mono text-xs text-muted-foreground">
                          {(dir.size / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Exploits ══ */}
        <TabsContent value="exploits">
          <CyberPanel title={t('exploits')} subtitle={t('exploitsDesc')}>
            {currentScan.exploits.length === 0 ? (
              <EmptyState icon={Crosshair} title={t('noExploits')} detail={t('noExploitsDetail')} />
            ) : (
              <div className="space-y-3">
                {currentScan.exploits.map((exploit, index) => (
                  <div
                    key={`${exploit.id}-${index}`}
                    className="rounded-lg border border-[hsl(var(--border))] p-4 transition-colors hover:border-red-500/40"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400">EDB-{exploit.id}</span>
                      {exploit.type && (
                        <span className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{exploit.type}</span>
                      )}
                      {exploit.platform && (
                        <span className="rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{exploit.platform}</span>
                      )}
                      {(exploit as any).severity && (
                        <CyberBadge type={(exploit as any).severity} size="sm" />
                      )}
                      {(exploit as any).simulated && (
                        <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-yellow-400">
                          Simulado
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-foreground">{exploit.title}</h4>
                    {(exploit as any).path && (
                      <p className="mt-1 font-mono text-sm text-muted-foreground">
                        {(exploit as any).path}
                      </p>
                    )}
                    {(exploit as any).matchedTerm && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Relacionado con:{' '}
                        <span className="font-medium text-foreground">{(exploit as any).matchedTerm}</span>
                      </p>
                    )}
                    {/* exploit.exploit_url viene del campo 'url' de searchsploit.py */}
                    {exploit.exploit_url && (
                      <div className="mt-3">
                        <a
                          href={exploit.exploit_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-[var(--cyber-accent)] hover:underline"
                        >
                          Ver en Exploit-DB <ChevronRight className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Metasploit ══ */}
        <TabsContent value="metasploit">
          <CyberPanel
            title="Módulos Auxiliares Metasploit"
            subtitle="Resultados de módulos auxiliares MSF ejecutados contra el target"
            action={
              (currentScan.metasploit?.length ?? 0) > 0 ? (
                <span className="flex items-center gap-1 whitespace-nowrap rounded border border-orange-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-orange-400">
                  <Cpu className="h-3 w-3" />
                  {currentScan.metasploit.some((f: any) => !f.error) ? 'Live' : 'Simulación'}
                </span>
              ) : undefined
            }
          >
            {(currentScan.metasploit?.length ?? 0) === 0 ? (
              <div className="space-y-3 py-12 text-center">
                <Crosshair className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">
                  Metasploit no fue activado en este escaneo
                </p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Actívalo en la configuración avanzada del formulario o selecciona el perfil{' '}
                  <span className="font-semibold">Agresivo</span>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentScan.metasploit.map((finding: any, idx: number) => (
                  <div
                    key={idx}
                    className={cn(
                      'rounded-lg border p-4 transition-colors',
                      finding.error
                        ? 'border-[hsl(var(--border))] opacity-70'
                        : finding.severity === 'critical' || finding.severity === 'high'
                        ? 'border-orange-500/40 bg-orange-500/[0.06] hover:border-orange-500/70'
                        : finding.severity === 'medium'
                        ? 'border-yellow-500/40 bg-yellow-500/[0.06] hover:border-yellow-500/70'
                        : 'border-[hsl(var(--border))] hover:border-[rgba(var(--cyber-accent-rgb),0.30)]',
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {finding.severity && (
                        <CyberBadge type={finding.severity} size="sm" />
                      )}
                      {finding.module && (
                        <span className="max-w-[260px] truncate rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {finding.module}
                        </span>
                      )}
                      {finding.cvss != null && finding.cvss > 0 && (
                        <span className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          CVSS {finding.cvss.toFixed(1)}
                        </span>
                      )}
                      {finding.port && (
                        <span className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          :{finding.port}/{finding.protocol ?? 'tcp'}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold leading-snug text-foreground">
                      {finding.title ?? finding.module ?? 'MSF Finding'}
                    </h4>
                    {finding.description && (
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {finding.description}
                      </p>
                    )}
                    {finding.error && (
                      <p className="mt-2 font-mono text-xs text-red-400">
                        Error: {finding.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Nuclei ══ */}
        <TabsContent value="nuclei" className="space-y-4">
          <CyberPanel title={`🧬 ${t('nucleiTitle')}`} subtitle={t('nucleiDesc')}>
            {(currentScan.nuclei_findings?.length ?? 0) === 0 ? (
              <EmptyState icon={Dna} title={t('noNuclei')} detail={t('noNucleiDetail')} size="compact" />
            ) : (
              <div className="space-y-3">
                {currentScan.nuclei_findings.map((f: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] p-3 transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.30)]"
                  >
                    <CyberBadge type={(f.severity ?? 'info') as any} size="sm" className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-medium text-foreground">{f.name}</p>
                        {/* template_id — antes casi invisible (secondary, 10px); ahora con
                            su propio chip identificable, coherente con el resto del sistema cyber */}
                        {f.template_id && (
                          <span className="shrink-0 rounded border border-[rgba(var(--cyber-accent-rgb),0.30)] bg-[rgba(var(--cyber-accent-rgb),0.08)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--cyber-accent)]">
                            {f.template_id}
                          </span>
                        )}
                        {f.simulated && (
                          <span className="shrink-0 rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-yellow-400">
                            Simulado
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 break-words text-xs text-muted-foreground">{f.description}</p>
                      {f.url && (
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{f.url}</p>
                      )}
                      {f.references?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {f.references.slice(0, 2).map((ref: string, ri: number) => (
                            <a
                              key={ri}
                              href={ref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[220px] truncate text-[10px] text-[var(--cyber-accent)] hover:underline"
                            >
                              {ref}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: SQLMap ══ */}
        <TabsContent value="sqlmap" className="space-y-4">
          <CyberPanel
            title={`💉 ${t('injectionTitle')}`}
            subtitle="10 tipos de inyección detectados con payloads activos contra los tres laboratorios"
          >
            <p className="-mt-3 mb-4 font-mono text-[10px] text-muted-foreground">
              SQLi · NoSQLi · XSS · XXE · SSRF · SSTI · CMDi · LFI · XPath · LDAP
            </p>
            {(currentScan.sqli_results?.length ?? 0) === 0 ? (
              <EmptyState
                icon={Database}
                title={t('noSqlmap')}
                detail={t('noSqlmapDetail')}
              />
            ) : (
              <div className="space-y-4">
                {currentScan.sqli_results.map((r: any, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border p-4 transition-colors',
                      r.severity === 'critical' ? 'border-red-500/40 bg-red-500/[0.06] hover:border-red-500/60' :
                      r.severity === 'high'     ? 'border-orange-500/40 bg-orange-500/[0.06] hover:border-orange-500/60' :
                      r.severity === 'medium'   ? 'border-amber-500/40 bg-amber-500/[0.06] hover:border-amber-500/60' :
                      r.severity === 'info'     ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20' :
                      'border-[hsl(var(--border))] hover:border-[rgba(var(--cyber-accent-rgb),0.30)]',
                    )}
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <CyberBadge type={(r.severity ?? 'info') as any} size="sm" className="shrink-0" />
                      <span className="text-sm font-semibold text-foreground">{r.name}</span>
                      {r.tool && (
                        <span className="rounded bg-[hsl(var(--muted))]/50 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {r.tool}
                        </span>
                      )}
                      {r.simulated && (
                        <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-yellow-400">
                          Simulado
                        </span>
                      )}
                    </div>

                    <p className="text-sm leading-relaxed text-muted-foreground">{r.description}</p>

                    {r.severity !== 'info' && (
                      <div className="mt-3 space-y-2">
                        {(r.parameter || (r.params?.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{t('parameter')}</span>
                            {(r.params?.length > 0 ? r.params : [r.parameter]).map((p: string) => (
                              <span key={p} className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-400">
                                {p}
                              </span>
                            ))}
                            {r.place && (
                              <span className="font-mono text-xs text-muted-foreground">via {r.place}</span>
                            )}
                          </div>
                        )}

                        {(r.injection_type || (r.injection_types?.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{t('type')}</span>
                            {(r.injection_types?.length > 0 ? r.injection_types : [r.injection_type]).map((typ: string) => (
                              <span key={typ} className="rounded border border-purple-500/40 px-2 py-0.5 font-mono text-xs text-purple-400">
                                {typ}
                              </span>
                            ))}
                          </div>
                        )}

                        {r.dbms && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{t('dbms')}</span>
                            <code className="rounded bg-[hsl(var(--muted))]/50 px-2 py-0.5 font-mono text-xs text-foreground">{r.dbms}</code>
                          </div>
                        )}

                        {r.is_dba && (
                          <div className="mt-2 flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 p-2">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                            <span className="font-mono text-xs font-medium text-red-300">
                              El usuario de BD tiene privilegios DBA
                              {r.current_user && ` (${r.current_user})`}
                            </span>
                          </div>
                        )}

                        {r.payload && (
                          <details className="mt-2">
                            <summary className="cursor-pointer font-mono text-xs text-muted-foreground hover:text-foreground">
                              Ver payload
                            </summary>
                            <code className="mt-1 block break-all rounded bg-[hsl(var(--muted))]/50 p-2 font-mono text-xs">
                              {r.payload}
                            </code>
                          </details>
                        )}

                        {r.databases?.length > 0 && (
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">DBs:</span>
                            {r.databases.map((db: string) => (
                              <span key={db} className="rounded bg-[hsl(var(--muted))]/50 px-2 py-0.5 font-mono text-xs text-foreground">{db}</span>
                            ))}
                          </div>
                        )}

                        {(r.method || r.http_status) && (
                          <div className="mt-1 flex items-center gap-3">
                            {r.method && (
                              <span className="rounded border border-slate-400/40 px-2 py-0.5 font-mono text-xs text-slate-400">
                                {r.method}
                              </span>
                            )}
                            {r.http_status > 0 && (
                              <span className={cn(
                                'rounded border px-2 py-0.5 font-mono text-xs',
                                r.http_status < 300 ? 'border-emerald-500/40 text-emerald-400' :
                                r.http_status < 400 ? 'border-amber-500/40 text-amber-400' :
                                'border-red-500/40 text-red-400'
                              )}>
                                HTTP {r.http_status}
                              </span>
                            )}
                            {r.response_time > 0 && (
                              <span className="font-mono text-xs text-muted-foreground">
                                {r.response_time.toFixed(2)}s
                              </span>
                            )}
                          </div>
                        )}

                        {r.evidence && (
                          <details className="mt-2">
                            <summary className="cursor-pointer font-mono text-xs text-muted-foreground hover:text-foreground">
                              Ver evidencia
                            </summary>
                            <code className="mt-1 block break-all rounded border border-red-500/20 bg-red-500/10 p-2 font-mono text-xs text-red-300">
                              {r.evidence}
                            </code>
                          </details>
                        )}

                        {(r.remediation || r.solution) && (
                          <div className="mt-3 rounded-md border border-blue-500/25 bg-blue-500/[0.06] p-3">
                            <span className="font-mono text-xs font-semibold text-blue-300">
                              Remediación:
                            </span>
                            <p className="mt-1 text-xs text-blue-200/90">
                              {r.remediation ?? r.solution}
                            </p>
                          </div>
                        )}

                        {r.references?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {r.references.slice(0, 3).map((ref: string, ri: number) => (
                              <a key={ri} href={ref} target="_blank" rel="noopener noreferrer"
                                 className="max-w-[200px] truncate text-[10px] text-[var(--cyber-accent)] hover:underline">
                                {ref}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: Patator ══ */}
        <TabsContent value="patator" className="space-y-4">
          <CyberPanel title={`🔑 ${t('patatorTitle')}`} subtitle={t('patatorDesc')}>
            {(currentScan.brute_force_results?.length ?? 0) === 0 ? (
              <EmptyState icon={Key} title={t('noPatator')} detail={t('noPatatorDetail')} size="compact" />
            ) : (
              <div className="space-y-4">
                {currentScan.brute_force_results.map((r: any, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border p-4',
                      r.success ? 'border-rose-500/30 bg-rose-500/[0.06]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20',
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <CyberBadge type={(r.severity ?? 'info') as any} size="sm" />
                      <span className="text-sm font-semibold text-foreground">{r.name}</span>
                      {r.simulated && (
                        <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-yellow-400">
                          Simulado
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{r.description}</p>
                    {r.credentials?.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-mono text-xs font-medium text-rose-400">{t('credentialsFound')}</p>
                        {r.credentials.map((c: any, ci: number) => (
                          <div key={ci} className="flex gap-4 rounded bg-[hsl(var(--muted))]/50 px-3 py-2 font-mono text-xs">
                            <span className="text-muted-foreground">
                              usuario: <span className="text-foreground">{c.username}</span>
                            </span>
                            <span className="text-muted-foreground">
                              pass: <span className="text-rose-400">{c.password}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.attempts > 0 && (
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {r.attempts} combinaciones probadas
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

        {/* ══ TAB: ffuf ══ */}
        <TabsContent value="ffuf" className="space-y-4">
          <CyberPanel title={`🌊 ${t('ffufTitle')}`} subtitle={t('endpoints')}>
            {(currentScan.ffuf_endpoints?.length ?? 0) === 0 ? (
              <EmptyState icon={Waves} title={t('noFfuf')} detail={t('noFfufDetail')} size="compact" />
            ) : (
              <div className="space-y-4">
                {currentScan.ffuf_endpoints.map((r: any, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-lg border p-4',
                      r.severity === 'high'   ? 'border-yellow-500/30 bg-yellow-500/[0.06]' :
                      r.severity === 'medium' ? 'border-sky-500/30 bg-sky-500/[0.06]' :
                      'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20',
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <CyberBadge type={(r.severity ?? 'info') as any} size="sm" />
                      <span className="text-sm font-semibold text-foreground">{r.name}</span>
                      {r.simulated && (
                        <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-yellow-400">
                          Simulado
                        </span>
                      )}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{r.description}</p>
                    {r.endpoints?.length > 0 && (
                      <div className="max-h-48 overflow-auto rounded border border-[hsl(var(--border))]">
                        <table className="w-full text-xs">
                          <thead className="bg-[hsl(var(--muted))]/50 text-muted-foreground">
                            <tr>
                              <th className="p-2 text-left font-mono text-[10px] uppercase tracking-wide">{t('endpoint')}</th>
                              <th className="w-16 p-2 text-center font-mono text-[10px] uppercase tracking-wide">Status</th>
                              <th className="w-20 p-2 text-center font-mono text-[10px] uppercase tracking-wide">{t('size')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[hsl(var(--border))]">
                            {r.endpoints.map((e: any, ei: number) => (
                              <tr key={ei} className="hover:bg-[hsl(var(--muted))]/30">
                                <td className="p-2 font-mono text-amber-300">
                                  {e.endpoint ?? e.url}
                                </td>
                                <td className="p-2 text-center">
                                  <span className={cn(
                                    'rounded px-1.5 py-0.5 font-mono text-[10px]',
                                    e.status === 200 ? 'bg-emerald-500/15 text-emerald-400' :
                                    e.status >= 300 && e.status < 400 ? 'bg-blue-500/15 text-blue-400' :
                                    'bg-[hsl(var(--muted))]/50 text-muted-foreground',
                                  )}>
                                    {e.status}
                                  </span>
                                </td>
                                <td className="p-2 text-center font-mono text-muted-foreground">
                                  {e.length != null ? `${e.length}b` : '–'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CyberPanel>
        </TabsContent>

      </Tabs>
    </div>
  )
}