'use client'
// app/dashboard/page.tsx — SecureScan Pro
// Dashboard técnico con datos REALES (no mocks) — reutiliza
// GET /api/dashboard/stats, el modelo de Findings unificado, y los
// componentes visuales ya existentes (RiskGauge, SecurityMetrics).

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard, Loader2, AlertTriangle, Code2, Search, Globe,
  Activity, ExternalLink,
} from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { CyberButton } from '@/components/cyber/CyberButton'
import { RiskGauge } from '@/components/cyber/RiskGauge'
import { SecurityMetrics } from '@/components/cyber/SecurityMetrics'
import { EmptyState } from '@/components/cyber/EmptyState'
import { getDashboardStats } from '@/lib/api-client'
import type { DashboardStats } from '@/lib/api-client'

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

export default function DashboardPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

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
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-6 w-6 text-[var(--cyber-accent)]" />
            <h1 className="text-2xl font-bold text-foreground">Dashboard técnico</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Datos reales agregados de todos tus escaneos — Web Scan, Code Scan y OSINT juntos.
          </p>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando estadísticas…
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3 text-center">
              <EmptyState icon={AlertTriangle} title="No se pudo cargar el dashboard" detail={error} />
              <CyberButton size="sm" onClick={load}>Reintentar</CyberButton>
            </div>
          )}

          {!loading && !error && stats && stats.totalScans === 0 && (
            <EmptyState
              icon={Activity}
              title="Todavía no hay escaneos"
              detail="Corre tu primer Web Scan, Code Scan u OSINT y este dashboard se va a llenar solo con datos reales."
            />
          )}

          {!loading && !error && stats && stats.totalScans > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Total escaneos', value: stats.totalScans, accent: false },
                  { label: 'Hallazgos totales', value: stats.totalFindings, accent: false },
                  { label: 'Críticos', value: stats.breakdown.critical, accent: stats.breakdown.critical > 0 },
                  { label: 'Altos', value: stats.breakdown.high, accent: stats.breakdown.high > 0 },
                ].map(k => (
                  <div key={k.label} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-center">
                    <div className={`font-mono text-2xl font-bold ${k.accent ? 'text-red-400' : 'text-foreground'}`}>
                      {k.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{k.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <CyberCard className="flex flex-col items-center justify-center gap-3 lg:col-span-1">
                  <RiskGauge total={stats.averageScore} grade={stats.averageGrade} label="Score promedio" />
                  <CyberBadge type="completed" label={stats.riskLevel} size="sm" />
                </CyberCard>

                <CyberCard className="lg:col-span-2">
                  <h3 className="mb-3 font-semibold text-foreground">Escaneos por módulo</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(['web', 'code', 'osint'] as const).map(fam => {
                      const meta = FAMILY_META[fam]
                      const Icon = meta.icon
                      return (
                        <div key={fam} className="flex flex-col items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-4">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-mono text-xl font-bold text-foreground">{stats.byFamily[fam]}</span>
                          <span className="text-xs text-muted-foreground">{meta.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </CyberCard>
              </div>

              <SecurityMetrics
                breakdown={stats.breakdown}
                byTool={stats.byTool}
                severityTitle="Distribución de severidad"
                severitySubtitle="Todos los hallazgos, todas las familias de scan"
                toolTitle="Herramientas con más hallazgos"
                toolSubtitle="Acumulado histórico"
              />

              <CyberPanel title="Actividad reciente" subtitle="Últimos 10 Jobs, cualquier familia">
                <div className="space-y-2">
                  {stats.recentActivity.map(s => {
                    const meta = FAMILY_META[s.family]
                    const Icon = meta?.icon || Activity
                    return (
                      <Link
                        key={s.id}
                        href={s.family === 'code' ? `/code-scan?id=${s.id}` : s.family === 'osint' ? '/osint' : '/history'}
                        className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] p-3 text-sm transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.3)]"
                      >
                        <CyberBadge type={statusBadgeType(s.status)} size="sm" />
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
