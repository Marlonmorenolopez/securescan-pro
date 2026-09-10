'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { XCircle, CheckCircle2, AlertTriangle, RotateCcw, Terminal } from 'lucide-react'
import { CyberPanel }  from '@/components/cyber/CyberPanel'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberBadge }  from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'
import { useScan } from '@/lib/scan-context'
import { useTranslations } from 'next-intl'
import { TOOL_ICONS } from '@/components/tool-icons'
import { staggerContainer, staggerItem, getVariants } from '@/lib/motion'

// Definición del orden EXACTO de las herramientas (array garantiza orden)
// FIX: faltaba 'Huella Digital' -- el backend SÍ la manda como primer paso
// de currentScan.steps (corre en paralelo: VirusTotal, AbuseIPDB, crt.sh,
// Safe Browsing, testssl, dnstwist), pero como esta lista es independiente
// de lo que envía el backend, nunca se contaba ni se mostraba acá -- el
// contador decía "1 de 12" en vez de "1 de 13".
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

// Configuración visual de cada herramienta (13 pasos)
const toolConfig: Record<string, { color: string; description: string }> = {
  'Huella Digital': { color: 'bg-cyan-800',   description: 'VirusTotal, AbuseIPDB, crt.sh, Safe Browsing, testssl, dnstwist' },
  'Wappalyzer':   { color: 'bg-blue-700',    description: 'Perfilado de tecnologías web' },
  'Nmap':         { color: 'bg-cyan-700',    description: 'Escaneo de puertos y servicios' },
  'ffuf':         { color: 'bg-sky-700',     description: 'Descubrimiento masivo de rutas' },
  'Gobuster':     { color: 'bg-teal-700',    description: 'Enumeración dirigida de directorios' },
  'ZAP Spider':   { color: 'bg-red-700',     description: 'Mapeo automático de URLs' },
  'Nuclei':       { color: 'bg-purple-700',  description: 'Escaneo de vulnerabilidades conocidas' },
  'ZAP':          { color: 'bg-red-700',     description: 'Ataque dinámico sobre rutas' },
  'SQLMap':       { color: 'bg-rose-700',    description: 'Inyección SQL' },
  'Patator':      { color: 'bg-lime-700',    description: 'Fuerza bruta en formularios de login' },
  'Metasploit':   { color: 'bg-violet-800',  description: 'Explotación avanzada' },
  'Searchsploit': { color: 'bg-amber-700',   description: 'Investigación de exploits disponibles' },
  'Scoring':      { color: 'bg-slate-700',   description: 'Evaluación y priorización de hallazgos' },
}

