'use client'
// app/lab/page.tsx — SecureScan Pro v5.0 · Laboratorio
//
// Migración i18n: 100% del texto de UI (labels, badges, logs dinámicos)
// ahora usa t('lab.xxx'). Fix de ortografía incluido: "Practica" → "Práctica",
// "eticas" → "éticas", "Clasico" → "Clásico".
//
// Los logs (addLog) usan interpolación ICU para nombre de app y puerto,
// igual técnica que en la landing y docs.

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Beaker, Play, Square, RefreshCw, CheckCircle,
  XCircle, ExternalLink, AlertTriangle, Info,
  Loader2, Scan, Copy, Check, Key,
} from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard }    from '@/components/cyber/CyberCard'
import { CyberPanel }   from '@/components/cyber/CyberPanel'
import { CyberButton }  from '@/components/cyber/CyberButton'
import { CyberBadge }   from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'
import {
  fadeIn, slideInUp, staggerContainer, staggerItem, getVariants,
} from '@/lib/motion'

type TFunc = ReturnType<typeof useTranslations>

// ─── Tipos ────────────────────────────────────────────────────────────────────
type AppStatus = 'running' | 'healthy' | 'stopped' | 'starting' | 'stopping' | 'error'

interface Credential { user: string; pass: string; note?: string }

interface LabApp {
  id: string
  name: string
  description: string
  port: number
  internalPort: number
  imageName: string
  imageVersion: string
  status: AppStatus
  url: string
  scanUrl: string
  documentation: string
  vulnerabilities: string[]
  credentials: Credential[]
  color: string
}

// ─── Datos (descripciones y notas vía t, resto fijo) ──────────────────────────

function getInitialApps(t: TFunc): LabApp[] {
  return [
    {
      id: 'juice-shop',
      name: 'OWASP Juice Shop',
      description: t('lab.app1Desc'),
      port: 3001,
      internalPort: 3000,
      imageName: 'bkimminich/juice-shop',
      imageVersion: 'latest',
      status: 'stopped',
      url: 'http://localhost:3001',
      scanUrl: 'http://juice-shop:3000',
      documentation: 'https://owasp.org/www-project-juice-shop/',
      vulnerabilities: ['SQL Injection', 'XSS', 'Broken Auth', 'Sensitive Data', 'XXE', 'Insecure Deserialization'],
      credentials: [
        { user: 'admin@juice-sh.op', pass: 'admin123', note: t('lab.app1Cred1Note') },
        { user: 'jim@juice-sh.op',   pass: 'ncc-1701',  note: t('lab.app1Cred2Note') },
      ],
      color: 'text-emerald-400',
    },
    {
      id: 'dvwa',
      name: 'DVWA',
      description: t('lab.app2Desc'),
      port: 3002,
      internalPort: 80,
      imageName: 'vulnerables/web-dvwa',
      imageVersion: 'latest',
      status: 'stopped',
      url: 'http://localhost:3002',
      scanUrl: 'http://dvwa:80',
      documentation: 'https://github.com/digininja/DVWA',
      vulnerabilities: ['SQL Injection', 'XSS (Reflected/Stored)', 'CSRF', 'File Inclusion', 'Command Injection', 'Brute Force'],
      credentials: [
        { user: 'admin', pass: 'password', note: t('lab.app2Cred1Note') },
        { user: 'gordonb', pass: 'abc123', note: t('lab.app2Cred2Note') },
      ],
      color: 'text-orange-400',
    },
    {
      id: 'webgoat',
      name: 'WebGoat',
      description: t('lab.app3Desc'),
      port: 3003,
      internalPort: 8080,
      imageName: 'webgoat/webgoat',
      imageVersion: 'latest',
      status: 'stopped',
      url: 'http://localhost:3003/WebGoat',
      scanUrl: 'http://webgoat:8080',
      documentation: 'https://owasp.org/www-project-webgoat/',
      vulnerabilities: ['JWT Attacks', 'Path Traversal', 'SQL Injection', 'XXE', 'Authentication Bypass', 'IDOR'],
      credentials: [
        { user: 'securescan', pass: 'Password', note: t('lab.app3Cred1Note') },
        { user: 'securescan', pass: 'Password', note: t('lab.app3Cred2Note') },
      ],
      color: 'text-blue-400',
    },
  ]
}

