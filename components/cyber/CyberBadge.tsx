// components/cyber/CyberBadge.tsx — SecureScan Pro v5.0
// Badge de severidad/estado con dot de color pulsante.
// Soporta las 5 severidades estándar de CVSS más estados operacionales.

import { cn } from '@/lib/utils'

export type BadgeSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type BadgeStatus   = 'running' | 'completed' | 'error' | 'idle' | 'pending'
export type BadgeType     = BadgeSeverity | BadgeStatus

interface CyberBadgeProps {
  type:     BadgeType
  label?:   string          // Sobreescribe el label por defecto
  pulse?:   boolean         // Dot pulsante (por defecto true en running)
  size?:    'sm' | 'md'
  className?: string
}

const config: Record<BadgeType, { bg: string; text: string; dot: string; label: string }> = {
  // Severidades CVSS
  critical:  { bg: 'bg-red-500/10',     text: 'text-red-400',    dot: 'bg-red-500',    label: 'Critical' },
  high:      { bg: 'bg-orange-500/10',  text: 'text-orange-400', dot: 'bg-orange-500', label: 'High'     },
  medium:    { bg: 'bg-amber-500/10',   text: 'text-amber-400',  dot: 'bg-amber-500',  label: 'Medium'   },
  low:       { bg: 'bg-blue-500/10',    text: 'text-blue-400',   dot: 'bg-blue-400',   label: 'Low'      },
  info:      { bg: 'bg-slate-500/10',   text: 'text-slate-400',  dot: 'bg-slate-400',  label: 'Info'     },
  // Estados operacionales
  running:   { bg: 'bg-[rgba(var(--cyber-accent-rgb),0.10)]', text: 'text-[var(--cyber-accent)]', dot: 'bg-[var(--cyber-accent)]', label: 'Running'   },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400',dot: 'bg-emerald-500',label: 'Completed' },
  error:     { bg: 'bg-red-500/10',     text: 'text-red-400',    dot: 'bg-red-500',    label: 'Error'    },
  idle:      { bg: 'bg-slate-500/10',   text: 'text-slate-500',  dot: 'bg-slate-500',  label: 'Idle'     },
  pending:   { bg: 'bg-yellow-500/10',  text: 'text-yellow-400', dot: 'bg-yellow-500', label: 'Pending'  },
}

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-2   py-0.5 text-xs     gap-1.5',
}

export function CyberBadge({ type, label, pulse, size = 'md', className }: CyberBadgeProps) {
  const c = config[type]
  const shouldPulse = pulse ?? type === 'running'

  return (
    <span className={cn(
      'inline-flex items-center rounded border font-mono font-semibold uppercase tracking-wider',
      'border-current/20',
      c.bg, c.text,
      sizeStyles[size],
      className
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full shrink-0',
        c.dot,
        shouldPulse && 'animate-[cyber-pulse_2s_ease-in-out_infinite]'
      )} />
      {label ?? c.label}
    </span>
  )
}