// FIX C-02: StepIcon ahora consume TOOL_ICONS para mostrar el SVG real de la
// herramienta con un spinner superpuesto cuando está en ejecución.
function StepIcon({ toolName, status }: { toolName: string; status: string }) {
  const Icon = TOOL_ICONS[toolName]
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
  if (status === 'error')     return <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
  if (status === 'running') {
    if (Icon) {
      return (
        <div className="relative h-4 w-4 shrink-0">
          <Icon className="h-4 w-4 opacity-70" />
          <div className="absolute inset-0 rounded-full border-2 border-[var(--cyber-accent)] border-t-transparent animate-spin" />
        </div>
      )
    }
    return <div className="h-4 w-4 shrink-0 rounded-full border-2 border-[var(--cyber-accent)] border-t-transparent animate-spin" />
  }
  return <div className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30" />
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
  const [elapsedTime, setElapsedTime]       = useState('0s')
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
        orderedSteps: []
      }
    }
    
    // Crear mapa de pasos recibidos del backend
    const stepsMap = new Map(currentScan.steps?.map(s => [s.name, s]) || [])
    
    // Construir array ordenado según TOOL_ORDER, combinando con datos reales o creando pendientes
    const ordered = TOOL_ORDER.map(toolName => {
      const existingStep = stepsMap.get(toolName)
      if (existingStep) {
        return existingStep
      }
      // Si el backend no envió este paso aún, crear uno pendiente
      return {
        name: toolName,
        status: 'pending',
        progress: 0,
        startTime: null,
        endTime: null
      }
    })

    const completed = ordered.filter(s => s.status === 'completed').length
    const errors    = ordered.filter(s => s.status === 'error').length
    const total     = ordered.length
    const progress  = total > 0 ? Math.round(((completed + errors) / total) * 100) : 0
    const running   = ordered.find(s => s.status === 'running')
    const tool      = running ? toolConfig[running.name] : null
    
    return { 
      completedSteps: completed, 
      totalSteps: total, 
      overallProgress: progress, 
      errorSteps: errors, 
      currentTool: tool,
      orderedSteps: ordered
    }
  }, [currentScan])

  if (!currentScan || currentScan.status === 'pending') return null

  const hasErrors = errorSteps > 0

  return (
    <CyberPanel
      title={isScanning ? t('scanning') : hasErrors ? t('withErrors') : t('completed')}
      subtitle={currentScan.target}
      action={
        <div className="flex items-center gap-2">
          {isScanning && (
            <span className="font-mono text-xs text-muted-foreground">({elapsedTime})</span>
          )}
          {isScanning && (
            !showConfirmCancel ? (
              <CyberButton
                variant="outline" size="sm"
                onClick={() => setShowConfirmCancel(true)}
                icon={<XCircle className="h-3.5 w-3.5" />}
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
          )}
        </div>
      }
      className={cn('transition-all duration-300', hasErrors && 'border-red-500/30')}
    >
      {currentTool && isScanning && (
        <p className="mb-4 -mt-2 font-mono text-xs text-muted-foreground animate-pulse">
          • {currentTool.description}
        </p>
      )}

      <div className="space-y-6">
        {/* Barra de progreso general — estilo cyber, sin <Progress> de shadcn */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{t('overallProgress')}</span>
            <span className="font-mono text-xs font-medium text-foreground">
              {completedSteps} de {totalSteps}
              {errorSteps > 0 && (
                <span className="ml-1 text-red-400">
                  ({errorSteps} {errorSteps > 1 ? t('errors') : t('error')})
                </span>
              )}
            </span>
          </div>
          <div className="relative h-5 overflow-hidden rounded-md bg-[hsl(var(--muted))]/40">
            <div
              className={cn(
                'h-full rounded-md transition-all duration-700 ease-out',
                hasErrors ? 'bg-red-500/70' : 'bg-[var(--cyber-accent)]',
              )}
              style={{ width: `${overallProgress}%` }}
            />
            {isScanning && !prefersReduced && (
              <motion.div
                className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.3 }}
              />
            )}
            <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-white drop-shadow-sm">
              {overallProgress}%
            </span>
          </div>
        </div>

        {/* Lista de pasos - AHORA ORDENADOS */}
        <motion.div
          className="space-y-2"
          variants={getVariants(staggerContainer, prefersReduced)}
          initial="hidden"
          animate="visible"
        >
          {orderedSteps.map((step, index) => {
            const config = toolConfig[step.name] || { icon: String(index + 1), color: 'bg-gray-500', description: '' }
            const isActive  = step.status === 'running'
            const hasError  = step.status === 'error'

            return (
              <motion.div
                key={step.name}
                layout={!prefersReduced}
                variants={getVariants(staggerItem, prefersReduced)}
                animate={isActive && !prefersReduced ? { scale: [1, 1.01, 1] } : {}}
                transition={isActive && !prefersReduced ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-3 transition-colors duration-300',
                  isActive  && 'border-[rgba(var(--cyber-accent-rgb),0.30)] bg-[rgba(var(--cyber-accent-rgb),0.06)]',
                  hasError  && 'border-red-500/30 bg-red-500/[0.06]',
                  step.status === 'completed' && 'border-emerald-500/25 bg-emerald-500/[0.04]',
                  step.status === 'pending'   && 'opacity-60',
                )}
              >
                {/* Icono de herramienta */}
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm',
                  config.color,
                  step.status === 'pending' && 'grayscale opacity-50',
                )}>
                  {(() => {
                    const Icon = TOOL_ICONS[step.name]
                    return Icon
                      ? <Icon className="h-7 w-7" />
                      : <span className="text-sm text-white font-bold">{step.name[0]}</span>
                  })()}
                </div>

                {/* Información */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-mono text-sm font-semibold', isActive && 'text-[var(--cyber-accent)]')}>
                      {step.name}
                    </span>
                    <StepIcon toolName={step.name} status={step.status} />
                    {isActive && (
                      <span className="font-mono text-xs text-[var(--cyber-accent)] animate-pulse">{t('inProgress')}</span>
                    )}
                  </div>
                  {isActive && step.progress > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]/40">
                        <div
                          className="h-full rounded-full bg-[var(--cyber-accent)] transition-all duration-500"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">{step.progress}% completado</p>
                    </div>
                  )}
                  {hasError && (
                    <p className="mt-1 font-mono text-xs text-red-400">
                      {t('stepError')}
                    </p>
                  )}
                </div>

                {/* Duración */}
                <div className="min-w-[60px] text-right">
                  <span className="font-mono text-sm text-muted-foreground">
                    {step.startTime && step.endTime
                      ? formatDuration(step.endTime - step.startTime)
                      : step.startTime
                      ? formatDuration(Date.now() - step.startTime)
                      : '--'}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Estado completado */}
        {currentScan.status === 'completed' && (
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-4"
          >
            <div className="rounded-full bg-emerald-500/10 p-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-mono text-sm font-semibold text-emerald-300">{t('completedMessage')}</p>
              <p className="font-mono text-xs text-emerald-400/80">
                {t('completedDetail')} {formatTimeElapsed(currentScan.startTime)}
              </p>
            </div>
          </motion.div>
        )}

        {/* Estado error */}
        {currentScan.status === 'error' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <div className="flex flex-1 flex-col gap-1">
                <span className="font-mono text-sm font-semibold text-red-300">{t('errorTitle')}</span>
                <span className="text-sm text-red-300/80">
                  {currentScan.error || t('errorDetail')}
                </span>
                <div className="mt-2">
                  <CyberButton
                    variant="outline" size="sm"
                    icon={<RotateCcw className="h-3 w-3" />}
                    onClick={() => window.location.reload()}
                  >
                    {t('retry')}
                  </CyberButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Job ID en desarrollo */}
        {process.env.NODE_ENV === 'development' && currentScan.status === 'running' && (
          <div className="flex items-center gap-2 border-t border-[hsl(var(--border))] pt-4 font-mono text-xs text-muted-foreground">
            <Terminal className="h-3 w-3" />
            <span>Job ID: {currentScan.id} · /api/scan/{currentScan.id}/status</span>
          </div>
        )}
      </div>
    </CyberPanel>
  )
}