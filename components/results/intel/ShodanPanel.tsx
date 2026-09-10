'use client'
// components/results/intel/ShodanPanel.tsx — SecureScan Pro v5.1
// Panel de exposición externa vía Shodan InternetDB. Mismo patrón que
// VirusTotalPanel / AbuseIPDBPanel.

import { Radar, ExternalLink, ShieldAlert } from 'lucide-react'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'

export interface ShodanResult {
  host: string
  ip: string
  available: boolean
  simulated: boolean
  ports: number[]
  hostnames: string[]
  cpes: string[]
  tags: string[]
  vulns: string[]
  permalink: string | null
  error: string | null
}

interface ShodanPanelProps {
  data?: ShodanResult
}

const RISKY_TAGS = new Set(['compromised', 'malware', 'honeypot', 'tor'])

export function ShodanPanel({ data }: ShodanPanelProps) {
  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <Radar className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">Shodan aún no tiene resultados</p>
      </div>
    )
  }

  const hasVulns   = data.vulns.length > 0
  const riskyTags  = data.tags.filter((t) => RISKY_TAGS.has(t.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hasVulns || riskyTags.length > 0 ? (
          <CyberBadge type={hasVulns ? 'critical' : 'medium'} size="sm" label={hasVulns ? `${data.vulns.length} CVE(s) conocidos` : 'Tags de riesgo detectados'} />
        ) : (
          <CyberBadge type="completed" size="sm" label={`${data.ports.length} puerto(s) expuesto(s)`} />
        )}
        {data.simulated && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
            Simulación
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
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.ports.length}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">puertos abiertos</div>
        </CyberCard>
        <CyberCard variant={hasVulns ? 'critical' : 'default'} padding="p-3">
          <div className={cn('font-mono text-2xl font-bold leading-none', hasVulns ? 'text-red-400' : 'text-foreground')}>{data.vulns.length}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">CVEs conocidos</div>
        </CyberCard>
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.hostnames.length}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">hostnames</div>
        </CyberCard>
        <CyberCard variant={riskyTags.length > 0 ? 'medium' : 'default'} padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.tags.length}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">tags</div>
        </CyberCard>
      </div>

      {data.ports.length > 0 && (
        <div>
          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">Puertos abiertos</h4>
          <div className="flex flex-wrap gap-1.5">
            {data.ports.map((port) => (
              <span key={port} className="rounded bg-[hsl(var(--muted))]/50 px-2 py-0.5 font-mono text-[11px] text-foreground">
                {port}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.tags.length > 0 && (
        <div>
          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">Tags</h4>
          <div className="flex flex-wrap gap-1.5">
            {data.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  'rounded px-2 py-0.5 font-mono text-[11px]',
                  RISKY_TAGS.has(tag.toLowerCase())
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : 'bg-[hsl(var(--muted))]/50 text-muted-foreground',
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasVulns && (
        <div className="space-y-2">
          <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">CVEs por firma de banner</h4>
          <div className="space-y-1.5">
            {data.vulns.map((cve) => (
              <div key={cve} className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.05] px-3 py-2 text-sm">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--cyber-accent)] hover:underline"
                >
                  {cve}
                </a>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Basado en la versión reportada en el banner del servicio — puede estar parchado y seguir mostrando la versión vieja. Confirma antes de reportarlo como hallazgo.
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
          Ver host completo en Shodan
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
