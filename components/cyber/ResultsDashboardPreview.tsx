'use client'
// components/cyber/ResultsDashboardPreview.tsx — SecureScan Pro · Home v3
//
// Vista resumida del resultado de un scan, reutilizando EXACTAMENTE la misma
// estructura que components/results-dashboard.tsx → ScoreCard (SecurityScore)
// más una lista de top vulnerabilidades (mismo tipo Vulnerability).
//
// FUENTE DE DATOS: recibe `score: SecurityScore` y `vulnerabilities:
// Vulnerability[]` — el mismo shape exacto que devuelve getScanResults(id).
// Para conectar datos reales: pasar el resultado real del último scan en vez
// del mock, sin tocar este componente.

import { CyberCard } from './CyberCard'
import { CyberPanel } from './CyberPanel'
import { CyberBadge } from './CyberBadge'
import { RiskGauge } from './RiskGauge'
import { cn } from '@/lib/utils'
import type { SecurityScore, Vulnerability } from '@/lib/api-client'
import { FileText } from 'lucide-react'

const severityToBadge: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
  info: 'info',
}

interface ResultsDashboardPreviewProps {
  score: SecurityScore
  vulnerabilities: Vulnerability[]
  className?: string
}

export function ResultsDashboardPreview({ score, vulnerabilities, className }: ResultsDashboardPreviewProps) {
  const breakdownItems: { key: keyof SecurityScore['breakdown']; label: string; color: string }[] = [
    { key: 'critical', label: 'Critical', color: 'bg-red-600'    },
    { key: 'high',     label: 'High',     color: 'bg-orange-500' },
    { key: 'medium',   label: 'Medium',   color: 'bg-amber-500'  },
    { key: 'low',      label: 'Low',      color: 'bg-blue-500'   },
    { key: 'info',     label: 'Info',     color: 'bg-slate-500'  },
  ]

  return (
    <div className={cn('grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_1.4fr]', className)}>
      {/* Score + breakdown — mismo lenguaje visual que el Scanner real */}
      <CyberCard glow className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <RiskGauge total={score.total} grade={score.grade} size={132} />
        <div className="grid w-full grid-cols-5 gap-2 sm:grid-cols-2">
          {breakdownItems.map(item => (
            <div key={item.key} className="rounded-md bg-[hsl(var(--muted))]/40 p-2 text-center">
              <span className={cn('mx-auto mb-1.5 block h-1.5 w-8 rounded-full', item.color)} />
              <span className="block font-mono text-lg font-bold text-foreground">
                {score.breakdown[item.key] ?? 0}
              </span>
              <span className="block font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </CyberCard>

      {/* Top vulnerabilidades — mismos campos que Vulnerability real */}
      <CyberPanel
        title="Top Vulnerabilities"
        subtitle="Último escaneo · resumen de ejemplo"
        action={<CyberBadge type="info" label={`${vulnerabilities.length} found`} size="sm" />}
        noPadding
      >
        <div className="divide-y divide-[hsl(var(--border))]/60">
          {vulnerabilities.slice(0, 5).map(v => (
            <div key={v.id} className="flex min-w-0 items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                  {v.tool} · {v.url}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {v.cvss !== undefined && (
                  <span className="font-mono text-[10px] text-muted-foreground">CVSS {v.cvss.toFixed(1)}</span>
                )}
                <CyberBadge type={severityToBadge[v.risk ?? 'info']} size="sm" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1.5 border-t border-[hsl(var(--border))] px-5 py-3">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Reporte completo disponible al finalizar un escaneo real
          </span>
        </div>
      </CyberPanel>
    </div>
  )
}
