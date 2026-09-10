'use client'
// components/cyber/RecentActivity.tsx — SecureScan Pro · Home v3
//
// Lista resumida de escaneos recientes, con el mismo formato de fila que
// app/history/page.tsx → ScanRow (target, fecha, duración, grade, estado).
//
// FUENTE DE DATOS: recibe RecentScanMock[] (lib/home-mock-data.ts), que es
// un Pick<ScanStatusResponse, ...> — el mismo tipo real que devuelve
// getScanHistory().scans. Para conectar datos reales: pasar
// getScanHistory().scans.slice(0, N) en vez del mock.

import Link from 'next/link'
import { CyberPanel } from './CyberPanel'
import { CyberBadge } from './CyberBadge'
import { CyberButton } from './CyberButton'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecentScanMock } from '@/lib/home-mock-data'

function getGradeColor(grade: string): string {
  if (grade?.startsWith('A')) return 'text-emerald-400'
  if (grade?.startsWith('B')) return 'text-blue-400'
  if (grade?.startsWith('C')) return 'text-amber-400'
  if (grade?.startsWith('D')) return 'text-orange-400'
  return 'text-red-400'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
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

interface RecentActivityProps {
  scans: RecentScanMock[]
  className?: string
}

export function RecentActivity({ scans, className }: RecentActivityProps) {
  return (
    <CyberPanel
      title="Recent Activity"
      subtitle="Resumen de escaneos · datos de ejemplo"
      action={
        <Link href="/history">
          <CyberButton variant="ghost" size="sm" icon={<ChevronRight className="h-3.5 w-3.5" />}>
            Ver historial
          </CyberButton>
        </Link>
      }
      noPadding
      className={className}
    >
      <div className="divide-y divide-[hsl(var(--border))]/60">
        {scans.map(scan => {
          const statusType =
            scan.status === 'completed' ? 'completed' :
            scan.status === 'error'     ? 'error'     :
            scan.status === 'running'   ? 'running'   : 'pending'

          return (
            <div key={scan.id} className="flex min-w-0 items-center justify-between gap-4 px-5 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <CyberBadge type={statusType} size="sm" />
                <div className="min-w-0">
                  <code className="block truncate font-mono text-sm text-foreground">
                    {scan.target}
                  </code>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatDate(scan.startTime)}
                    {scan.endTime && ` · ${calcDuration(scan.startTime, scan.endTime)}`}
                  </span>
                </div>
              </div>
              <span className={cn('font-mono text-lg font-bold shrink-0', getGradeColor(scan.score.grade))}>
                {scan.score.grade}
              </span>
            </div>
          )
        })}
      </div>
    </CyberPanel>
  )
}
