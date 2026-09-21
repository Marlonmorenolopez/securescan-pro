'use client'
// components/results/intel/SafeBrowsingPanel.tsx — SecureScan Pro v5.1
// Panel de Google Safe Browsing — misma base que usan Chrome/Firefox para
// bloquear sitios maliciosos. Mismo patrón que los otros 6 paneles.

import { ShieldBan, ShieldCheck, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CyberBadge } from '@/components/cyber/CyberBadge'

export interface SafeBrowsingResult {
  host: string
  url: string
  available: boolean
  simulated: boolean
  flagged: boolean
  threats: string[]
  error: string | null
}

interface SafeBrowsingPanelProps {
  data?: SafeBrowsingResult
}

export function SafeBrowsingPanel({ data }: SafeBrowsingPanelProps) {
  const t = useTranslations('intel')
  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">{t('sb.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {data.flagged ? (
          <CyberBadge type="critical" size="sm" label={t('sb.flaggedBadge')} />
        ) : (
          <CyberBadge type="completed" size="sm" label={t('sb.notFlagged')} />
        )}
        {data.simulated && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
            {t('noRealData')}
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">{data.url}</span>
      </div>

      {data.error && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          {data.error}
        </p>
      )}

      {data.flagged ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.05] px-3 py-3">
          <ShieldBan className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-400">
              {t('sb.browsersBlocking')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.threats.map((threat) => (
                <span key={threat} className="rounded bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-400 border border-red-500/30">
                  {threat}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-3 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-xs text-muted-foreground">
            {t('sb.notFlaggedDetail')}
          </p>
        </div>
      )}

      <a
        href="https://transparencyreport.google.com/safe-browsing/search"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--cyber-accent)] hover:underline"
      >
        {t('sb.transparencyReport')}
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
