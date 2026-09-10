'use client'
// components/cyber/CyberButton.tsx — SecureScan Pro v5.0

import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Slot, Slottable } from '@radix-ui/react-slot'

export type CyberButtonVariant = 'primary' | 'ghost' | 'outline' | 'destructive' | 'success'
export type CyberButtonSize    = 'sm' | 'md' | 'lg' | 'icon'

interface CyberButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  CyberButtonVariant
  size?:     CyberButtonSize
  loading?:  boolean
  icon?:     React.ReactNode
  /** Renderiza como hijo directo (útil con Link de Next.js) */
  asChild?:  boolean
}

const variantStyles: Record<CyberButtonVariant, string> = {
  primary: [
    'bg-[var(--cyber-accent)] text-[hsl(var(--background))]',
    'font-semibold',
    'hover:brightness-110 hover:shadow-cyber',
    'active:brightness-95',
    'border border-[var(--cyber-accent)]',
  ].join(' '),

  ghost: [
    'bg-transparent text-[var(--cyber-accent)]',
    'border border-[rgba(var(--cyber-accent-rgb),0.30)]',
    'hover:bg-[rgba(var(--cyber-accent-rgb),0.08)]',
    'hover:border-[rgba(var(--cyber-accent-rgb),0.55)]',
    'hover:shadow-cyber-sm',
  ].join(' '),

  outline: [
    'bg-transparent text-foreground',
    'border border-[hsl(var(--border))]',
    'hover:border-[rgba(var(--cyber-accent-rgb),0.40)]',
    'hover:text-[var(--cyber-accent)]',
  ].join(' '),

  destructive: [
    'bg-[var(--cyber-red)] text-white',
    'border border-[var(--cyber-red)]',
    'hover:brightness-110',
    'hover:[box-shadow:0_0_14px_rgba(255,59,59,0.35)]',
  ].join(' '),

  success: [
    'bg-[var(--cyber-green)] text-[hsl(var(--background))]',
    'border border-[var(--cyber-green)]',
    'hover:brightness-105',
    'hover:[box-shadow:0_0_14px_rgba(0,255,136,0.35)]',
  ].join(' '),
}

const sizeStyles: Record<CyberButtonSize, string> = {
  sm:   'h-7  px-3   text-xs  gap-1.5',
  md:   'h-9  px-4   text-sm  gap-2',
  lg:   'h-11 px-6   text-base gap-2.5',
  icon: 'h-9  w-9    text-sm  p-0',
}

export const CyberButton = forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ className, variant = 'ghost', size = 'md', loading = false, icon, asChild = false, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        disabled={!asChild ? isDisabled : undefined}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-mono',
          'transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'select-none',
          isDisabled && 'pointer-events-none opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {/* Con asChild, Slot exige reconocer cuál hijo es el "real" (el que
            recibe href/onClick/ref clonados). icon va fuera de Slottable;
            children (el <Link>/<a> real) va envuelto en Slottable — así
            Slot no se confunde con dos hermanos sueltos. Patrón oficial:
            https://www.radix-ui.com/primitives/docs/utilities/slot */}
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        <Slottable>{children}</Slottable>
      </Comp>
    )
  }
)

CyberButton.displayName = 'CyberButton'
