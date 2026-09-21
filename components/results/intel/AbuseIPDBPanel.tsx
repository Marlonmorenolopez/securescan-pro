'use client'
// components/results/intel/AbuseIPDBPanel.tsx — SecureScan Pro v5.1
// Panel de reputación de IP vía AbuseIPDB. Mismo patrón que VirusTotalPanel.

import { ShieldAlert, ExternalLink, Globe2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'

export interface AbuseIPDBResult {
  host: string
  ip: string
  available: boolean
  simulated: boolean
  abuse_confidence_score: number
  total_reports: number
  num_distinct_users: number
  country_code: string | null
  isp: string | null
  usage_type: string | null
  is_whitelisted: boolean | null
  last_reported_at: string | null
  permalink: string | null
  error: string | null
}

interface AbuseIPDBPanelProps {
  data?: AbuseIPDBResult
}

function scoreVariant(score: number): 'critical' | 'medium' | 'success' {
  if (score >= 75) return 'critical'
  if (score >= 25) return 'medium'
  return 'success'
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-red-400'
  if (score >= 25) return 'text-amber-400'
  return 'text-emerald-400'
}

export function AbuseIPDBPanel({ data }: AbuseIPDBPanelProps) {
  const t = useTranslations('intel')
  const locale = useLocale()
  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <Globe2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">{t('abuse.empty')}</p>
      </div>
    )
  }

  const score = data.abuse_confidence_score

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {score >= 25 ? (
          <CyberBadge type={score >= 75 ? 'critical' : 'medium'} size="sm" label={t('abuse.confidenceBadge', { score })} />
        ) : (
          <CyberBadge type="completed" size="sm" label={t('abuse.noRelevant')} />
        )}
        {data.simulated && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
            {t('noRealData')}
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">
          {data.host}{data.ip && data.ip !== data.host ? ` → ${data.ip}` : ''}
        </span>
      </div>

      {data.error && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          {data.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CyberCard variant={scoreVariant(score)} padding="p-3">
          <div className={cn('font-mono text-2xl font-bold leading-none', scoreColor(score))}>{score}%</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t('abuse.confidence')}</div>
        </CyberCard>
        <CyberCard variant={data.total_reports > 0 ? 'medium' : 'default'} padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.total_reports}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t('abuse.totalReports')}</div>
        </CyberCard>
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.num_distinct_users}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t('abuse.distinctUsers')}</div>
        </CyberCard>
        <CyberCard variant={data.is_whitelisted ? 'success' : 'default'} padding="p-3">
          <div className="font-mono text-sm font-bold leading-tight text-foreground">
            {data.is_whitelisted === null ? '—' : data.is_whitelisted ? t('yes') : t('no')}
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t('abuse.whitelisted')}</div>
        </CyberCard>
      </div>

      {(data.country_code || data.isp || data.usage_type) && (
        <div className="flex flex-wrap gap-2">
          {data.country_code && (
            <span className="rounded bg-[hsl(var(--muted))]/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {t('abuse.country')}: {data.country_code}
            </span>
          )}
          {data.isp && (
            <span className="rounded bg-[hsl(var(--muted))]/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              ISP: {data.isp}
            </span>
          )}
          {data.usage_type && (
            <span className="rounded bg-[hsl(var(--muted))]/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {t('abuse.usage')}: {data.usage_type}
            </span>
          )}
        </div>
      )}

      {score >= 25 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="text-xs text-muted-foreground">
            {t('abuse.reportedSummary', { reports: data.total_reports, users: data.num_distinct_users })}
            {data.last_reported_at && ` ${t('abuse.lastReport', { date: new Date(data.last_reported_at).toLocaleDateString(locale) })}`}
          </p>
        </div>
      )}

      {data.permalink && (
        <a
          href={data.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--cyber-accent)] hover:underline"
        >
          {t('abuse.fullReport')}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
