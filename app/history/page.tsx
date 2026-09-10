'use client'
// app/history/page.tsx — SecureScan Pro v5.0 · Historial SOC
// Semana 4: rediseño visual con sistema Cyber.
// Lógica de datos 100% preservada (getScanHistory, deleteScan, filtros).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import {
  History, Search, Trash2, CheckCircle, XCircle,
  Clock, RefreshCw, Filter, Shield, Download, TrendingUp,
} from 'lucide-react'
import { Input }  from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Header }               from '@/components/header'
import { CyberCard }            from '@/components/cyber/CyberCard'
import { CyberPanel }           from '@/components/cyber/CyberPanel'
import { CyberButton }          from '@/components/cyber/CyberButton'
import { CyberBadge }           from '@/components/cyber/CyberBadge'
import { EmptyState }           from '@/components/cyber/EmptyState'
import { cn }                   from '@/lib/utils'
import { getScanHistory, deleteScan } from '@/lib/api-client'
import { ReportDownloadModal }  from '@/components/report-download-modal'
import { CodeScanHistoryList }  from '@/components/code-scan-history-list'
import { OsintHistoryList }     from '@/components/osint-history-list'
import type { ScanStatusResponse } from '@/lib/api-client'
import {
  fadeIn, slideInUp, staggerContainer, staggerItem,
  glowHover, glowTap, getVariants,
} from '@/lib/motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'

