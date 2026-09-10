'use client'
// components/cyber/RiskGauge.tsx — SecureScan Pro · Home v3
//
// Gauge circular de score de seguridad. Usa EXACTAMENTE el mismo cálculo
// geométrico que ScoreCard en components/results-dashboard.tsx (circunferencia
// r=45, mismo color por letra de grade) para que el Home y el Scanner real
// muestren el mismo lenguaje visual ante el mismo dato.

import { cn } from '@/lib/utils'
import type { Grade } from '@/lib/api-client'

function getGradeColorClass(grade: string): string {
  if (grade.startsWith('A')) return 'text-emerald-400'
  if (grade.startsWith('B')) return 'text-blue-400'
  if (grade.startsWith('C')) return 'text-amber-400'
  if (grade.startsWith('D')) return 'text-orange-400'
  return 'text-red-400'
}

function getGradeStrokeClass(grade: string): string {
  if (grade.startsWith('A')) return 'stroke-emerald-400'
  if (grade.startsWith('B')) return 'stroke-blue-400'
  if (grade.startsWith('C')) return 'stroke-amber-400'
  if (grade.startsWith('D')) return 'stroke-orange-400'
  return 'stroke-red-400'
}

interface RiskGaugeProps {
  /** Score total 0-100, igual que SecurityScore.total */
  total: number
  grade: Grade | string
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}

export function RiskGauge({
  total,
  grade,
  size = 140,
  strokeWidth = 10,
  label,
  className,
}: RiskGaugeProps) {
  const radius = (size - strokeWidth) / 2 - 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, total))
  const strokeDashoffset = circumference - (clamped / 100) * circumference

  return (
    <div className={cn('relative flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg
        className="h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label ?? `Security score ${clamped} de 100, grade ${grade}`}
      >
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-[hsl(var(--muted))]/50"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={cn('transition-all duration-1000', getGradeStrokeClass(grade))}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('font-mono font-bold leading-none', getGradeColorClass(grade))} style={{ fontSize: size * 0.32 }}>
          {grade}
        </span>
        <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          <span aria-hidden="true">·</span>
          {clamped}/100
        </span>
      </div>
    </div>
  )
}
