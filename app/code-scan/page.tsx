'use client'
// app/code-scan/page.tsx — SecureScan Pro v5.1
// Análisis de Código (Grupo 3): secretos hardcodeados, backdoors/webshells,
// y dependencias vulnerables -- a partir de un repo de GitHub o un .zip
// subido. Página autocontenida (no usa ScanProvider, que es específico
// del flujo de escaneo web por target).

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Code2, Github, Upload, ShieldAlert, KeyRound, PackageSearch,
  Loader2, CheckCircle2, XCircle, AlertTriangle, ExternalLink, ShieldCheck, Bug, ScanSearch, Container,
} from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { ReportDownloadModal } from '@/components/report-download-modal'
import {
  startCodeScanFromRepo, startCodeScanFromFile, startCodeScanFromImage, getCodeScanStatus,
} from '@/lib/api-client'
import type { CodeScanStatusResponse, CodeFinding, TrivyFinding } from '@/lib/api-client'

type Mode = 'repo' | 'zip' | 'image'

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'unknown'] as const

function severityBadgeType(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  if (severity === 'critical') return 'critical'
  if (severity === 'high') return 'high'
  if (severity === 'medium') return 'medium'
  if (severity === 'low') return 'low'
  return 'info'
}

export default function CodeScanPage() {
  return (
    <Suspense fallback={null}>
      <CodeScanPageInner />
    </Suspense>
  )
}