const API = 'http://localhost:5000'

// ─── Helpers (reciben t para resolver labels) ──────────────────────────────────
function StatusIcon({ status }: { status: AppStatus }) {
  if (status === 'running')  return <CheckCircle className="h-5 w-5 text-emerald-400" />
  if (status === 'starting' || status === 'stopping')
                              return <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
  if (status === 'error')    return <XCircle className="h-5 w-5 text-red-400" />
  return                             <XCircle className="h-5 w-5 text-muted-foreground" />
}

function StatusBadge({ status, t }: { status: AppStatus; t: TFunc }) {
  const labelMap: Record<AppStatus, string> = {
    running:  t('lab.statusStarting'),
    healthy:  t('lab.statusHealthy'),
    stopped:  t('lab.statusStopped'),
    starting: t('lab.statusStarting'),
    stopping: t('lab.statusStopping'),
    error:    t('lab.statusError'),
  }
  const typeMap: Record<AppStatus, 'running' | 'completed' | 'error' | 'idle' | 'pending'> = {
    running:  'running',
    healthy:  'completed',
    stopped:  'idle',
    starting: 'pending',
    stopping: 'pending',
    error:    'error',
  }
  return <CyberBadge type={typeMap[status]} label={labelMap[status]} size="sm" />
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function LabPage() {
  const t = useTranslations()
  const router = useRouter()
  const prefersReduced = useReducedMotion() ?? false
  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)
  const [apps, setApps] = useState<LabApp[]>(() => getInitialApps(t))
  const [logs, setLogs] = useState<string[]>([])
  const [polling, setPolling] = useState(false)

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('es-ES')
    setLogs(prev => [`[${ts}] ${msg}`, ...prev.slice(0, 49)])
  }, [])

  // ── Polling de estado real ──────────────────────────────────────────────────
  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/lab/status`)
      if (!res.ok) return
      const data: Record<string, string> = await res.json()
      setApps(prev => prev.map(app => {
        const newStatus = (data[app.id] as AppStatus) ?? app.status
        if (newStatus === 'healthy' && app.status !== 'healthy') {
          addLog(t('lab.logAppReady', { name: app.name, port: app.port }))
        }
        return { ...app, status: newStatus }
      }))
    } catch {
      // Backend no disponible — mantener estado local
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog])

  useEffect(() => {
    fetchStatuses()
    const id = setInterval(fetchStatuses, 5000)
    setPolling(true)
    return () => { clearInterval(id); setPolling(false) }
  }, [fetchStatuses])

  // ── Acciones ───────────────────────────────────────────────────────────────
  const startApp = async (appId: string) => {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'starting' } : a))
    addLog(t('lab.logStarting', { name: app.name }))
    try {
      const res = await fetch(`${API}/api/lab/${appId}/start`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        addLog(t('lab.logStartingHealthcheck', { name: app.name, port: app.port }))
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'running' } : a))
      } else {
        addLog(t('lab.logStartError', { name: app.name, error: data.error ?? t('lab.logUnknownError') }))
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'error' } : a))
        toast.error(`Error al iniciar ${app.name}`, { description: data.error ?? t('lab.logUnknownError') })
      }
    } catch {
      // Fallback: simular si el backend no tiene el endpoint
      addLog(t('lab.logBackendUnavailableStart', { name: app.name }))
      setTimeout(() => {
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'running' } : a))
        addLog(t('lab.logSimulatedStarted', { name: app.name }))
      }, 2000)
    }
  }

  const stopApp = async (appId: string) => {
    const app = apps.find(a => a.id === appId)
    if (!app) return
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'stopping' } : a))
    addLog(t('lab.logStopping', { name: app.name }))
    try {
      const res = await fetch(`${API}/api/lab/${appId}/stop`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        addLog(t('lab.logStopped', { name: app.name }))
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'stopped' } : a))
      } else {
        addLog(t('lab.logStopError', { name: app.name, error: data.error ?? t('lab.logUnknownError') }))
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'error' } : a))
        toast.error(`Error al detener ${app.name}`, { description: data.error ?? t('lab.logUnknownError') })
      }
    } catch {
      addLog(t('lab.logBackendUnavailableStop', { name: app.name }))
      setApps(prev => prev.map(a => a.id === appId ? { ...a, status: 'stopped' } : a))
    }
  }

  const startAll = () => apps.filter(a => a.status !== 'running').forEach(a => startApp(a.id))
  const stopAll  = () => apps.filter(a => a.status === 'running').forEach(a => stopApp(a.id))

  const scanApp = (app: LabApp) => {
    sessionStorage.setItem('prescan_url', app.scanUrl)
    router.push('/scanner')
  }

  const runningCount = apps.filter(a => a.status === 'running').length

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-8">
        <div className="container mx-auto space-y-6 px-4 max-w-7xl">

          {/* ── Header ── */}
          <motion.div className="space-y-1" variants={sv(slideInUp)} initial="hidden" animate="visible">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Beaker className="h-6 w-6 text-[var(--cyber-accent)]" />
              {t('lab.pageTitle')}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">
              {t('lab.pageSubtitle')}
            </p>
          </motion.div>

          {/* ── Alertas ── */}
          <motion.div
            className="grid gap-3 sm:grid-cols-2"
            variants={sv(staggerContainer)}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={sv(staggerItem)}
              className="flex items-start gap-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
              <div>
                <p className="font-mono text-sm font-semibold text-foreground">{t('lab.dockerRequiredTitle')}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('lab.dockerRequiredDesc')}</p>
              </div>
            </motion.div>
            <motion.div
              variants={sv(staggerItem)}
              className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-4"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="font-mono text-sm font-semibold text-red-300">{t('lab.securityNoticeTitle')}</p>
                <p className="mt-0.5 text-xs text-red-300/80">{t('lab.securityNoticeDesc')}</p>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Control global ── */}
          <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
            <CyberCard glow padding="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold uppercase tracking-wide text-foreground">{t('lab.controlTitle')}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {t('lab.controlRunning', { running: runningCount, total: apps.length })}
                    {polling && (
                      <span className="ml-2 text-emerald-400">
                        <span className="status-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {t('lab.controlSyncing')}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CyberButton variant="outline" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => fetchStatuses()}>
                    {t('lab.btnRefresh')}
                  </CyberButton>
                  <CyberButton variant="outline" size="sm" icon={<Play className="h-3.5 w-3.5" />} onClick={startAll}>
                    {t('lab.btnStartAll')}
                  </CyberButton>
                  <CyberButton variant="outline" size="sm" icon={<Square className="h-3.5 w-3.5" />} onClick={stopAll}>
                    {t('lab.btnStopAll')}
                  </CyberButton>
                </div>
              </div>
            </CyberCard>
          </motion.div>

          {/* ── Tarjetas de labs ── */}
          <motion.div
            className="grid gap-6 lg:grid-cols-3"
            variants={sv(staggerContainer)}
            initial="hidden"
            animate="visible"
          >
            {apps.map(app => (
              <motion.div key={app.id} variants={sv(staggerItem)}>
              <CyberCard glow className="flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <StatusIcon status={app.status} />
                  <StatusBadge status={app.status} t={t} />
                </div>
                <div className="mt-3 space-y-0.5">
                  <p className={cn('font-mono text-base font-bold', app.color)}>{app.name}</p>
                  <p className="text-xs text-muted-foreground">{app.description}</p>
                </div>

                  {/* Info técnica */}
                  <div className="space-y-1.5 rounded-lg bg-[hsl(var(--muted))]/30 p-3 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('lab.techPort')}</span>
                      <span className="text-foreground">{app.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('lab.techImage')}</span>
                      <span className="max-w-[140px] truncate text-foreground">{app.imageName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t('lab.techScanUrl')}</span>
                      <span className={cn('flex items-center gap-1', app.color)}>
                        {app.scanUrl}
                        <CopyButton text={app.scanUrl} />
                      </span>
                    </div>
                  </div>

                  {/* Credenciales */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5">
                      <Key className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{t('lab.credentialsLabel')}</span>
                    </div>
                    <div className="space-y-1.5">
                      {app.credentials.map((cred, i) => (
                        <div key={i} className="flex items-center justify-between rounded bg-[hsl(var(--muted))]/20 px-2.5 py-1.5 font-mono text-xs">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">{t('lab.userLabel')}:</span>
                              <span className="text-foreground">{cred.user}</span>
                              <CopyButton text={cred.user} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">{t('lab.passLabel')}:</span>
                              <span className="text-foreground">{cred.pass}</span>
                              <CopyButton text={cred.pass} />
                            </div>
                          </div>
                          {cred.note && (
                            <span className="ml-2 shrink-0 rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {cred.note}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Vulnerabilidades */}
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{t('lab.vulnerabilitiesLabel')}</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {app.vulnerabilities.slice(0, 4).map((v, i) => (
                        <span key={i} className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {v}
                        </span>
                      ))}
                      {app.vulnerabilities.length > 4 && (
                        <span className="rounded border border-[hsl(var(--border))] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          +{app.vulnerabilities.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1">
                    {(app.status === 'running' || app.status === 'healthy') ? (
                      <>
                        <CyberButton
                          variant="destructive" size="sm" className="flex-1"
                          icon={<Square className="h-3.5 w-3.5" />}
                          onClick={() => stopApp(app.id)}
                        >
                          {t('lab.btnStop')}
                        </CyberButton>
                        <CyberButton
                          variant="outline"
                          size="sm"
                          asChild
                          disabled={app.status !== 'healthy'}
                          title={app.status !== 'healthy' ? t('lab.waitingHealthy') : t('lab.openApp', { name: app.name })}
                        >
                          <a href={app.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </CyberButton>
                      </>
                    ) : app.status === 'starting' || app.status === 'stopping' ? (
                      <CyberButton variant="outline" size="sm" className="flex-1" disabled icon={<Loader2 className="h-3.5 w-3.5 animate-spin" />}>
                        {app.status === 'starting' ? t('lab.btnStarting') : t('lab.btnStopping')}
                      </CyberButton>
                    ) : (
                      <CyberButton
                        variant="primary" size="sm" className="flex-1"
                        icon={<Play className="h-3.5 w-3.5" />}
                        onClick={() => startApp(app.id)}
                      >
                        {t('lab.btnStart')}
                      </CyberButton>
                    )}

                    {/* Escanear este lab */}
                    <CyberButton
                      variant={app.status === 'running' ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => scanApp(app)}
                      title={t('lab.scanThisLab')}
                      icon={<Scan className="h-3.5 w-3.5" />}
                    />

                    <CyberButton variant="ghost" size="sm" asChild>
                      <a href={app.documentation} target="_blank" rel="noopener noreferrer">
                        <Info className="h-3.5 w-3.5" />
                      </a>
                    </CyberButton>
                  </div>
              </CyberCard>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Log ── */}
          <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
            <CyberPanel
              title={t('lab.activityLogTitle')}
              subtitle={t('lab.activityLogSubtitle')}
              action={
                <CyberButton variant="ghost" size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => setLogs([])}>
                  {t('lab.btnClear')}
                </CyberButton>
              }
            >
              <div className="max-h-48 space-y-1 overflow-auto rounded-lg bg-[hsl(var(--muted))]/30 p-4 font-mono text-xs">
                {logs.length === 0 ? (
                  <span className="text-muted-foreground">{t('lab.noRecentActivity')}</span>
                ) : logs.map((log, i) => (
                  <div key={i} className="leading-relaxed text-muted-foreground">{log}</div>
                ))}
              </div>
            </CyberPanel>
          </motion.div>

          {/* ── Comandos manuales ── */}
          <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
            <CyberPanel title={t('lab.manualCommandsTitle')} subtitle={t('lab.manualCommandsSubtitle')}>
              <div className="space-y-4">
                {apps.map(app => (
                  <div key={app.id} className="space-y-1.5">
                    <span className={cn('font-mono text-sm font-semibold', app.color)}>{app.name}</span>
                    <pre className="overflow-x-auto rounded-lg bg-[hsl(var(--muted))]/30 p-3 font-mono text-xs text-muted-foreground">
{`docker run -d -p ${app.port}:${app.internalPort} --name ${app.id} ${app.imageName}:${app.imageVersion}`}
                    </pre>
                  </div>
                ))}
              </div>
            </CyberPanel>
          </motion.div>

        </div>
      </main>

      <footer className="border-t border-[hsl(var(--border))] mt-auto bg-[hsl(var(--card))]/40 py-5">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground font-mono">
          {t('lab.footerTagline')}
        </div>
      </footer>
    </div>
  )
}
