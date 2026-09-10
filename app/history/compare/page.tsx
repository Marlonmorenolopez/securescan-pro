'use client'
// app/history/compare/page.tsx — SecureScan Pro
// Compara dos escaneos completados (?a=<id>&b=<id2>) usando
// GET /api/scan/<a>/compare/<b> (ver server/comparison.py).

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Minus, Equal, RefreshCcw, AlertTriangle, Loader2,
} from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { cn } from '@/lib/utils'
import { compareScans } from '@/lib/api-client'
import type { ComparisonResult, ComparisonFinding } from '@/lib/api-client'
import { useTranslations } from 'next-intl'

function severityBadgeType(sev?: string): 'critical' | 'high' | 'medium' | 'low' | 'completed' {
  const s = (sev || '').toLowerCase()
  if (s === 'critical') return 'critical'
  if (s === 'high') return 'high'
  if (s === 'medium') return 'medium'
  if (s === 'low') return 'low'
  return 'completed'
}

function FindingCard({ finding }: { finding: ComparisonFinding }) {
  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm text-foreground">{finding.title}</span>
        {finding.severity && <CyberBadge type={severityBadgeType(finding.severity)} label={finding.severity} size="sm" />}
      </div>
      <span className="text-xs text-muted-foreground">{finding.tool}</span>
    </div>
  )
}

function ModifiedCard({ before, after }: { before: ComparisonFinding; after: ComparisonFinding }) {
  const t = useTranslations('compare')
  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm text-foreground">{after.title}</span>
        <span className="text-xs text-muted-foreground">{after.tool}</span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {before.severity && <CyberBadge type={severityBadgeType(before.severity)} label={`${t('before')}: ${before.severity}`} size="sm" />}
        <span className="text-muted-foreground">→</span>
        {after.severity && <CyberBadge type={severityBadgeType(after.severity)} label={`${t('after')}: ${after.severity}`} size="sm" />}
      </div>
    </div>
  )
}

function Section({
  title, icon: Icon, count, color, children,
}: { title: string; icon: typeof Plus; count: number; color: string; children: React.ReactNode }) {
  const t = useTranslations('compare')
  return (
    <CyberCard>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <h3 className="font-semibold text-foreground">{title}</h3>
        <span className={cn('ml-auto font-mono text-sm', color)}>{count}</span>
      </div>
      {count === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </CyberCard>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={null}>
      <ComparePageInner />
    </Suspense>
  )
}

function ComparePageInner() {
  const t = useTranslations('compare')
  const searchParams = useSearchParams()
  const idA = searchParams.get('a') || ''
  const idB = searchParams.get('b') || ''

  const [result, setResult]   = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!idA || !idB) {
      setError(t('missingParams'))
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await compareScans(idA, idB)
      if (cancelled) return
      if (err) setError(err.error)
      else setResult(data ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [idA, idB])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> {t('backToHistory')}
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {idA.slice(0, 8)}… vs {idB.slice(0, 8)}…
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> {t('loading')}
            </div>
          )}

          {!loading && error && (
            <EmptyState icon={AlertTriangle} title={t('errorTitle')} detail={error} />
          )}

          {!loading && result && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: t('new'),        value: result.summary.new,        color: 'text-red-400',     border: 'border-red-900/40' },
                  { label: t('resolved'),   value: result.summary.resolved,   color: 'text-emerald-400', border: 'border-emerald-900/40' },
                  { label: t('persistent'), value: result.summary.persistent, color: 'text-muted-foreground', border: 'border-[hsl(var(--border))]' },
                  { label: t('modified'),   value: result.summary.modified,   color: 'text-amber-400',   border: 'border-amber-900/40' },
                ].map(k => (
                  <div key={k.label} className={cn('rounded-lg border p-4 text-center', k.border)}>
                    <div className={cn('font-mono text-2xl font-bold', k.color)}>{k.value}</div>
                    <div className="text-xs text-muted-foreground">{k.label}</div>
                  </div>
                ))}
              </div>

              <Section title={t('newFindings')} icon={Plus} count={result.new.length} color="text-red-400">
                {result.new.map((f, i) => <FindingCard key={i} finding={f} />)}
              </Section>

              <Section title={t('resolvedFindings')} icon={Minus} count={result.resolved.length} color="text-emerald-400">
                {result.resolved.map((f, i) => <FindingCard key={i} finding={f} />)}
              </Section>

              <Section title={t('modified')} icon={RefreshCcw} count={result.modified.length} color="text-amber-400">
                {result.modified.map((m, i) => <ModifiedCard key={i} before={m.before} after={m.after} />)}
              </Section>

              <Section title={t('persistent')} icon={Equal} count={result.persistent.length} color="text-muted-foreground">
                {result.persistent.map((f, i) => <FindingCard key={i} finding={f} />)}
              </Section>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
