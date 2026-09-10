'use client'
// components/cyber/CyberCard.tsx — SecureScan Pro v5.0
// Tarjeta base con identidad Offensive Security:
//   - Corner brackets decorativos (posición absoluta, CSS puro)
//   - Glow en hover configurable
//   - Variantes por severidad
//   - Sin dependencias externas — solo Tailwind + cn()

import { cn } from '@/lib/utils'
import { HTMLAttributes, forwardRef } from 'react'

export type CyberCardVariant = 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'ghost'

interface CyberCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CyberCardVariant
  glow?: boolean
  /** Mostrar corner brackets decorativos */
  brackets?: boolean
  /** Padding interno (por defecto: p-4) */
  padding?: string
}

const variantStyles: Record<CyberCardVariant, string> = {
  default:  'border-[hsl(var(--border))] hover:border-[rgba(var(--cyber-accent-rgb),0.35)]',
  critical: 'border-red-900/60 hover:border-red-500/70 bg-red-950/20',
  high:     'border-orange-900/50 hover:border-orange-500/60 bg-orange-950/10',
  medium:   'border-amber-900/50 hover:border-amber-500/60 bg-amber-950/10',
  low:      'border-blue-900/50 hover:border-blue-500/60 bg-blue-950/10',
  success:  'border-emerald-900/50 hover:border-emerald-500/60 bg-emerald-950/10',
  ghost:    'border-transparent hover:border-[rgba(var(--cyber-accent-rgb),0.20)] bg-transparent',
}

const bracketColor: Record<CyberCardVariant, string> = {
  default:  'border-[rgba(var(--cyber-accent-rgb),0.45)]',
  critical: 'border-red-500/60',
  high:     'border-orange-500/55',
  medium:   'border-amber-500/55',
  low:      'border-blue-500/55',
  success:  'border-emerald-500/55',
  ghost:    'border-[rgba(var(--cyber-accent-rgb),0.30)]',
}

export const CyberCard = forwardRef<HTMLDivElement, CyberCardProps>(
  ({ className, variant = 'default', glow = false, brackets = true, padding = 'p-4', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-lg border bg-[hsl(var(--card))]',
          'transition-all duration-300 ease-out',
          variantStyles[variant],
          glow && 'hover:shadow-cyber',
          padding,
          className
        )}
        {...props}
      >
        {brackets && (
          <>
            {/* Top-left bracket */}
            <span className={cn(
              'pointer-events-none absolute left-0 top-0 h-3 w-3',
              'border-l-2 border-t-2 rounded-tl-md',
              bracketColor[variant]
            )} />
            {/* Bottom-right bracket */}
            <span className={cn(
              'pointer-events-none absolute bottom-0 right-0 h-3 w-3',
              'border-b-2 border-r-2 rounded-br-md',
              bracketColor[variant]
            )} />
          </>
        )}
        {children}
      </div>
    )
  }
)

CyberCard.displayName = 'CyberCard'
