'use client'
// components/cyber/CyberMetric.tsx — SecureScan Pro v5.0 · Tactical Metric Indicator

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface CyberMetricProps {
  label: string
  value: string | number
  subtext?: string
  icon?: ReactNode
  status?: 'critical' | 'warning' | 'secure' | 'info' | 'neutral'
  className?: string
}

const statusColors = {
  critical: 'text-red-400 border-red-500/30 bg-red-950/10',
  warning:  'text-amber-400 border-amber-500/30 bg-amber-950/10',
  secure:   'text-emerald-400 border-emerald-500/30 bg-emerald-950/10',
  info:     'text-[var(--cyber-accent)] border-[rgba(var(--cyber-accent-rgb),0.30)] bg-[rgba(0,240,255,0.06)]',
  neutral:  'text-foreground border-[hsl(var(--border))] bg-[hsl(var(--card))]',
}

const valueColors = {
  critical: 'text-red-400',
  warning:  'text-amber-400',
  secure:   'text-emerald-400',
  info:     'text-[var(--cyber-accent)]',
  neutral:  'text-foreground',
}

export function CyberMetric({
  label,
  value,
  subtext,
  icon,
  status = 'neutral',
  className,
}: CyberMetricProps) {
  return (
    <div
      className={cn(
        'relative rounded-md border p-3 flex flex-col justify-between transition-all duration-200',
        statusColors[status],
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span className="font-mono text-[10px] tracking-wider uppercase truncate font-medium">
          {label}
        </span>
        {icon && <span className="opacity-80 shrink-0">{icon}</span>}
      </div>

      {/* Main Value */}
      <div className={cn('font-mono font-bold text-2xl tracking-tight my-0.5', valueColors[status])}>
        {value}
      </div>

      {/* Subtext */}
      {subtext && (
        <div className="text-[11px] text-muted-foreground/80 font-mono truncate mt-0.5">
          {subtext}
        </div>
      )}
    </div>
  )
}
