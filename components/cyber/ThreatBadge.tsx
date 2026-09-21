'use client'
// components/cyber/ThreatBadge.tsx — SecureScan Pro v5.0 · Tactical Severity Badge

import { cn } from '@/lib/utils'

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'secure'

export interface ThreatBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  severity: ThreatSeverity | string
  label?: string
  pulse?: boolean
  size?: 'sm' | 'md'
}

const severityConfig: Record<string, { label: string; badge: string; dot: string }> = {
  critical: {
    label: 'CRITICAL',
    badge: 'border-red-500/40 bg-red-950/30 text-red-300',
    dot: 'bg-red-500',
  },
  high: {
    label: 'HIGH',
    badge: 'border-orange-500/40 bg-orange-950/30 text-orange-300',
    dot: 'bg-orange-500',
  },
  medium: {
    label: 'MEDIUM',
    badge: 'border-amber-500/40 bg-amber-950/30 text-amber-300',
    dot: 'bg-amber-400',
  },
  low: {
    label: 'LOW',
    badge: 'border-sky-500/40 bg-sky-950/30 text-sky-300',
    dot: 'bg-sky-400',
  },
  info: {
    label: 'INFO',
    badge: 'border-slate-600/40 bg-slate-900/40 text-slate-300',
    dot: 'bg-slate-400',
  },
  secure: {
    label: 'SECURE',
    badge: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300',
    dot: 'bg-emerald-400',
  },
}

export function ThreatBadge({
  severity,
  label,
  pulse = false,
  size = 'md',
  className,
  ...props
}: ThreatBadgeProps) {
  const normSev = severity.toLowerCase()
  const cfg = severityConfig[normSev] || severityConfig.info
  const displayLabel = label || cfg.label

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded font-mono font-bold tracking-wider border select-none',
        cfg.badge,
        size === 'sm' ? 'px-1.5 py-0.5 text-[9.5px]' : 'px-2 py-0.5 text-[11px]',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full shrink-0',
          cfg.dot,
          pulse && 'status-dot'
        )}
      />
      {displayLabel}
    </span>
  )
}
