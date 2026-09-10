'use client'
// app/osint/page.tsx — SecureScan Pro v5.1
// OSINT (Grupo 2): brechas de datos por correo (XposedOrNot) y búsqueda
// de username en ~19 plataformas. Página autocontenida, sin polling —
// ambas herramientas responden en una sola petición síncrona.

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Search, Mail, AtSign, Globe2, ShieldAlert, ShieldCheck, ExternalLink,
  Loader2, AlertTriangle, HelpCircle, Telescope, CheckCircle2, XCircle,
} from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { ReportDownloadModal } from '@/components/report-download-modal'
import {
  checkEmailBreach, searchUsername, startDeepUsernameSearch, getDeepUsernameSearchStatus,
  startDomainHarvest, getDomainHarvestStatus,
} from '@/lib/api-client'
import type { EmailBreachResponse, UsernameSearchResponse, DeepUsernameSearchStatus, DomainHarvestStatus } from '@/lib/api-client'

type Mode = 'email' | 'username' | 'domain'

function riskBadgeType(label: string | null): 'critical' | 'medium' | 'low' | 'info' {
  if (!label) return 'info'
  const l = label.toLowerCase()
  if (l === 'high') return 'critical'
  if (l === 'medium') return 'medium'
  return 'low'
}

export default function OsintPage() {
  const [mode, setMode] = useState<Mode>('email')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [emailResult, setEmailResult] = useState<EmailBreachResponse | null>(null)
  const [usernameResult, setUsernameResult] = useState<UsernameSearchResponse | null>(null)

  // ── Búsqueda profunda (Sherlock real) ──────────────────────────────────────
  const [deepScan, setDeepScan]     = useState<DeepUsernameSearchStatus | null>(null)
  const [deepStarting, setDeepStarting] = useState(false)
  const deepPollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pollDeep = useCallback((id: string) => {
    const tick = async () => {
      const { data, error } = await getDeepUsernameSearchStatus(id)
      if (error || !data) {
        deepPollRef.current = setTimeout(tick, 3000)
        return
      }
      setDeepScan(data)
      if (data.status === 'running') {
        deepPollRef.current = setTimeout(tick, 3000)
      }
    }
    tick()
  }, [])

  async function handleDeepSearch() {
    if (!usernameResult) return
    setDeepStarting(true)
    setDeepScan(null)
    const { data, error } = await startDeepUsernameSearch(usernameResult.username)
    setDeepStarting(false)
    if (error || !data) {
      setFormError(error?.error || 'No se pudo iniciar la búsqueda profunda')
      return
    }
    pollDeep(data.jobId)
  }

  // ── Búsqueda por dominio (theHarvester real) ────────────────────────────────
  const [harvestScan, setHarvestScan] = useState<DomainHarvestStatus | null>(null)
  const harvestPollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pollHarvest = useCallback((id: string) => {
    const tick = async () => {
      const { data, error } = await getDomainHarvestStatus(id)
      if (error || !data) {
        harvestPollRef.current = setTimeout(tick, 3000)
        return
      }
      setHarvestScan(data)
      if (data.status === 'running') {
        harvestPollRef.current = setTimeout(tick, 3000)
      }
    }
    tick()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!query.trim()) {
      setFormError(mode === 'email' ? 'Ingresa un correo' : mode === 'username' ? 'Ingresa un username' : 'Ingresa un dominio')
      return
    }

    setLoading(true)
    setEmailResult(null)
    setUsernameResult(null)
    setDeepScan(null)
    setHarvestScan(null)
    if (deepPollRef.current) clearTimeout(deepPollRef.current)
    if (harvestPollRef.current) clearTimeout(harvestPollRef.current)

    if (mode === 'email') {
      const { data, error } = await checkEmailBreach(query.trim())
      setLoading(false)
      if (error || !data) {
        setFormError(error?.error || 'No se pudo verificar el correo')
        return
      }
      setEmailResult(data)
    } else if (mode === 'username') {
      const { data, error } = await searchUsername(query.trim())
      setLoading(false)
      if (error || !data) {
        setFormError(error?.error || 'No se pudo buscar el username')
        return
      }
      setUsernameResult(data)
    } else {
      const { data, error } = await startDomainHarvest(query.trim())
      setLoading(false)
      if (error || !data) {
        setFormError(error?.error || 'No se pudo iniciar la búsqueda por dominio')
        return
      }
      pollHarvest(data.jobId)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setQuery('')
    setFormError(null)
    setEmailResult(null)
    setUsernameResult(null)
    setDeepScan(null)
    setHarvestScan(null)
    if (deepPollRef.current) clearTimeout(deepPollRef.current)
    if (harvestPollRef.current) clearTimeout(harvestPollRef.current)
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl space-y-8 px-4 sm:px-6 lg:px-8">

          {/* ── Hero ── */}
          <motion.div
            className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="cyber-grid-bg pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative flex items-center gap-3">
              <Search className="h-6 w-6 text-[var(--cyber-accent)]" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">OSINT</h1>
                <p className="mt-1 max-w-2xl font-mono text-sm text-muted-foreground">
                  Verifica si un correo apareció en brechas de datos conocidas, o busca dónde
                  tiene presencia un username — a diferencia de Huella Digital, esto no analiza
                  un target web, sino personas.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Qué hace esta página ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CyberCard padding="p-3">
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
                <div>
                  <div className="font-mono text-xs font-semibold text-foreground">XposedOrNot</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Verifica si un correo aparece en brechas de datos conocidas (miles de millones de registros).</p>
                </div>
              </div>
            </CyberCard>
            <CyberCard padding="p-3">
              <div className="flex items-start gap-2">
                <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
                <div>
                  <div className="font-mono text-xs font-semibold text-foreground">Búsqueda rápida de username</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Revisa ~19 plataformas curadas (GitHub, Reddit, npm...) en paralelo, en segundos.</p>
                </div>
              </div>
            </CyberCard>
            <CyberCard padding="p-3">
              <div className="flex items-start gap-2">
                <Telescope className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
                <div>
                  <div className="font-mono text-xs font-semibold text-foreground">Sherlock (búsqueda profunda)</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">La herramienta real, 414 sitios. Mucho más completa, pero tarda minutos en vez de segundos.</p>
                </div>
              </div>
            </CyberCard>
            <CyberCard padding="p-3">
              <div className="flex items-start gap-2">
                <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cyber-accent)]" />
                <div>
                  <div className="font-mono text-xs font-semibold text-foreground">theHarvester</div>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">A partir de un dominio, descubre correos, subdominios e IPs cruzando varias fuentes públicas.</p>
                </div>
              </div>
            </CyberCard>
          </div>

          {/* ── Formulario ── */}
          <CyberPanel title="Buscar" subtitle="Elige qué tipo de búsqueda hacer">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => switchMode('email')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  mode === 'email'
                    ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                    : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                )}
              >
                <Mail className="h-4 w-4" /> Por correo
              </button>
              <button
                type="button"
                onClick={() => switchMode('username')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  mode === 'username'
                    ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                    : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                )}
              >
                <AtSign className="h-4 w-4" /> Por username
              </button>
              <button
                type="button"
                onClick={() => switchMode('domain')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                  mode === 'domain'
                    ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                    : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                )}
              >
                <Globe2 className="h-4 w-4" /> Por dominio
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                placeholder={mode === 'email' ? 'correo@ejemplo.com' : mode === 'username' ? 'nombre_de_usuario' : 'ejemplo.com'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="font-mono text-sm"
              />

              {formError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <CyberButton type="submit" variant="primary" loading={loading} disabled={loading}>
                {mode === 'email' ? 'Verificar correo' : mode === 'username' ? 'Buscar username' : 'Buscar dominio'}
              </CyberButton>
            </form>
          </CyberPanel>

          {/* ── Resultado: correo ── */}
          {emailResult && (
            <CyberPanel
              title="Brechas de datos"
              subtitle={`${emailResult.email} — vía XposedOrNot`}
              action={
                emailResult.simulated ? (
                  <span className="rounded border border-yellow-500/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-yellow-400">
                    Simulación
                  </span>
                ) : undefined
              }
            >
              {emailResult.error && (
                <p className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
                  {emailResult.error}
                </p>
              )}

              {!emailResult.breached ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Sin brechas conocidas"
                  detail="Este correo no aparece en la base de datos de brechas de XposedOrNot."
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <CyberBadge type="critical" size="sm" label={`Encontrado en ${emailResult.breach_count} brecha(s)`} />
                    {emailResult.risk_label && (
                      <CyberBadge type={riskBadgeType(emailResult.risk_label)} size="sm" label={`Riesgo: ${emailResult.risk_label}`} />
                    )}
                  </div>

                  <div className="space-y-2">
                    {emailResult.breaches.map((b, i) => (
                      <div key={i} className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold text-foreground">{b.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {b.breach_date} · {b.exposed_records?.toLocaleString('es-ES')} registros
                          </span>
                        </div>
                        {b.description && (
                          <p className="mt-1.5 text-xs text-muted-foreground">{b.description}</p>
                        )}
                        {b.exposed_data.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {b.exposed_data.map((d) => (
                              <span key={d} className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CyberPanel>
          )}

          {/* ── Resultado: username ── */}
          {usernameResult && (
            <CyberPanel
              title="Presencia en plataformas"
              subtitle={`@${usernameResult.username} — ${usernameResult.checked_count} plataformas revisadas`}
            >
              {usernameResult.error && (
                <p className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">
                  {usernameResult.error}
                </p>
              )}

              {usernameResult.found.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No se encontró en ninguna plataforma verificable"
                  detail="Puede que el username no exista en las plataformas soportadas, o que varias hayan bloqueado la consulta (ver abajo)."
                />
              ) : (
                <div className="mb-4 space-y-1.5">
                  {usernameResult.found.map((f) => (
                    <a
                      key={f.site}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-3 py-2 text-sm hover:border-emerald-500/50"
                    >
                      <span className="font-mono text-foreground">{f.site}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    </a>
                  ))}
                </div>
              )}

              {usernameResult.unknown_sites.length > 0 && (
                <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/20 px-3 py-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    <HelpCircle className="h-3 w-3" /> No se pudo verificar ({usernameResult.unknown_sites.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {usernameResult.unknown_sites.map((s) => (
                      <span key={s} className="rounded bg-[hsl(var(--muted))]/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!deepScan && (
                <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
                  <CyberButton variant="outline" size="sm" icon={<Telescope className="h-4 w-4" />} loading={deepStarting} onClick={handleDeepSearch}>
                    Búsqueda profunda (Sherlock, 414 sitios)
                  </CyberButton>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Más completa que la de arriba, pero tarda uno o varios minutos en vez de segundos.
                  </p>
                </div>
              )}
            </CyberPanel>
          )}

          {/* ── Resultado: búsqueda profunda ── */}
          {deepScan && (
            <CyberPanel
              title="Búsqueda profunda (Sherlock)"
              subtitle={`@${deepScan.username} — 414 sitios`}
              action={deepScan.status === 'completed' ? <ReportDownloadModal scanId={deepScan.id} /> : undefined}
            >
              {deepScan.status === 'running' && (
                <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--cyber-accent)]" />
                  <span className="font-mono text-sm text-foreground">Buscando en 414 sitios — puede tardar varios minutos…</span>
                </div>
              )}

              {deepScan.status === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{deepScan.error}</AlertDescription>
                </Alert>
              )}

              {deepScan.status === 'completed' && (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <CyberBadge type="completed" size="sm" label={`${deepScan.found.length} sitio(s) encontrados`} />
                    <span className="font-mono text-[11px] text-muted-foreground">{deepScan.checked_count} sitios revisados en total</span>
                  </div>

                  {deepScan.found.length === 0 ? (
                    <EmptyState icon={ShieldAlert} title="No se encontró en ningún sitio" detail="Ninguno de los 414 sitios de Sherlock tiene este username registrado." />
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {deepScan.found.map((f) => (
                        <a
                          key={f.site}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-3 py-2 text-sm hover:border-emerald-500/50"
                        >
                          <span className="truncate font-mono text-foreground">{f.site}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        </a>
                      ))}
                    </div>
                  )}

                  {deepScan.unknown_sites.length > 0 && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {deepScan.unknown_sites.length} sitio(s) no se pudieron verificar (bloqueo anti-bots o error de red) y no cuentan como "no encontrado".
                    </p>
                  )}
                </>
              )}
            </CyberPanel>
          )}

          {/* ── Resultado: búsqueda por dominio (theHarvester) ── */}
          {harvestScan && (
            <CyberPanel
              title="theHarvester"
              subtitle={`${harvestScan.domain} — correos, subdominios e IPs desde fuentes públicas`}
              action={harvestScan.status === 'completed' ? <ReportDownloadModal scanId={harvestScan.id} /> : undefined}
            >
              {harvestScan.status === 'running' && (
                <div className="flex items-center gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2.5">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--cyber-accent)]" />
                  <span className="font-mono text-sm text-foreground">Consultando fuentes OSINT (crt.sh, OTX, RapidDNS...)</span>
                </div>
              )}

              {harvestScan.status === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{harvestScan.error}</AlertDescription>
                </Alert>
              )}

              {harvestScan.status === 'completed' && (
                <>
                  {harvestScan.error && (
                    <p className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{harvestScan.error}</p>
                  )}
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <CyberCard padding="p-3">
                      <div className="font-mono text-2xl font-bold leading-none text-foreground">{harvestScan.emails.length}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">correos</div>
                    </CyberCard>
                    <CyberCard padding="p-3">
                      <div className="font-mono text-2xl font-bold leading-none text-foreground">{harvestScan.hosts.length}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">subdominios</div>
                    </CyberCard>
                    <CyberCard padding="p-3">
                      <div className="font-mono text-2xl font-bold leading-none text-foreground">{harvestScan.ips.length}</div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">IPs</div>
                    </CyberCard>
                  </div>

                  {harvestScan.emails.length === 0 && harvestScan.hosts.length === 0 && harvestScan.ips.length === 0 ? (
                    <EmptyState icon={Globe2} title="Sin resultados" detail="Ninguna de las fuentes consultadas encontró correos, subdominios o IPs para este dominio." />
                  ) : (
                    <div className="space-y-4">
                      {harvestScan.emails.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">Correos</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {harvestScan.emails.map((e) => (
                              <span key={e} className="rounded bg-[hsl(var(--muted))]/50 px-2 py-1 font-mono text-xs text-foreground">{e}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {harvestScan.hosts.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">Subdominios</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {harvestScan.hosts.map((h) => (
                              <span key={h} className="rounded bg-[hsl(var(--muted))]/50 px-2 py-1 font-mono text-xs text-foreground">{h}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {harvestScan.ips.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">IPs</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {harvestScan.ips.map((ip) => (
                              <span key={ip} className="rounded bg-[hsl(var(--muted))]/50 px-2 py-1 font-mono text-xs text-foreground">{ip}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-muted-foreground">
                    Fuentes consultadas: {harvestScan.sources_used.join(', ')}
                  </p>
                </>
              )}
            </CyberPanel>
          )}

        </div>
      </main>
    </div>
  )
}
