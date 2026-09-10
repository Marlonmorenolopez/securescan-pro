'use client'
// app/history/timeline/page.tsx — SecureScan Pro
// Evolución del score de UN target específico a través de todos sus
// escaneos completados (?target=...). Complementa el gráfico de
// "Tendencia de Seguridad" de /history, que mezcla todos los targets en
// una sola línea -- este aísla uno solo para ver si mejora o empeora.

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import { ArrowLeft, TrendingUp, Loader2, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/header'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { getScanTimeline } from '@/lib/api-client'
import type { TimelineResponse } from '@/lib/api-client'

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <TimelinePageInner />
    </Suspense>
  )
}

function TimelinePageInner() {
  const searchParams = useSearchParams()
  const target = searchParams.get('target') || ''

  const [data, setData]       = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!target) {
      setError('Falta el parámetro ?target=')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await getScanTimeline(target)
      if (cancelled) return
      if (err) setError(err.error)
      else setData(data ?? null)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [target])

  const chartData = (data?.points ?? [])
    .filter(p => p.score !== null)
    .map(p => ({
      date: formatDate(p.startTime),
      score: p.score as number,
      grade: p.grade,
    }))

  const latest = data?.points[data.points.length - 1]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
          <Link
            href="/history"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al historial
          </Link>

          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-[var(--cyber-accent)]" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Evolución de seguridad</h1>
              <code className="font-mono text-xs text-muted-foreground">{target}</code>
            </div>
            {latest?.grade && <CyberBadge type="completed" label={`Actual: ${latest.grade}`} size="sm" />}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando evolución…
            </div>
          )}

          {!loading && error && (
            <EmptyState icon={AlertTriangle} title="No se pudo cargar la evolución" detail={error} />
          )}

          {!loading && !error && chartData.length < 2 && (
            <EmptyState
              icon={TrendingUp}
              title="Todavía no hay suficiente historial"
              detail="Necesitas al menos 2 escaneos completados de este mismo target (con score) para ver una tendencia."
            />
          )}

          {!loading && !error && chartData.length >= 2 && (
            <CyberPanel
              title="Score a través del tiempo"
              subtitle={`${chartData.length} escaneos completados de este target`}
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ left: -16, right: 8, top: 8 }}>
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
                        `${value}/100 (${entry.payload.grade})`, 'Score',
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
          )}
        </div>
      </main>
    </div>
  )
}
