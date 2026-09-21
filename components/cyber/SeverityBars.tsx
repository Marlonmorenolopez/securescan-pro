// components/cyber/SeverityBars.tsx — SecureScan Pro v5.0
// Panel de distribución de severidad estilo "SECURITY ANALYSIS" del
// documento original (Critical/High/Medium/Low/Info con barras
// proporcionales). Recibe un breakdown YA agregado por el caller a
// partir de datos reales — no calcula ni inventa nada por sí mismo.

'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface SeverityBreakdown {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

const ROWS: { key: keyof SeverityBreakdown; color: string; rgb: string }[] = [
  { key: 'critical', color: 'text-red-400',    rgb: '248, 113, 113' },
  { key: 'high',     color: 'text-orange-400', rgb: '251, 146, 60'  },
  { key: 'medium',   color: 'text-amber-400',  rgb: '251, 191, 36'  },
  { key: 'low',      color: 'text-sky-400',    rgb: '56, 189, 248'  },
  { key: 'info',     color: 'text-slate-400',  rgb: '148, 163, 184' },
]

interface SeverityBarsProps {
  breakdown: SeverityBreakdown
  className?: string
}

export function SeverityBars({ breakdown, className }: SeverityBarsProps) {
  const t = useTranslations('severity')
  const max = Math.max(1, ...ROWS.map(r => breakdown[r.key]))
  const total = ROWS.reduce((sum, r) => sum + breakdown[r.key], 0)

  if (total === 0) {
    return (
      <div className={cn('py-6 text-center text-xs text-muted-foreground', className)}>
        {t('empty')}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2.5', className)}>
      {ROWS.map((row) => {
        const value = breakdown[row.key]
        const pct = Math.max(value > 0 ? 4 : 0, (value / max) * 100)
        return (
          <div key={row.key} className="flex items-center gap-3">
            <span className={cn('w-16 shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wider', row.color)}>
              {t(row.key)}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[hsl(var(--secondary))]/60">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: `rgba(${row.rgb},0.85)`, boxShadow: value > 0 ? `0 0 8px rgba(${row.rgb},0.5)` : undefined }}
              />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-xs font-bold tabular-nums text-foreground">
              {value}
            </span>
          </div>
        )
      })}
    </div>
  )
}