function CodeScanPageInner() {
  const searchParams = useSearchParams()
  const viewOnlyId = searchParams.get('id')

  const [mode, setMode] = useState<Mode>('repo')
  const [repoUrl, setRepoUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [imageRef, setImageRef] = useState('')
  const [jobId, setJobId] = useState<string | null>(viewOnlyId)
  const [scan, setScan] = useState<CodeScanStatusResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const poll = useCallback((id: string) => {
    const tick = async () => {
      const { data, error } = await getCodeScanStatus(id)
      if (error || !data) {
        pollRef.current = setTimeout(tick, 3000)
        return
      }
      setScan(data)
      if (data.status === 'running') {
        pollRef.current = setTimeout(tick, 2000)
      }
    }
    tick()
  }, [])

  useEffect(() => {
    if (viewOnlyId) {
      poll(viewOnlyId)
    }
    // Solo al montar -- si el usuario navega a otro ?id= manualmente,
    // un refresh de página es la forma esperada de recargar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (mode === 'repo' && !repoUrl.trim()) {
      setFormError('Ingresa la URL de un repositorio')
      return
    }
    if (mode === 'zip' && !file) {
      setFormError('Selecciona un archivo .zip')
      return
    }
    if (mode === 'image' && !imageRef.trim()) {
      setFormError('Ingresa una referencia de imagen (ej. nginx:1.21)')
      return
    }

    setSubmitting(true)
    const { data, error } =
      mode === 'repo'  ? await startCodeScanFromRepo(repoUrl.trim()) :
      mode === 'zip'   ? await startCodeScanFromFile(file as File) :
                          await startCodeScanFromImage(imageRef.trim())
    setSubmitting(false)

    if (error || !data) {
      setFormError(error?.error || 'No se pudo iniciar el análisis')
      return
    }

    setJobId(data.jobId)
    setScan(null)
    poll(data.jobId)
  }

  function handleReset() {
    stopPolling()
    setJobId(null)
    setScan(null)
    setRepoUrl('')
    setFile(null)
    setFormError(null)
  }

  const isRunning = scan?.status === 'running'
  const isDone    = scan?.status === 'completed'
  const isError   = scan?.status === 'error'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-5xl space-y-8 px-4 sm:px-6 lg:px-8">

          {/* ── Hero ── */}
          <motion.div
            className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="cyber-grid-bg pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative flex items-center gap-3">
              <Code2 className="h-6 w-6 text-[var(--cyber-accent)]" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Análisis de Código</h1>
                <p className="mt-1 max-w-2xl font-mono text-sm text-muted-foreground">
                  Busca secretos hardcodeados, patrones de backdoors/webshells, y dependencias con
                  vulnerabilidades conocidas — a partir de un repo público o un archivo subido.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Qué hace esta página ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: KeyRound, name: 'Gitleaks', desc: 'Secretos hardcodeados (API keys, contraseñas, llaves privadas) con reglas curadas de la comunidad.' },
              { icon: ShieldCheck, name: 'TruffleHog', desc: 'Igual que Gitleaks, pero verifica en vivo contra la API real del proveedor si el secreto sigue activo.' },
              { icon: Bug, name: 'Backdoor Scanner', desc: 'Patrones de webshells conocidos: eval+base64 encadenado, exec con input del usuario, deserialización insegura.' },
              { icon: ScanSearch, name: 'Semgrep', desc: 'SAST real: SQLi, XSS, path traversal y más, con ~280 reglas de la comunidad que entienden la sintaxis del código.' },
              { icon: PackageSearch, name: 'Trivy', desc: 'Dependencias con CVEs conocidos vía lockfiles, o una imagen Docker completa (capa por capa) desde su registro.' },
              { icon: ShieldAlert, name: 'OWASP Dependency-Check', desc: 'Segunda fuente de CVEs en dependencias, para contrastar contra lo que reporta Trivy.' },
            ].map((tool) => (
              <CyberCard key={tool.name} padding="p-3">
                <div className="flex items-start gap-2">
                  <tool.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
                  <div>
                    <div className="font-mono text-xs font-semibold text-foreground">{tool.name}</div>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{tool.desc}</p>
                  </div>
                </div>
              </CyberCard>
            ))}
          </div>

          {/* ── Formulario (solo si no hay job activo) ── */}
          {!jobId && (
            <CyberPanel title="Fuente del código" subtitle="Elige cómo vas a entregar el código a analizar">
              <div className="mb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('repo')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    mode === 'repo'
                      ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                      : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                  )}
                >
                  <Github className="h-4 w-4" /> Repo de GitHub
                </button>
                <button
                  type="button"
                  onClick={() => setMode('zip')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    mode === 'zip'
                      ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                      : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                  )}
                >
                  <Upload className="h-4 w-4" /> Subir archivo .zip
                </button>
                <button
                  type="button"
                  onClick={() => setMode('image')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    mode === 'image'
                      ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                      : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                  )}
                >
                  <Container className="h-4 w-4" /> Imagen Docker
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'repo' && (
                  <div>
                    <Input
                      placeholder="https://github.com/usuario/repositorio"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Solo repos públicos de GitHub, GitLab o Bitbucket (https://) — se clona con historial completo
                    </p>
                  </div>
                )}
                {mode === 'zip' && (
                  <div>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="block w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-3 py-2.5 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-[var(--cyber-accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[hsl(var(--background))]"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Solo .zip, máximo 50MB — sin historial de git (no aplica a un ZIP)
                    </p>
                  </div>
                )}
                {mode === 'image' && (
                  <div>
                    <Input
                      placeholder="nginx:1.21, ghcr.io/usuario/app:tag..."
                      value={imageRef}
                      onChange={(e) => setImageRef(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Se escanea directo desde el registro (Docker Hub, GHCR...), sin necesitar Docker instalado
                    </p>
                  </div>
                )}

                {formError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                )}

                <CyberButton type="submit" variant="primary" loading={submitting} disabled={submitting}>
                  Analizar código
                </CyberButton>
              </form>
            </CyberPanel>
          )}

          {/* ── Progreso ── */}
          {jobId && scan && (
            <CyberPanel
              title="Progreso del análisis"
              subtitle={scan.source_type === 'repo' ? scan.source : scan.source_type === 'image' ? `imagen: ${scan.source}` : `archivo: ${scan.source}`}
              action={
                !isRunning ? (
                  <div className="flex items-center gap-2">
                    {isDone && <ReportDownloadModal scanId={jobId!} />}
                    <CyberButton variant="ghost" size="sm" onClick={handleReset}>
                      Nuevo análisis
                    </CyberButton>
                  </div>
                ) : undefined
              }
            >
              <div className="space-y-2">
                {scan.steps.map((step) => (
                  <div key={step.name} className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
                    {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                    {step.status === 'running' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--cyber-accent)]" />}
                    {step.status === 'error' && <XCircle className="h-4 w-4 shrink-0 text-red-400" />}
                    {step.status === 'pending' && <div className="h-4 w-4 shrink-0 rounded-full border border-muted-foreground/30" />}
                    <span className="font-mono text-sm text-foreground">{step.name}</span>
                  </div>
                ))}
              </div>

              {isError && (
                <Alert variant="destructive" className="mt-4">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>El análisis falló</AlertTitle>
                  <AlertDescription>{scan.error}</AlertDescription>
                </Alert>
              )}
            </CyberPanel>
          )}

          {/* ── Resultados ── */}
          {isDone && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {SEVERITY_ORDER.map((sev) => (
                  <CyberCard key={sev} variant={sev === 'critical' || sev === 'high' ? 'critical' : 'default'} padding="p-4">
                    <div className={cn(
                      'font-mono text-2xl font-bold leading-none',
                      sev === 'critical' && 'text-red-400',
                      sev === 'high' && 'text-orange-400',
                      sev === 'medium' && 'text-amber-400',
                      sev === 'low' && 'text-blue-400',
                      sev === 'unknown' && 'text-muted-foreground',
                    )}>
                      {scan.summary[sev] ?? 0}
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase text-muted-foreground">{sev}</div>
                  </CyberCard>
                ))}
              </div>

              {scan.source_type !== 'image' && (
              <>
              {/* Gitleaks */}
              <CyberPanel
                title="Secretos hardcodeados (Gitleaks)"
                subtitle={scan.gitleaks.scanned_git_history ? 'Incluye todo el historial de commits — encuentra secretos ya borrados' : 'Solo el árbol de archivos actual (sin historial de git, ej. .zip subido)'}
              >
                {scan.gitleaks.error && (
                  <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{scan.gitleaks.error}</p>
                )}
                {scan.gitleaks.findings.length === 0 ? (
                  scan.gitleaks.error ? (
                    <EmptyState icon={AlertTriangle} title="No se pudo completar el análisis" detail="Gitleaks falló antes de terminar — no se pudo verificar si hay secretos. Revisa el error de arriba." />
                  ) : (
                    <EmptyState icon={KeyRound} title="Sin secretos detectados" detail="No se encontraron API keys, contraseñas ni llaves privadas hardcodeadas." />
                  )
                ) : (
                  <div className="space-y-1.5">
                    {scan.gitleaks.findings.map((f, i) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                            {f.rule_id}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{f.file}:{f.line}</span>
                          <span className="font-mono text-xs text-foreground">{f.secret_masked}</span>
                        </div>
                        {f.commit && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            commit {f.commit.slice(0, 8)} · {f.author} · {f.date ? new Date(f.date).toLocaleDateString('es-ES') : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CyberPanel>

              {/* TruffleHog */}
              <CyberPanel
                title="Secretos verificados en vivo (TruffleHog)"
                subtitle={scan.trufflehog.scanned_git_history ? 'Confirma contra la API real del proveedor — incluye historial de commits' : 'Confirma contra la API real del proveedor — solo árbol actual (sin historial)'}
              >
                {scan.trufflehog.error && (
                  <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{scan.trufflehog.error}</p>
                )}
                {scan.trufflehog.findings.length === 0 ? (
                  scan.trufflehog.error ? (
                    <EmptyState icon={AlertTriangle} title="No se pudo completar el análisis" detail="TruffleHog falló antes de terminar — no se pudo verificar si hay secretos. Revisa el error de arriba." />
                  ) : (
                    <EmptyState icon={KeyRound} title="Sin secretos detectados" detail="TruffleHog no encontró credenciales reconocibles en el código." />
                  )
                ) : (
                  <div className="space-y-1.5">
                    {scan.trufflehog.findings.map((f, i) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                            {f.detector}
                            {f.verified && (
                              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/30">VERIFICADO EN VIVO</span>
                            )}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{f.file}:{f.line}</span>
                          <span className="font-mono text-xs text-foreground">{f.secret_masked}</span>
                        </div>
                        {f.commit && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            commit {f.commit.slice(0, 8)} · {f.author}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CyberPanel>

              {/* Backdoors */}
              <CyberPanel title="Backdoors y webshells" subtitle={`${scan.backdoors.files_scanned} archivo(s) analizados`}>
                {scan.backdoors.findings.length === 0 ? (
                  <EmptyState icon={ShieldAlert} title="Sin patrones de backdoor detectados" detail="No se encontraron firmas conocidas de webshells, RCE, o deserialización insegura." />
                ) : (
                  <div className="space-y-1.5">
                    {scan.backdoors.findings.map((f: CodeFinding, i: number) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                            {f.type}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{f.file}:{f.line}</span>
                        </div>
                        {f.snippet && (
                          <code className="mt-1.5 block truncate rounded bg-[hsl(var(--muted))]/40 px-2 py-1 font-mono text-[11px] text-foreground">
                            {f.snippet}
                          </code>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CyberPanel>

              {/* Semgrep */}
              <CyberPanel title="Vulnerabilidades en el código (Semgrep)" subtitle="SQLi, XSS, path traversal y más — ~280 reglas reales de la comunidad">
                {scan.semgrep.error && (
                  <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{scan.semgrep.error}</p>
                )}
                {scan.semgrep.findings.length === 0 ? (
                  scan.semgrep.error ? (
                    <EmptyState icon={AlertTriangle} title="No se pudo completar el análisis" detail="Semgrep falló antes de terminar — no se pudo verificar el código. Revisa el error de arriba." />
                  ) : (
                    <EmptyState icon={ScanSearch} title="Sin vulnerabilidades detectadas" detail="Ninguna de las ~280 reglas de Semgrep encontró patrones de SQLi, XSS, path traversal u otras vulnerabilidades conocidas." />
                  )
                ) : (
                  <div className="space-y-1.5">
                    {scan.semgrep.findings.map((f, i) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                            {f.rule_id?.split('.').pop()}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{f.file}:{f.line}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{f.message}</p>
                        {(f.cwe?.length || f.owasp?.length) && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {f.cwe?.map((c) => (
                              <span key={c} className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c.split(':')[0]}</span>
                            ))}
                            {f.owasp?.map((o) => (
                              <span key={o} className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{o}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CyberPanel>

              {/* Trivy */}
              <CyberPanel title="Dependencias vulnerables (Trivy)" subtitle="Resuelve el árbol completo vía lockfiles">
                {scan.trivy.error && (
                  <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{scan.trivy.error}</p>
                )}
                {scan.trivy.findings.length === 0 ? (
                  scan.trivy.error ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="No se pudo completar el análisis"
                      detail="Trivy falló antes de terminar — esto NO significa que las dependencias estén libres de vulnerabilidades, solo que no se pudo verificar. Revisa el error de arriba."
                    />
                  ) : (
                    <EmptyState icon={PackageSearch} title="Sin CVEs conocidos" detail="Ninguna de las dependencias resueltas tiene vulnerabilidades públicas conocidas." />
                  )
                ) : (
                  <div className="space-y-1.5">
                    {scan.trivy.findings.map((f, i) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                            {f.package}@{f.installed_version}
                            {f.fixed_version && <span className="text-emerald-400">→ {f.fixed_version}</span>}
                          </span>
                          <a
                            href={`https://nvd.nist.gov/vuln/detail/${f.vuln_id}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 font-mono text-xs text-[var(--cyber-accent)] hover:underline"
                          >
                            {f.vuln_id} <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{f.title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CyberPanel>

              {/* Dependency-Check */}
              <CyberPanel title="Dependencias vulnerables (OWASP Dependency-Check)" subtitle="Segunda fuente, para contrastar contra Trivy">
                {scan.dependency_check.error && (
                  <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{scan.dependency_check.error}</p>
                )}
                {scan.dependency_check.findings.length === 0 ? (
                  scan.dependency_check.error ? (
                    <EmptyState
                      icon={AlertTriangle}
                      title="No se pudo completar el análisis"
                      detail="Dependency-Check falló o no terminó a tiempo — esto NO significa que las dependencias estén libres de vulnerabilidades, solo que no se pudo verificar. Revisa el error de arriba."
                    />
                  ) : (
                    <EmptyState icon={PackageSearch} title="Sin CVEs conocidos" detail="OWASP Dependency-Check no encontró vulnerabilidades conocidas." />
                  )
                ) : (
                  <div className="space-y-1.5">
                    {scan.dependency_check.findings.map((f, i) => (
                      <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                            {f.package}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">{f.vuln_id} {f.cvss_score ? `(CVSS ${f.cvss_score})` : ''}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{f.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CyberPanel>
              </>
              )}

              {scan.source_type === 'image' && (
                <CyberPanel title="Imagen Docker (Trivy)" subtitle={`${scan.source} — vulnerabilidades, secretos y configuración insegura, capa por capa`}>
                  {scan.trivy.error && (
                    <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{scan.trivy.error}</p>
                  )}
                  {scan.trivy.findings.length === 0 ? (
                    <EmptyState icon={Container} title="Sin hallazgos" detail="No se encontraron vulnerabilidades, secretos ni configuración insegura en esta imagen." />
                  ) : (
                    <div className="space-y-1.5">
                      {scan.trivy.findings.map((f: TrivyFinding, i: number) => (
                        <div key={i} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-mono text-xs">
                              <CyberBadge type={severityBadgeType(f.severity)} size="sm" />
                              <span className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{f.kind}</span>
                              {f.kind === 'vuln' ? `${f.package}@${f.installed_version}` : f.title}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground">{f.vuln_id || f.category}</span>
                          </div>
                          {(f.title && f.kind === 'vuln') && <p className="mt-1 text-xs text-muted-foreground">{f.title}</p>}
                          {f.message && <p className="mt-1 text-xs text-muted-foreground">{f.message}</p>}
                          {f.fixed_version && <p className="mt-1 text-[11px] text-emerald-400">Corregido en: {f.fixed_version}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CyberPanel>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  )
}
