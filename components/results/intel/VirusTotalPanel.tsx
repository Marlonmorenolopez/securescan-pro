'use client'
// components/results/intel/VirusTotalPanel.tsx — SecureScan Pro v5.1
// Panel de reputación de dominio/IP vía VirusTotal.
// Vive dentro de la pestaña "Huella Digital" — cada herramienta nueva de ese
// grupo (AbuseIPDB, Shodan, crt.sh...) sigue este mismo patrón: recibe su
// propio slice de currentScan.threat_intel y se agrega a results-dashboard.tsx.

import { ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'

export interface VirusTotalResult {
  host: string
  available: boolean
  simulated: boolean
  malicious: number
  suspicious: number
  undetected: number
  harmless: number
  reputation: number
  categories: Record<string, string>
  engines_flagged: { engine: string; category: string; result: string | null }[]
  permalink: string | null
  error: string | null
}

interface VirusTotalPanelProps {
  data?: VirusTotalResult
}

export function VirusTotalPanel({ data }: VirusTotalPanelProps) {
  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">VirusTotal aún no tiene resultados</p>
      </div>
    )
  }

  const flagged = data.malicious + data.suspicious
  const total   = data.malicious + data.suspicious + data.undetected + data.harmless

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {flagged > 0 ? (
          <CyberBadge type={data.malicious > 0 ? 'critical' : 'medium'} size="sm" label={`${flagged} motor(es) en alerta`} />
        ) : (
          <CyberBadge type="completed" size="sm" label="Limpio" />
        )}
        {data.simulated && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
            Simulación
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">host: {data.host}</span>
      </div>

      {data.error && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          {data.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CyberCard variant={data.malicious > 0 ? 'critical' : 'default'} padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-red-400">{data.malicious}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">maliciosos</div>
        </CyberCard>
        <CyberCard variant={data.suspicious > 0 ? 'medium' : 'default'} padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-amber-400">{data.suspicious}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">sospechosos</div>
        </CyberCard>
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.undetected}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">sin detectar</div>
        </CyberCard>
        <CyberCard variant="success" padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-emerald-400">{data.harmless}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">limpios</div>
        </CyberCard>
      </div>

      {total > 0 && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]/40">
          <div className="flex h-full">
            <div className="bg-red-500" style={{ width: `${(data.malicious / total) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(data.suspicious / total) * 100}%` }} />
            <div className="bg-emerald-500" style={{ width: `${(data.harmless / total) * 100}%` }} />
          </div>
        </div>
      )}

      {data.engines_flagged.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Motores que marcaron el host
          </h4>
          <div className="space-y-1.5">
            {data.engines_flagged.map((e, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
                  e.category === 'malicious'
                    ? 'border-red-500/30 bg-red-500/[0.05]'
                    : 'border-amber-500/30 bg-amber-500/[0.05]',
                )}
              >
                <span className="flex items-center gap-2">
                  <ShieldAlert className={cn('h-3.5 w-3.5 shrink-0', e.category === 'malicious' ? 'text-red-400' : 'text-amber-400')} />
                  {e.engine}
                </span>
                {e.result && (
                  <span className="truncate font-mono text-xs text-muted-foreground">{e.result}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {data.permalink && (
        <a
          href={data.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--cyber-accent)] hover:underline"
        >
          Ver reporte completo en VirusTotal
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}
