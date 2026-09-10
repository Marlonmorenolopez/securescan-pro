'use client'
// components/code-scan-history-list.tsx — SecureScan Pro v5.1
// Lista de análisis de código pasados (Grupo 3). Vive dentro de
// app/history/page.tsx, como vista separada de los escaneos web porque
// los code-scans tienen una forma de datos distinta (source/summary en
// vez de target/score).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Github, Upload, Trash2, ExternalLink } from 'lucide-react'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { CyberButton } from '@/components/cyber/CyberButton'
import { cn } from '@/lib/utils'
import { getCodeScanHistory, deleteScan } from '@/lib/api-client'
import type { CodeScanStatusResponse } from '@/lib/api-client'
import { ReportDownloadModal } from '@/components/report-download-modal'

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function CodeScanRow({ scan, onDelete }: { scan: CodeScanStatusResponse; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const summary = scan.summary

  const handleDelete = async () => {
    setDeleting(true)
    const res = await deleteScan(scan.id)
    if (res.error) {
      toast.error('No se pudo eliminar el análisis', { description: res.error.error })
      setDeleting(false)
      return
    }
    toast.success('Análisis eliminado', { description: scan.source })
    onDelete(scan.id)
  }

  const statusType =
    scan.status === 'completed' ? 'completed' :
    scan.status === 'error'     ? 'error'     : 'running'

  return (
    <div className={cn(
      'grid grid-cols-[1fr_auto] gap-4 rounded-lg border p-4 transition-all duration-200',
      'border-[hsl(var(--border))] bg-[hsl(var(--card))]',
      'hover:border-[rgba(var(--cyber-accent-rgb),0.25)] hover:shadow-cyber-sm',
    )}>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <CyberBadge type={statusType} size="sm" />
          {scan.source_type === 'repo' ? (
            <Github className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <code className="truncate font-mono text-sm text-foreground">{scan.source}</code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{formatDate(scan.startTime)}</span>
          {summary && summary.total > 0 && (
            <span className="flex items-center gap-1">
              {summary.critical > 0 && <CyberBadge type="critical" label={`${summary.critical}C`} size="sm" />}
              {summary.high     > 0 && <CyberBadge type="high"     label={`${summary.high}H`}     size="sm" />}
              {summary.medium   > 0 && <CyberBadge type="medium"   label={`${summary.medium}M`}   size="sm" />}
              {summary.low      > 0 && <CyberBadge type="low"      label={`${summary.low}L`}      size="sm" />}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        {scan.status === 'completed' && (
          <>
            <Link
              href={`/code-scan?id=${scan.id}`}
              className="flex h-8 items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 text-xs text-muted-foreground transition-colors hover:border-[rgba(var(--cyber-accent-rgb),0.3)] hover:text-[var(--cyber-accent)]"
            >
              Ver <ExternalLink className="h-3 w-3" />
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
            deleting && 'opacity-40 pointer-events-none',
          )}
          aria-label="Eliminar análisis"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function CodeScanHistoryList() {
  const [scans, setScans]     = useState<CodeScanStatusResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getCodeScanHistory()
    if (err) setError(err.error)
    else setScans(data?.scans ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = (id: string) => setScans((prev) => prev.filter((s) => s.id !== id))

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/30" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3 text-center">
        <EmptyState icon={Github} title="No se pudo cargar el historial" detail={error} />
        <CyberButton size="sm" onClick={load}>Reintentar</CyberButton>
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={Github}
        title="Sin análisis de código todavía"
        detail="Los análisis que corras desde la página de Código van a aparecer acá."
      />
    )
  }

  return (
    <div className="space-y-3">
      {scans.map((scan) => (
        <CodeScanRow key={scan.id} scan={scan} onDelete={handleDelete} />
      ))}
    </div>
  )
}
