'use client'
// components/cyber/CyberPanel.tsx — SecureScan Pro v5.0
// Panel estructurado con header, título, subtítulo y slot de acción.
// Usado en el dashboard SOC para secciones de resultados y configuración.

import { cn } from '@/lib/utils'
import { HTMLAttributes, ReactNode } from 'react'

interface CyberPanelProps extends HTMLAttributes<HTMLDivElement> {
  title:      string
  subtitle?:  string
  /** Slot derecho del header (botones, badges, etc.) */
  action?:    ReactNode
  /** Quitar el padding del body (útil para tablas que llegan al borde) */
  noPadding?: boolean
}

export function CyberPanel({ title, subtitle, action, noPadding = false, className, children, ...props }: CyberPanelProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
        'transition-colors duration-300',
        'hover:border-[rgba(var(--cyber-accent-rgb),0.25)]',
        className
      )}
      {...props}
    >
      {/* Corner brackets */}
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-[rgba(var(--cyber-accent-rgb),0.40)] rounded-tl-md" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-[rgba(var(--cyber-accent-rgb),0.40)] rounded-br-md" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border))] px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-foreground truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
        </div>
        {action && (
          <div className="shrink-0">{action}</div>
        )}
      </div>

      {/* Body */}
      <div className={cn(!noPadding && 'p-5')}>
        {children}
      </div>
    </div>
  )
}
