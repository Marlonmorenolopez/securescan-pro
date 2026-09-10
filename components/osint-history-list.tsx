'use client'
// components/osint-history-list.tsx — SecureScan Pro
// Historial unificado de OSINT (breach-check, username search, búsqueda
// profunda/Sherlock, theHarvester). Vive dentro de app/history/page.tsx,
// como vista separada porque los Jobs de OSINT tienen una forma de datos
// distinta (email/username/domain en vez de target/score) — mismo patrón
// que CodeScanHistoryList.

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Search, Trash2, Mail, User, Globe, ShieldAlert } from 'lucide-react'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { CyberButton } from '@/components/cyber/CyberButton'
import { cn } from '@/lib/utils'
import { getOsintHistory, deleteScan } from '@/lib/api-client'
import { ReportDownloadModal } from '@/components/report-download-modal'
import type { OsintHistoryItem } from '@/lib/api-client'

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const TYPE_META: Record<string, { label: string; icon: typeof Mail }> = {
  'osint-breach':   { label: 'Verificación de brecha (XposedOrNot)', icon: Mail },
  'osint-username': { label: 'Búsqueda de username',                icon: User },
  'osint-deep':     { label: 'Búsqueda profunda (Sherlock)',         icon: User },
  'osint-harvest':  { label: 'theHarvester',                        icon: Globe },
}

function targetOf(scan: OsintHistoryItem): string {
  return scan.email || scan.username || scan.domain || scan.id
}

function OsintRow({ scan, onDelete }: { scan: OsintHistoryItem; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const meta = TYPE_META[scan.scan_type] || { label: scan.scan_type, icon: ShieldAlert }
  const Icon = meta.icon

  const handleDelete = async () => {
    setDeleting(true)
    const res = await deleteScan(scan.id)
    if (res.error) {
      toast.error('No se pudo eliminar el resultado', { description: res.error.error })
      setDeleting(false)
      return
    }
    toast.success('Resultado eliminado', { description: targetOf(scan) })
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
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <code className="truncate font-mono text-sm text-foreground">{targetOf(scan)}</code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{meta.label}</span>
          <span className="font-mono text-[10px] text-muted-foreground">· {formatDate(scan.startTime)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        {scan.status === 'completed' && (
          <ReportDownloadModal scanId={scan.id} />
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
          aria-label="Eliminar resultado"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function OsintHistoryList() {
  const [scans, setScans]     = useState<OsintHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await getOsintHistory()
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
        <EmptyState icon={Search} title="No se pudo cargar el historial" detail={error} />
        <CyberButton size="sm" onClick={load}>Reintentar</CyberButton>
      </div>
    )
  }

  if (scans.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Sin resultados OSINT todavía"
        detail="Las verificaciones de brecha, búsquedas de username y theHarvester que corras van a aparecer acá."
      />
    )
  }

  return (
    <div className="space-y-3">
      {scans.map((scan) => (
        <OsintRow key={scan.id} scan={scan} onDelete={handleDelete} />
      ))}
    </div>
  )
}
