'use client'
// components/cyber/ScanPipeline.tsx — SecureScan Pro v5.0 · 13-Step Holographic Scan Pipeline

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { TOOL_ICONS } from '@/components/tool-icons'
import type { ScanStep } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export interface ScanPipelineProps {
  steps?: ScanStep[]
  activeStepIndex?: number
  className?: string
}

// Los 13 pasos REALES del backend en orden secuencial
export const PIPELINE_STEPS = [
  { id: 'Huella Digital', name: 'Huella Digital', desc: 'OSINT perimetral (VirusTotal, AbuseIPDB, Shodan)' },
  { id: 'Wappalyzer',     name: 'Wappalyzer',     desc: 'Perfilado de stack y tecnologías web' },
  { id: 'Nmap',           name: 'Nmap',           desc: 'Escaneo de puertos SYN y servicios' },
  { id: 'Patator',        name: 'Patator',        desc: 'Auditoría de autenticación y fuerza bruta' },
  { id: 'Metasploit',     name: 'Metasploit',     desc: 'Validación controlada de exploits' },
  { id: 'ffuf',           name: 'ffuf',           desc: 'Fuzzing de alta velocidad de endpoints' },
  { id: 'Gobuster',       name: 'Gobuster',       desc: 'Enumeración de directorios y recursos' },
  { id: 'ZAP Spider',     name: 'ZAP Spider',     desc: 'Mapeo pasivo de rutas y formularios' },
  { id: 'ZAP',            name: 'OWASP ZAP',      desc: 'Análisis DAST y vulnerabilidades web' },
  { id: 'Nuclei',         name: 'Nuclei',         desc: 'Detección de CVEs conocidos con templates' },
  { id: 'SQLMap',         name: 'SQLMap',         desc: 'Detección de inyección SQL' },
  { id: 'Searchsploit',   name: 'Searchsploit',   desc: 'Búsqueda en base de exploits públicos' },
  { id: 'Scoring',        name: 'Scoring',        desc: 'Ponderación CVSS y cálculo de score final' },
] as const

function formatDuration(startTime?: number, endTime?: number): string | null {
  if (!startTime) return null
  const end = endTime || Date.now()
  const diff = Math.max(0, end - startTime)
  if (diff < 1000) return `${diff}ms`
  const s = (diff / 1000).toFixed(1)
  return `${s}s`
}

export function ScanPipeline({ steps = [], className }: ScanPipelineProps) {
  const prefersReduced = useReducedMotion() ?? false

  // Mapear el estado real de cada paso desde el array que envía el backend
  const pipelineData = useMemo(() => {
    return PIPELINE_STEPS.map((meta, index) => {
      const realStep = steps.find(
        (s) => s.name.toLowerCase() === meta.id.toLowerCase() ||
               s.name.toLowerCase() === meta.name.toLowerCase()
      )

      const status = realStep?.status || 'pending'
      const progress = realStep?.progress ?? (status === 'completed' ? 100 : 0)
      const duration = formatDuration(realStep?.startTime, realStep?.endTime)

      return {
        ...meta,
        index: index + 1,
        status,
        progress,
        duration,
      }
    })
  }, [steps])

  const completedCount = pipelineData.filter((s) => s.status === 'completed').length
  const currentRunning = pipelineData.find((s) => s.status === 'running')

  return (
    <div className={cn('space-y-4 select-none', className)}>
      {/* Telemetría general del Pipeline */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(var(--cyber-accent-rgb),0.15)] pb-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--cyber-accent)] animate-pulse" />
          <span className="text-muted-foreground uppercase tracking-wider">PIPELINE EXECUTION:</span>
          <span className="font-bold text-[var(--cyber-accent)]">
            {completedCount} / {PIPELINE_STEPS.length} NODES COMPLETE
          </span>
        </div>

        {currentRunning && (
          <div className="flex items-center gap-2 text-foreground/80 bg-[rgba(0,240,255,0.08)] px-2.5 py-1 rounded border border-[var(--cyber-accent)]/20">
            <span className="text-[var(--cyber-accent)] font-semibold">ACTIVE:</span>
            <span>{currentRunning.name}</span>
            {currentRunning.duration && (
              <span className="text-muted-foreground">({currentRunning.duration})</span>
            )}
          </div>
        )}
      </div>

      {/* Grid de Nodos Holográficos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {pipelineData.map((node) => {
          const Icon = TOOL_ICONS[node.name] || TOOL_ICONS[node.id]
          const isRunning = node.status === 'running'
          const isCompleted = node.status === 'completed'
          const isError = node.status === 'error'

          return (
            <motion.div
              key={node.id}
              initial={false}
              animate={{
                scale: isRunning ? 1.02 : 1,
              }}
              transition={{ duration: prefersReduced ? 0 : 0.2 }}
              className={cn(
                'relative flex flex-col justify-between p-2.5 rounded-md border text-left',
                'transition-all duration-200',
                isCompleted && 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50',
                isRunning && 'border-[var(--cyber-accent)] bg-[rgba(0,240,255,0.06)] shadow-[0_0_15px_-3px_rgba(0,240,255,0.25)]',
                isError && 'border-red-500/40 bg-red-950/20',
                !isRunning && !isCompleted && !isError && 'border-[rgba(255,255,255,0.06)] bg-[rgba(8,14,26,0.50)] opacity-60'
              )}
            >
              {/* Header del nodo */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="font-mono text-[9px] text-muted-foreground/70">
                  #{String(node.index).padStart(2, '0')}
                </span>

                <div>
                  {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                  {isError && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                  {isRunning && (
                    <div className="h-3 w-3 rounded-full border-2 border-[var(--cyber-accent)] border-t-transparent animate-spin" />
                  )}
                  {!isRunning && !isCompleted && !isError && (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 inline-block" />
                  )}
                </div>
              </div>

              {/* Ícono y Título */}
              <div className="flex items-center gap-2 my-1">
                {Icon ? (
                  <Icon className={cn('h-4 w-4 shrink-0', isRunning ? 'text-[var(--cyber-accent)]' : 'text-muted-foreground')} />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-slate-800" />
                )}
                <span className={cn('font-medium text-xs truncate', isRunning ? 'text-[var(--cyber-accent)] font-semibold' : 'text-foreground/90')}>
                  {node.name}
                </span>
              </div>

              {/* Duración o estado */}
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/70 mt-1 pt-1 border-t border-[rgba(255,255,255,0.04)]">
                <span className="truncate max-w-[70px]">
                  {isRunning ? 'RUNNING' : isCompleted ? 'DONE' : isError ? 'ERROR' : 'QUEUED'}
                </span>
                {node.duration && (
                  <span className="text-[var(--cyber-accent)]/80 flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {node.duration}
                  </span>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
