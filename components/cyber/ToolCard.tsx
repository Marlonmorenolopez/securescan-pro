'use client'
// components/cyber/ToolCard.tsx — SecureScan Pro v5.0
// Tarjeta de herramienta individual, reutilizada en /scanner, /osint,
// /code-scan y /lab. Evoluciona CyberCard (no lo duplica): agrega
// superficie "glass" con glow controlado por categoría/estado, y un
// vocabulario visual consistente de estado (idle/running/completed/error).
//
// Todos los datos que muestra (status, resultLabel) vienen del CALLER —
// este componente no inventa ni asume nada, solo presenta.

import { CheckCircle2, XCircle, Loader2, Clock, MinusCircle } from 'lucide-react'
import { CyberCard } from '@/components/cyber/CyberCard'
import { COLOR_VARS, type CyberColor } from '@/lib/nav-config'
import { cn } from '@/lib/utils'

export type ToolStatus = 'idle' | 'running' | 'completed' | 'error' | 'skipped'

interface ToolCardProps {
  name: string
  icon?: React.ElementType
  svgIcon?: React.FC<{ className?: string }>
  category?: string
  color?: CyberColor
  description?: string
  status: ToolStatus
  /** Etiqueta de resultado YA calculada por el caller a partir de datos reales — ej. "12 hallazgos". Omitir si no hay dato. */
  resultLabel?: string
  onClick?: () => void
  className?: string
  /** Variante compacta (fila) para grillas densas como el ToolGrid de /scanner */
  compact?: boolean
}

const STATUS_META: Record<ToolStatus, { icon: React.ElementType; label: string; cls: string }> = {
  idle:      { icon: Clock,        label: 'En espera',  cls: 'text-muted-foreground/50' },
  running:   { icon: Loader2,      label: 'Ejecutando', cls: 'text-[var(--cyber-accent)]' },
  completed: { icon: CheckCircle2, label: 'Completado',  cls: 'text-emerald-400' },
  error:     { icon: XCircle,      label: 'Error',       cls: 'text-red-400' },
  skipped:   { icon: MinusCircle,  label: 'Omitido',     cls: 'text-muted-foreground/40' },
}

export function ToolCard({
  name, icon: Icon, svgIcon: SvgIcon, category, color = 'cyan', description,
  status, resultLabel, onClick, className, compact = false,
}: ToolCardProps) {
  const c = COLOR_VARS[color]
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-all duration-200',
          status === 'running'   && 'bg-[rgba(var(--cyber-accent-rgb),0.06)] border-[rgba(var(--cyber-accent-rgb),0.25)]',
          status === 'completed' && 'border-emerald-900/30 bg-emerald-500/5',
          status === 'error'     && 'border-red-900/30 bg-red-500/5',
          status === 'idle'      && 'border-transparent bg-transparent',
          status === 'skipped'   && 'border-transparent bg-transparent opacity-60',
          onClick && 'cursor-pointer hover:border-[rgba(var(--c-rgb),0.35)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
          !onClick && 'cursor-default',
          className
        )}
        style={{ ['--c-rgb' as string]: c.rgb }}
      >
        <span className="shrink-0">
          {SvgIcon ? <SvgIcon className="h-3.5 w-3.5" /> : Icon ? <Icon className="h-3.5 w-3.5" style={{ color: c.fg }} /> : null}
        </span>
        <span className="flex-1 truncate font-mono text-[10px] text-foreground/75">{name}</span>
        {resultLabel && (
          <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums" style={{ color: c.fg }}>
            {resultLabel}
          </span>
        )}
        <StatusIcon className={cn('h-3 w-3 shrink-0', meta.cls, status === 'running' && 'animate-spin')} />
      </button>
    )
  }

  return (
    <CyberCard
      variant="ghost"
      padding="p-4"
      brackets={status !== 'idle'}
      className={cn(
        'group relative flex flex-col gap-2.5 transition-all duration-300 depth-1',
        onClick && 'cursor-pointer hover:-translate-y-1 hover:depth-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={{
        borderColor: status === 'idle' ? undefined : `rgba(${c.rgb},0.28)`,
        background: status === 'running' ? `rgba(${c.rgb},0.06)` : undefined,
        boxShadow: status === 'running' ? `0 0 18px rgba(${c.rgb},0.15)` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-all duration-300 group-hover:brightness-125"
            style={{ color: c.fg, borderColor: `rgba(${c.rgb},0.30)`, background: `rgba(${c.rgb},0.08)` }}
          >
            {SvgIcon ? <SvgIcon className="h-4 w-4" /> : Icon ? <Icon className="h-4 w-4" /> : null}
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-xs font-semibold text-foreground">{name}</div>
            {category && (
              <div className="truncate font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {category}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1" title={meta.label}>
          <StatusIcon className={cn('h-3.5 w-3.5', meta.cls, status === 'running' && 'animate-spin')} />
        </div>
      </div>

      {description && (
        <p className="text-[11px] leading-snug text-muted-foreground">{description}</p>
      )}

      {resultLabel && (
        <div
          className="mt-auto flex items-center justify-between rounded-md border px-2 py-1"
          style={{ borderColor: `rgba(${c.rgb},0.20)` }}
        >
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Resultado</span>
          <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: c.fg }}>
            {resultLabel}
          </span>
        </div>
      )}
    </CyberCard>
  )
}
