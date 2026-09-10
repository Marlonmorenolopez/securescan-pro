'use client'
// components/cyber/CyberStat.tsx — SecureScan Pro v5.0
// KPI card con:
//   - Contador animado (ease-out cubic) al montar o al cambiar value
//   - Color configurable por severidad
//   - Icono opcional
//   - Dot de estado pulsante opcional

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export type StatColor = 'cyber' | 'red' | 'orange' | 'amber' | 'blue' | 'green' | 'purple' | 'muted'

interface CyberStatProps {
  label:      string
  value:      number
  suffix?:    string
  color?:     StatColor
  icon?:      LucideIcon
  pulse?:     boolean
  className?: string
}

const colorMap: Record<StatColor, { value: string; dot: string; icon: string }> = {
  cyber:  { value: 'text-[var(--cyber-accent)]',  dot: 'bg-[var(--cyber-accent)]',  icon: 'text-[var(--cyber-accent)]'  },
  red:    { value: 'text-red-400',                dot: 'bg-red-500',                icon: 'text-red-400'                },
  orange: { value: 'text-orange-400',             dot: 'bg-orange-500',             icon: 'text-orange-400'             },
  amber:  { value: 'text-amber-400',              dot: 'bg-amber-500',              icon: 'text-amber-400'              },
  blue:   { value: 'text-blue-400',               dot: 'bg-blue-400',               icon: 'text-blue-400'               },
  green:  { value: 'text-emerald-400',            dot: 'bg-emerald-500',            icon: 'text-emerald-400'            },
  purple: { value: 'text-violet-400',             dot: 'bg-violet-500',             icon: 'text-violet-400'             },
  muted:  { value: 'text-muted-foreground',       dot: 'bg-muted-foreground',       icon: 'text-muted-foreground'       },
}

function useAnimatedCounter(target: number, duration = 800) {
  const [displayed, setDisplayed] = useState(0)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const start    = performance.now()
    const from     = displayed

    const tick = (now: number) => {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased    = 1 - Math.pow(1 - progress, 3)
      setDisplayed(Math.round(from + (target - from) * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
    // Solo re-corre cuando target cambia — ignorar 'displayed' para evitar loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return displayed
}

export function CyberStat({ label, value, suffix = '', color = 'cyber', icon: Icon, pulse = false, className }: CyberStatProps) {
  const c          = colorMap[color]
  const displayed  = useAnimatedCounter(value)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Icono + dot */}
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn('h-4 w-4 shrink-0', c.icon)} />}
        {pulse && (
          <span className={cn(
            'h-2 w-2 rounded-full shrink-0 status-dot',
            c.dot
          )} />
        )}
      </div>

      {/* Valor */}
      <span className={cn('font-mono text-3xl font-bold tabular-nums leading-none', c.value)}>
        {displayed.toLocaleString()}{suffix}
      </span>

      {/* Label */}
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
    </div>
  )
}
