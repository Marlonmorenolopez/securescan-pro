'use client'
// components/scan-progress.tsx — SecureScan Pro v5.0 · Holographic Scan Pipeline & Execution Monitor

import { useMemo, useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { XCircle, CheckCircle2, AlertTriangle, Terminal, Clock, Shield } from 'lucide-react'
import { HoloPanel } from '@/components/cyber/HoloPanel'
import { CyberButton } from '@/components/cyber/CyberButton'
import { ThreatBadge } from '@/components/cyber/ThreatBadge'
import { ScanPipeline } from '@/components/cyber/ScanPipeline'
import { HolographicTerminal } from '@/components/cyber/HolographicTerminal'
import { cn } from '@/lib/utils'
import { useScan } from '@/lib/scan-context'
import { useTranslations } from 'next-intl'
import type { ScanStep } from '@/lib/api-client'

const TOOL_ORDER = [
  'Huella Digital',
  'Wappalyzer',
  'Nmap',
  'Patator',
  'Metasploit',
  'ffuf',
  'Gobuster',
  'ZAP Spider',
  'ZAP',
  'Nuclei',
  'SQLMap',
  'Searchsploit',
  'Scoring',
] as const

const toolConfig: Record<string, { color: string; description: string }> = {
  'Huella Digital': { color: 'bg-cyan-800',   description: 'VirusTotal, AbuseIPDB, crt.sh, Safe Browsing, testssl, dnstwist' },
  'Wappalyzer':   { color: 'bg-blue-700',    description: 'Perfilado de tecnologías web y stack' },
  'Nmap':         { color: 'bg-cyan-700',    description: 'Escaneo de puertos y servicios SYN' },
  'Patator':      { color: 'bg-lime-700',    description: 'Auditoría de autenticación y fuerza bruta' },
  'Metasploit':   { color: 'bg-violet-800',  description: 'Validación controlada de exploits' },
  'ffuf':         { color: 'bg-sky-700',     description: 'Descubrimiento masivo de rutas y parámetros' },
  'Gobuster':     { color: 'bg-teal-700',    description: 'Enumeración dirigida de directorios' },
  'ZAP Spider':   { color: 'bg-red-700',     description: 'Mapeo pasivo de URLs y estructura' },
  'ZAP':          { color: 'bg-red-700',     description: 'Análisis DAST dinámico sobre rutas' },
  'Nuclei':       { color: 'bg-purple-700',  description: 'Escaneo de vulnerabilidades CVE con plantillas' },
  'SQLMap':       { color: 'bg-rose-700',    description: 'Detección de inyección SQL' },
  'Searchsploit': { color: 'bg-amber-700',   description: 'Investigación de exploits públicos disponibles' },
  'Scoring':      { color: 'bg-slate-700',   description: 'Ponderación CVSS y cálculo de score final' },
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}m ${s}s`
}

function formatTimeElapsed(startTime: string): string {
  const normalized = startTime && !startTime.endsWith('Z') && !startTime.includes('+')
    ? startTime + 'Z'
    : startTime
  const elapsed = Math.max(0, Date.now() - new Date(normalized).getTime())
  return formatDuration(elapsed)
}

export function ScanProgress() {
  const t = useTranslations('progress')
  const { currentScan, isScanning, cancelScan } = useScan()
  const [elapsedTime, setElapsedTime] = useState('0s')
  const [showConfirmCancel, setShowConfirmCancel] = useState(false)
  const prefersReduced = useReducedMotion() ?? false

  useEffect(() => {
    if (!isScanning || !currentScan?.startTime) {
      setElapsedTime('0s')
      return
    }
    const interval = setInterval(() => {
      setElapsedTime(formatTimeElapsed(currentScan.startTime))
    }, 1000)
    return () => clearInterval(interval)
  }, [isScanning, currentScan?.startTime])

  const { completedSteps, totalSteps, overallProgress, errorSteps, currentTool, orderedSteps } = useMemo(() => {
    if (!currentScan) {
      return {
        completedSteps: 0,
        totalSteps: TOOL_ORDER.length,
        overallProgress: 0,
        errorSteps: 0,
        currentTool: null,
        orderedSteps: [] as ScanStep[],
      }
    }

    const stepsMap = new Map(currentScan.steps?.map((s) => [s.name, s]) || [])

    const ordered: ScanStep[] = TOOL_ORDER.map((toolName) => {
      const existingStep = stepsMap.get(toolName)
      if (existingStep) return existingStep
      return {
        name: toolName,
        status: 'pending',
        progress: 0,
      }
    })

    const completed = ordered.filter((s) => s.status === 'completed').length
    const errors = ordered.filter((s) => s.status === 'error').length
    const total = ordered.length
    const progress = total > 0 ? Math.round(((completed + errors) / total) * 100) : 0
    const running = ordered.find((s) => s.status === 'running')
    const tool = running ? toolConfig[running.name] : null

    return {
      completedSteps: completed,
      totalSteps: total,
      overallProgress: progress,
      errorSteps: errors,
      currentTool: tool,
      orderedSteps: ordered,
    }
  }, [currentScan])

  // Generar logs en vivo para la terminal holográfica a partir del estado de los pasos
  const terminalLogs = useMemo(() => {
    const logs: string[] = []
    if (currentScan?.startTime) {
      logs.push(`[*] [SYS] Session initiated for target: ${currentScan.target}`)
    }

    orderedSteps.forEach((step) => {
      if (step.status === 'completed') {
        logs.push(`[+] [DONE] [${step.name.toUpperCase()}] Execution completed successfully.`)
      } else if (step.status === 'running') {
        logs.push(`[>] [BUSY] [${step.name.toUpperCase()}] Processing vectors... Progress: ${step.progress}%`)
      } else if (step.status === 'error') {
        logs.push(`[-] [FAIL] [${step.name.toUpperCase()}] Engine returned an error state.`)
      }
    })

    return logs
  }, [currentScan?.startTime, currentScan?.target, orderedSteps])

  if (!currentScan || currentScan.status === 'pending') return null

  const hasErrors = errorSteps > 0

  return (
    <div className="space-y-6">
      <HoloPanel
        moduleId="MOD::SCAN_PIPELINE"
        title={
          <div className="flex items-center gap-2">
            <span>{isScanning ? t('scanning') : hasErrors ? t('withErrors') : t('completed')}</span>
            <code className="text-xs text-[var(--cyber-accent)] font-mono">[{currentScan.target}]</code>
          </div>
        }
        timestamp={`ELAPSED::${elapsedTime}`}
        actions={
          isScanning && (
            !showConfirmCancel ? (
              <CyberButton
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmCancel(true)}
                icon={<XCircle className="h-3.5 w-3.5 text-red-400" />}
              >
                {t('cancel')}
              </CyberButton>
            ) : (
              <div className="flex items-center gap-2">
                <CyberButton variant="ghost" size="sm" onClick={() => setShowConfirmCancel(false)}>
                  {t('cancelConfirmNo')}
                </CyberButton>
                <CyberButton variant="destructive" size="sm" onClick={() => { cancelScan(); setShowConfirmCancel(false) }}>
                  {t('cancelConfirmYes')}
                </CyberButton>
              </div>
            )
          )
        }
      >
        {/* Barra de Progreso Global Calibrada */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground uppercase tracking-wider">
              {t('overallProgress')} — {completedSteps} / {totalSteps} {t('tools')}
            </span>
            <span className="font-bold text-[var(--cyber-accent)]">{overallProgress}%</span>
          </div>
          <div className="relative h-2.5 w-full rounded-full bg-slate-900 overflow-hidden border border-[rgba(0,240,255,0.15)]">
            <motion.div
              className={cn(
                'h-full rounded-full',
                hasErrors ? 'bg-gradient-to-r from-red-600 to-amber-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: prefersReduced ? 0 : 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Visualizador Holográfico de Nodos del Pipeline (13 Pasos) */}
        <ScanPipeline steps={orderedSteps} />

        {/* Terminal Holográfica de Telemetría en Vivo */}
        <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.06)]">
          <HolographicTerminal
            title="AUDIT ARSENAL TELEMETRY STREAM"
            lines={terminalLogs}
            maxHeight="180px"
          />
        </div>
      </HoloPanel>
    </div>
  )
}