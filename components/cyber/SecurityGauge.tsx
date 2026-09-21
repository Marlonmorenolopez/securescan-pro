'use client'
// components/cyber/SecurityGauge.tsx — SecureScan Pro v5.0 · 3D Concentric Holographic Gauge

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface SecurityGaugeProps {
  score: number // 0 - 100
  grade?: string // 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' etc.
  riskLevel?: string // 'COMPROMETIDO' | 'EXPUESTO' | 'VULNERABLE' | 'PROTEGIDO' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL'
  size?: 'sm' | 'md' | 'lg'
  showTicks?: boolean
  label?: string
  className?: string
}

const sizeMap = {
  sm: { diameter: 140, strokeWidth: 8, fontSize: 'text-2xl', labelSize: 'text-[10px]' },
  md: { diameter: 200, strokeWidth: 10, fontSize: 'text-4xl', labelSize: 'text-xs' },
  lg: { diameter: 260, strokeWidth: 12, fontSize: 'text-5xl', labelSize: 'text-sm' },
}

export function SecurityGauge({
  score,
  grade,
  riskLevel,
  size = 'md',
  showTicks = true,
  label = 'SECURITY SCORE',
  className,
}: SecurityGaugeProps) {
  const prefersReduced = useReducedMotion() ?? false
  const cfg = sizeMap[size]
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)))

  // Radio y circunferencia para el arco SVG
  const radius = cfg.diameter / 2 - cfg.strokeWidth - 8
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (circumference * clampedScore) / 100

  // Determinación de color semántico según puntuación real
  const { strokeColor, glowColor, textColor, gradeColor } = useMemo(() => {
    if (clampedScore >= 80) {
      return {
        strokeColor: '#10B981', // Secure Green
        glowColor: 'rgba(16, 185, 129, 0.25)',
        textColor: 'text-emerald-400',
        gradeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      }
    }
    if (clampedScore >= 60) {
      return {
        strokeColor: '#00F0FF', // Tech Cyan / Safe
        glowColor: 'rgba(0, 240, 255, 0.25)',
        textColor: 'text-[var(--cyber-accent)]',
        gradeColor: 'border-[var(--cyber-accent)]/40 bg-[var(--cyber-accent)]/10 text-[var(--cyber-accent)]',
      }
    }
    if (clampedScore >= 40) {
      return {
        strokeColor: '#F59E0B', // Warning Amber
        glowColor: 'rgba(245, 158, 11, 0.25)',
        textColor: 'text-amber-400',
        gradeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      }
    }
    return {
      strokeColor: '#EF4444', // Critical Red
      glowColor: 'rgba(239, 68, 68, 0.30)',
      textColor: 'text-red-400',
      gradeColor: 'border-red-500/40 bg-red-500/10 text-red-300',
    }
  }, [clampedScore])

  // Marcas de graduación radiales (ticks)
  const ticks = useMemo(() => {
    if (!showTicks || size === 'sm') return []
    const totalTicks = 40
    const tickRadius = cfg.diameter / 2 - 4
    return Array.from({ length: totalTicks }).map((_, i) => {
      const angle = (i * 360) / totalTicks - 90
      const rad = (angle * Math.PI) / 180
      const x1 = cfg.diameter / 2 + (tickRadius - 3) * Math.cos(rad)
      const y1 = cfg.diameter / 2 + (tickRadius - 3) * Math.sin(rad)
      const x2 = cfg.diameter / 2 + tickRadius * Math.cos(rad)
      const y2 = cfg.diameter / 2 + tickRadius * Math.sin(rad)
      const active = (i / totalTicks) * 100 <= clampedScore
      return { x1, y1, x2, y2, active }
    })
  }, [showTicks, size, cfg.diameter, clampedScore])

  return (
    <div className={cn('relative flex flex-col items-center justify-center select-none', className)}>
      <div
        className="relative flex items-center justify-center"
        style={{ width: cfg.diameter, height: cfg.diameter }}
      >
        <svg
          width={cfg.diameter}
          height={cfg.diameter}
          className="rotate-[-90deg] overflow-visible"
        >
          {/* Ticks perimetrales HUD */}
          {ticks.map((t, idx) => (
            <line
              key={idx}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.active ? strokeColor : 'rgba(255,255,255,0.08)'}
              strokeWidth={1.5}
              className="transition-colors duration-300"
            />
          ))}

          {/* Anillo de fondo */}
          <circle
            cx={cfg.diameter / 2}
            cy={cfg.diameter / 2}
            r={radius}
            fill="none"
            stroke="rgba(0, 240, 255, 0.08)"
            strokeWidth={cfg.strokeWidth}
          />

          {/* Anillo de progreso animado */}
          <motion.circle
            cx={cfg.diameter / 2}
            cy={cfg.diameter / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={cfg.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: prefersReduced ? 0 : 1.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>

        {/* Núcleo central holográfico */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          {label && (
            <span className={cn('font-mono uppercase tracking-widest text-muted-foreground/70 font-semibold mb-0.5', cfg.labelSize)}>
              {label}
            </span>
          )}

          <div className={cn('font-mono font-bold tracking-tight', textColor, cfg.fontSize)}>
            {clampedScore}
            <span className="text-xs text-muted-foreground/60 font-normal ml-0.5">/100</span>
          </div>

          <div className="flex items-center gap-1.5 mt-1">
            {grade && (
              <span className={cn('font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border', gradeColor)}>
                {grade}
              </span>
            )}
            {riskLevel && (
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 bg-slate-900/60 border border-slate-800 px-1.5 py-0.5 rounded">
                {riskLevel}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
