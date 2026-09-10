'use client'
// components/results/intel/DnstwistPanel.tsx — SecureScan Pro v5.1
// Panel de dominios de typosquatting registrados. Mismo patrón que los
// anteriores 5 paneles del grupo "Huella Digital".

import { Copy, ExternalLink, ShieldAlert } from 'lucide-react'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'

export interface DnstwistVariant {
  domain: string
  ip: string
}

export interface DnstwistResult {
  host: string
  domain: string
  available: boolean
  simulated: boolean
  candidates_checked: number
  registered_variants: DnstwistVariant[]
  permalink: string | null
  resolved_from_ip: string | null
  error: string | null
}

interface DnstwistPanelProps {
  data?: DnstwistResult
}

export function DnstwistPanel({ data }: DnstwistPanelProps) {
  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <Copy className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">dnstwist aún no tiene resultados</p>
      </div>
    )
  }

  const found = data.registered_variants.length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {found > 0 ? (
          <CyberBadge type="medium" size="sm" label={`${found} dominio(s) parecido(s) registrado(s)`} />
        ) : (
          <CyberBadge type="completed" size="sm" label="Sin dominios parecidos registrados" />
        )}
        {data.simulated && (
          <span className="rounded border border-yellow-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
            Simulación
          </span>
        )}
        <span className="font-mono text-[11px] text-muted-foreground">dominio: {data.domain}</span>
      </div>

      {data.resolved_from_ip && (
        <p className="text-[11px] text-muted-foreground">
          ↳ descubierto vía DNS reverso desde <span className="text-foreground">{data.resolved_from_ip}</span>
        </p>
      )}

      {data.error && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
          {data.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <CyberCard padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{data.candidates_checked}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">variantes probadas</div>
        </CyberCard>
        <CyberCard variant={found > 0 ? 'medium' : 'default'} padding="p-3">
          <div className="font-mono text-2xl font-bold leading-none text-foreground">{found}</div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">registradas hoy</div>
        </CyberCard>
      </div>

      {found > 0 && (
        <div className="space-y-2">
          <h4 className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Dominios parecidos ya registrados
          </h4>
          <div className="space-y-1.5">
            {data.registered_variants.map((v) => (
              <div key={v.domain} className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate font-mono text-xs text-foreground">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  {v.domain}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{v.ip}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Que un dominio esté registrado no significa que sea malicioso — puede ser tuyo, de un competidor, o estar sin usar. Vale la pena revisarlo si no lo reconoces.
          </p>
        </div>
      )}
    </div>
  )
}