// ─── Helpers (sin cambios) ────────────────────────────────────────────────────
function getGradeColor(grade: string): string {
  if (grade?.startsWith('A')) return 'text-emerald-400'
  if (grade?.startsWith('B')) return 'text-amber-400'
  if (grade?.startsWith('C')) return 'text-orange-400'
  if (grade?.startsWith('D')) return 'text-red-400'
  return 'text-red-400'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function calcDuration(start?: string, end?: string): string {
  if (!start || !end) return '—'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`
}

// ─── Fila de escaneo ─────────────────────────────────────────────────────────
function ScanRow({
  scan, onDelete, compareMode, selected, onToggleSelect,
}: {
  scan: ScanStatusResponse
  onDelete: (id: string) => void
  compareMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const res = await deleteScan(scan.id)
    if (res.error) {
      toast.error('No se pudo eliminar el escaneo', {
        description: res.error.error,
      })
      setDeleting(false)
      return
    }
    toast.success('Escaneo eliminado', { description: scan.target })
    onDelete(scan.id)
  }

  const statusType =
    scan.status === 'completed' ? 'completed' :
    scan.status === 'error'     ? 'error'     :
    scan.status === 'running'   ? 'running'   : 'pending'

  const breakdown = scan.score?.breakdown

  return (
    <div className="flex items-center gap-3">
      {/* Checkbox de comparación — fuera del grid para no desalinear sus columnas fijas */}
      {compareMode && (
        <input
          type="checkbox"
          checked={!!selected}
          disabled={scan.status !== 'completed'}
          onChange={() => onToggleSelect?.(scan.id)}
          aria-label={`Seleccionar ${scan.target} para comparar`}
          className="h-4 w-4 shrink-0 rounded border-[hsl(var(--border))] accent-[var(--cyber-accent)] disabled:opacity-30"
        />
      )}

    <div className={cn(
      'grid flex-1 grid-cols-[1fr_auto] gap-4 rounded-lg border p-4 transition-all duration-200',
      'border-[hsl(var(--border))] bg-[hsl(var(--card))]',
      'hover:border-[rgba(var(--cyber-accent-rgb),0.25)] hover:shadow-cyber-sm',
      'lg:grid-cols-[2fr_1fr_1fr_1fr_auto]'
    )}>

      {/* Target + fecha */}
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <CyberBadge type={statusType} size="sm" />
          <code className="truncate font-mono text-sm text-foreground">
            {scan.target}
          </code>
          {/* Grade compacto — solo mobile/tablet, en lg: ya existe la columna completa de Score */}
          {scan.score && (
            <span className={cn('shrink-0 font-mono text-xs font-bold lg:hidden', getGradeColor(scan.score.grade))}>
              {scan.score.riskLevel === 'PROTEGIDO' ? '🛡️' : scan.score.riskLevel === 'VULNERABLE' ? '⚠️' : scan.score.riskLevel === 'EXPUESTO' ? '🚨' : '☠️'}
            </span>
          )}
        </div>
        <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>
            {formatDate(scan.startTime)}
            {scan.endTime && ` · ${calcDuration(scan.startTime, scan.endTime)}`}
          </span>
          {/* Severidades críticas/altas compactas — solo mobile/tablet */}
          {breakdown && (breakdown.critical > 0 || breakdown.high > 0) && (
            <span className="flex items-center gap-1 lg:hidden">
              {breakdown.critical > 0 && <CyberBadge type="critical" label={`${breakdown.critical}C`} size="sm" />}
              {breakdown.high     > 0 && <CyberBadge type="high"     label={`${breakdown.high}H`}     size="sm" />}
            </span>
          )}
        </span>
      </div>

      {/* Score — oculto en móvil */}
      <div className="hidden lg:flex lg:items-center">
        {scan.score ? (
          <div className="flex items-baseline gap-1">
            <span className={cn('font-mono text-2xl font-bold', getGradeColor(scan.score.grade))}>
              {scan.score.riskLevel === 'PROTEGIDO' ? '🛡️ Protegido' : scan.score.riskLevel === 'VULNERABLE' ? '⚠️ Vulnerable' : scan.score.riskLevel === 'EXPUESTO' ? '🚨 Expuesto' : '☠️ Comprometido'}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {scan.score.total}/100
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>

      {/* Severidades — oculto en móvil */}
      <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-1">
        {breakdown ? (
          <>
            {breakdown.critical > 0 && <CyberBadge type="critical" label={`${breakdown.critical}C`} size="sm" />}
            {breakdown.high     > 0 && <CyberBadge type="high"     label={`${breakdown.high}H`}     size="sm" />}
            {breakdown.medium   > 0 && <CyberBadge type="medium"   label={`${breakdown.medium}M`}   size="sm" />}
            {breakdown.low      > 0 && <CyberBadge type="low"      label={`${breakdown.low}L`}      size="sm" />}
            {!breakdown.critical && !breakdown.high && !breakdown.medium && !breakdown.low && (
              <span className="font-mono text-xs text-muted-foreground">Sin hallazgos</span>
            )}
          </>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* ID — oculto en móvil */}
      <div className="hidden lg:flex lg:items-center">
        <code className="font-mono text-[10px] text-muted-foreground">
          {scan.id.slice(0, 8)}…
        </code>
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-1">
        {scan.status === 'completed' && (
          <>
            <Link
              href={`/history/timeline?target=${encodeURIComponent(scan.target)}`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-all duration-150 hover:border-[rgba(var(--cyber-accent-rgb),0.3)] hover:text-[var(--cyber-accent)]"
              aria-label={`Ver evolución de ${scan.target}`}
              title="Ver evolución de este target"
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </Link>
            <ReportDownloadModal scanId={scan.id} />
          </>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border border-transparent',
            'text-muted-foreground transition-all duration-150',
            'hover:border-red-900/50 hover:bg-red-500/10 hover:text-red-400',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
            deleting && 'opacity-40 pointer-events-none'
          )}
          aria-label="Eliminar escaneo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
      ))}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const prefersReduced = useReducedMotion() ?? false
  const sv = (v: Parameters<typeof getVariants>[0]) => getVariants(v, prefersReduced)

  const [scans, setScans]             = useState<ScanStatusResponse[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode]       = useState<'web' | 'code' | 'osint'>('web')
  const [compareMode, setCompareMode] = useState(false)
  const [compareSelection, setCompareSelection] = useState<string[]>([])

  const toggleCompareSelection = (id: string) => {
    setCompareSelection(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 2) return [prev[1], id] // mantiene las 2 más recientes seleccionadas
      return [...prev, id]
    })
  }

  const goToComparison = () => {
    if (compareSelection.length !== 2) return
    window.location.href = `/history/compare?a=${compareSelection[0]}&b=${compareSelection[1]}`
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getScanHistory()
    if (err) setError(err.error)
    else setScans(data?.scans ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = (id: string) => setScans(prev => prev.filter(s => s.id !== id))

  const filtered = scans.filter(s => {
    const matchSearch = s.target.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  // Estadísticas del historial
  const stats = {
    total:     scans.length,
    completed: scans.filter(s => s.status === 'completed').length,
    errors:    scans.filter(s => s.status === 'error').length,
    critical:  scans.filter(s => (s.score?.breakdown?.critical ?? 0) > 0).length,
  }

  // Tendencia de score en el tiempo — usa currentScan.score.total real (la
  // misma fuente de verdad que ScoreCard/GlobalScore en el Scanner), ordenado
  // cronológicamente. Solo escaneos completados con score disponible.
  const trendData = scans
    .filter(s => s.status === 'completed' && s.score)
    .slice()
    .sort((a, b) => new Date(a.startTime ?? 0).getTime() - new Date(b.startTime ?? 0).getTime())
    .map(s => ({
      date: formatDate(s.startTime).split(',')[0], // solo fecha, sin hora, para el eje X
      score: s.score!.total,
      grade: s.score!.grade,
      target: s.target,
    }))

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

          {/* ── Hero ── */}
          <motion.div
            className="relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-8"
            variants={sv(slideInUp)}
            initial="hidden"
            animate="visible"
          >
            <div className="cyber-grid-bg pointer-events-none absolute inset-0 opacity-40" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_50%,rgba(var(--cyber-accent-rgb),0.07),transparent)]" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <History className="h-5 w-5 text-[var(--cyber-accent)]" />
                  <h1 className="text-2xl font-bold tracking-tight">Historial de Escaneos</h1>
                </div>
                <p className="font-mono text-sm text-muted-foreground">
                  {stats.total} escaneo{stats.total !== 1 ? 's' : ''} registrados
                </p>
              </div>
              <CyberButton
                variant="ghost" size="sm"
                icon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />}
                onClick={load}
                disabled={loading}
              >
                Actualizar
              </CyberButton>
            </div>
          </motion.div>

          {/* ── Toggle de vista ── */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('web')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                viewMode === 'web'
                  ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                  : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
              )}
            >
              Escaneos Web
            </button>
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                viewMode === 'code'
                  ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                  : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
              )}
            >
              Análisis de Código
            </button>
            <button
              type="button"
              onClick={() => setViewMode('osint')}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                viewMode === 'osint'
                  ? 'border-[var(--cyber-accent)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]'
                  : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
              )}
            >
              OSINT
            </button>

            {viewMode === 'web' && (
              <button
                type="button"
                onClick={() => { setCompareMode(v => !v); setCompareSelection([]) }}
                className={cn(
                  'ml-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  compareMode
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                    : 'border-[hsl(var(--border))] text-muted-foreground hover:border-[rgba(var(--cyber-accent-rgb),0.3)]',
                )}
              >
                <TrendingUp className="h-4 w-4" />
                {compareMode ? `Comparando (${compareSelection.length}/2)` : 'Comparar escaneos'}
              </button>
            )}
            {compareMode && compareSelection.length === 2 && (
              <CyberButton size="sm" onClick={goToComparison}>
                Ver comparación
              </CyberButton>
            )}
          </div>

          {viewMode === 'code' ? (
            <CodeScanHistoryList />
          ) : viewMode === 'osint' ? (
            <OsintHistoryList />
          ) : (
            <>

          {/* ── KPI del historial ── */}
          <motion.div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            variants={sv(staggerContainer)}
            initial="hidden"
            animate="visible"
          >
            {[
              { label: 'Total',      value: stats.total,     color: 'text-[var(--cyber-accent)]', border: 'border-[rgba(var(--cyber-accent-rgb),0.20)]' },
              { label: 'Completados',value: stats.completed, color: 'text-emerald-400',            border: 'border-emerald-900/40' },
              { label: 'Con errores',value: stats.errors,    color: 'text-red-400',                border: 'border-red-900/40'     },
              { label: 'Con Critical',value: stats.critical, color: 'text-orange-400',             border: 'border-orange-900/40'  },
            ].map(k => (
              <motion.div
                key={k.label}
                variants={sv(staggerItem)}
                whileHover={prefersReduced ? undefined : { y: -2 }}
                className={cn(
                  'corner-brackets flex flex-col gap-1 rounded-lg border p-4 transition-shadow duration-200 hover:shadow-cyber-sm',
                  'bg-[hsl(var(--card))]', k.border
                )}
              >
                <span className={cn('font-mono text-3xl font-bold tabular-nums', k.color)}>
                  {k.value}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {k.label}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* ── Tendencia de Score en el tiempo ── */}
          {trendData.length >= 2 && (
            <motion.div variants={sv(fadeIn)} initial="hidden" animate="visible">
              <CyberPanel
                title="Tendencia de Seguridad"
                subtitle="Evolución del score real por escaneo completado"
                action={<TrendingUp className="h-4 w-4 text-[var(--cyber-accent)]" />}
              >
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ left: -16, right: 8, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <ReferenceLine y={70} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: number, _name, entry: any) => [
                          `${value}/100 (${entry.payload.grade})`, entry.payload.target,
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--cyber-accent)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'var(--cyber-accent)' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CyberPanel>
            </motion.div>
          )}

          {/* ── Error ── */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* ── Filtros ── */}
          <CyberCard padding="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por target..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 font-mono text-sm border-[hsl(var(--border))] bg-[hsl(var(--background))] focus-visible:ring-[var(--cyber-accent)]"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 font-mono text-sm border-[hsl(var(--border))] focus:ring-[var(--cyber-accent)]">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="completed">Completado</SelectItem>
                    <SelectItem value="running">En curso</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CyberCard>

          {/* ── Lista de escaneos ── */}
          <div className="space-y-3">
            {/* Header de columnas (desktop) */}
            {filtered.length > 0 && (
              <div className={cn(
                'hidden px-4 lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:gap-4',
                compareMode && 'lg:ml-7', // alinea con el checkbox añadido a la izquierda de cada fila
              )}>
                {['Target / Fecha', 'Score', 'Severidades', 'ID', 'Acciones'].map(h => (
                  <span key={h} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {h}
                  </span>
                ))}
              </div>
            )}

            {loading ? (
              <HistorySkeleton />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Shield}
                title={
                  search || statusFilter !== 'all'
                    ? 'No hay resultados para estos filtros'
                    : 'No hay escaneos registrados'
                }
                detail={
                  !search && statusFilter === 'all'
                    ? 'Inicia tu primer escaneo desde la página del Scanner'
                    : undefined
                }
              />
            ) : (
              <motion.div
                className="space-y-3"
                variants={sv(staggerContainer)}
                initial="hidden"
                animate="visible"
              >
                {filtered.map(scan => (
                  <motion.div key={scan.id} variants={sv(staggerItem)}>
                    <ScanRow
                      scan={scan}
                      onDelete={handleDelete}
                      compareMode={compareMode}
                      selected={compareSelection.includes(scan.id)}
                      onToggleSelect={toggleCompareSelection}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

            </>
          )}

        </div>
      </main>

      <footer className="mt-auto border-t border-[hsl(var(--border))] py-5">
        <div className="container mx-auto px-4 text-center font-mono text-xs text-muted-foreground">
          SecureScan Pro v5.0 · Proyecto Académico SENA
        </div>
      </footer>
    </div>
  )
}
