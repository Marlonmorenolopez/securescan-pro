'use client'
// components/results/intel/CrtShPanel.tsx — SecureScan Pro v5.1
// Panel de subdominios descubiertos vía Certificate Transparency (crt.sh).
// Mismo patrón que VirusTotalPanel / AbuseIPDBPanel / ShodanPanel, pero acá
// el hallazgo principal es una lista, no un score de riesgo.

import { useState } from 'react'
import { Network, ExternalLink, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'

export interface CrtShResult {
  host: string
  domain: string
  available: boolean
  simulated: boolean
  subdomains: string[]
  certificate_count: number
  permalink: string | null
  resolved_from_ip: string | null
  error: string | null
}

interface CrtShPanelProps {
  data?: CrtShResult
}

const VISIBLE_LIMIT = 15

export function CrtShPanel({ data }: CrtShPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const t = useTranslations('intel')

  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <Network className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">{t('crt.empty')}</p>
      </div>
    )
  }

  const visible = expanded ? data.subdomains : data.subdomains.slice(0, VISIBLE_LIMIT)
  const hiddenCount = data.subdomains.length - visible.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {data.subdomains.length > 0 ? (
          <CyberBadge type="info" size="sm" label={t('crt.badge', { count: data.subdomains.length })} />
        ) : (
          <CyberBadge type="completed" size="sm" label={t('crt.none')} />
        )}
        {data.simulated && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
            {t('noRealData')}
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">{t('domain')}: {data.domain}</span>
      </div>

      {data.resolved_from_ip && (
        <p className="text-[11px] text-muted-foreground">
          ↳ {t('reverseDns')} <span className="text-foreground">{data.resolved_from_ip}</span>
        </p>
      )}

      {data.error && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          {data.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.subdomains.length}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t('crt.uniqueSubdomains')}</div>
        </CyberCard>
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.certificate_count}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">{t('crt.certificates')}</div>
        </CyberCard>
      </div>

      {data.subdomains.length > 0 && (
        <div>
          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('crt.subdomainsTitle')}</h4>
          <div className="space-y-1 rounded-lg border border-[hsl(var(--border))] p-2">
            {visible.map((sub) => (
              <div key={sub} className="truncate rounded px-2 py-1 font-mono text-xs text-foreground hover:bg-[hsl(var(--muted))]/40">
                {sub}
              </div>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1.5 flex items-center gap-1 font-mono text-xs text-[var(--cyber-accent)] hover:underline"
            >
              <ChevronDown className="h-3 w-3" />
              {t('crt.seeMore', { count: hiddenCount })}
            </button>
          )}
        </div>
      )}

      {data.permalink && (
        <a
          href={data.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--cyber-accent)] hover:underline"
        >
          {t('crt.fullSearch')}
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
