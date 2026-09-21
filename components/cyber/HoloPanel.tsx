'use client'
// components/cyber/HoloPanel.tsx — SecureScan Pro v5.0 · Holographic HUD Panel

import { ReactNode, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface HoloPanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  moduleId?: string
  title?: ReactNode
  subtitle?: ReactNode
  status?: ReactNode
  timestamp?: boolean | string
  actions?: ReactNode
  glow?: boolean
  variant?: 'default' | 'command' | 'critical' | 'secure' | 'warning'
  compact?: boolean
}

const variantBorders: Record<string, string> = {
  default: 'border-[rgba(var(--cyber-accent-rgb),0.20)] hover:border-[rgba(var(--cyber-accent-rgb),0.35)]',
  command: 'border-[rgba(37,99,235,0.30)] hover:border-[rgba(0,240,255,0.40)]',
  critical: 'border-red-500/40 hover:border-red-500/60 bg-red-950/10',
  secure: 'border-emerald-500/40 hover:border-emerald-500/60 bg-emerald-950/10',
  warning: 'border-amber-500/40 hover:border-amber-500/60 bg-amber-950/10',
}

const variantGlows: Record<string, string> = {
  default: 'hover:shadow-[0_0_20px_-4px_rgba(0,240,255,0.14)]',
  command: 'hover:shadow-[0_0_20px_-4px_rgba(37,99,235,0.18)]',
  critical: 'hover:shadow-[0_0_20px_-4px_rgba(239,68,68,0.20)]',
  secure: 'hover:shadow-[0_0_20px_-4px_rgba(16,185,129,0.20)]',
  warning: 'hover:shadow-[0_0_20px_-4px_rgba(245,158,11,0.20)]',
}

export const HoloPanel = forwardRef<HTMLDivElement, HoloPanelProps>(
  (
    {
      moduleId,
      title,
      subtitle,
      status,
      timestamp = true,
      actions,
      glow = false,
      variant = 'default',
      compact = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-lg border bg-[var(--cyber-surface)] backdrop-blur-md',
          'transition-all duration-200 ease-out holo-depth-1',
          variantBorders[variant],
          glow && variantGlows[variant],
          className
        )}
        {...props}
      >
        {/* Esquinas técnicas (Corner Brackets SVG) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 border-[var(--cyber-accent)]/50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 border-[var(--cyber-accent)]/50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 border-[var(--cyber-accent)]/50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 border-[var(--cyber-accent)]/50"
        />

        {/* Barra superior de telemetría (HUD Header) */}
        {(moduleId || title || status || actions) && (
          <div
            className={cn(
              'flex items-center justify-between border-b border-[rgba(var(--cyber-accent-rgb),0.12)] bg-[rgba(8,14,26,0.65)] px-3.5',
              compact ? 'py-1.5' : 'py-2'
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {moduleId && (
                <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--cyber-accent)]/80 bg-[rgba(0,240,255,0.08)] px-1.5 py-0.5 rounded border border-[var(--cyber-accent)]/20">
                  {moduleId}
                </span>
              )}
              {title && (
                <div className="font-medium text-xs sm:text-sm text-foreground truncate flex items-center gap-1.5">
                  {title}
                </div>
              )}
              {subtitle && (
                <span className="hidden sm:inline-block text-[11px] text-muted-foreground truncate">
                  / {subtitle}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {status && <div className="text-[11px]">{status}</div>}
              {timestamp && (
                <span className="hidden md:inline-block font-mono text-[10px] text-muted-foreground/60 tracking-wider">
                  {typeof timestamp === 'string' ? timestamp : 'UTC::SYNC'}
                </span>
              )}
              {actions && <div className="flex items-center gap-1">{actions}</div>}
            </div>
          </div>
        )}

        {/* Contenido del Panel */}
        <div className={cn(compact ? 'p-3' : 'p-4')}>{children}</div>
      </div>
    )
  }
)

HoloPanel.displayName = 'HoloPanel'
