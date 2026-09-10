'use client'
// components/cyber/SecurityMetrics.tsx — SecureScan Pro · Home v3
//
// Gráficos de severidad (donut) y por herramienta (barras), usando Recharts
// (ya presente en el proyecto — no se agregó ninguna librería de charting
// nueva). Las 5 categorías son las mismas de SeverityBreakdown real.

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { CyberPanel } from './CyberPanel'
import type { SeverityBreakdown } from '@/lib/api-client'

const SEVERITY_COLORS: Record<keyof SeverityBreakdown, string> = {
  critical: '#ef4444',
  high:     '#fb923c',
  medium:   '#f59e0b',
  low:      '#3b82f6',
  info:     '#64748b',
}

interface ToolFindingCount {
  tool: string
  findings: number
}

interface SecurityMetricsProps {
  breakdown: SeverityBreakdown
  byTool: ToolFindingCount[]
  className?: string
  /** Textos del panel de severidad — permite reutilizar este componente con
   * datos reales (Scanner) además de los mocks del Home. */
  severityTitle?: string
  severitySubtitle?: string
  toolTitle?: string
  toolSubtitle?: string
}

export function SecurityMetrics({
  breakdown,
  byTool,
  className,
  severityTitle = 'Vulnerabilities by Severity',
  severitySubtitle = 'Distribución acumulada · datos de ejemplo',
  toolTitle = 'Findings by Tool',
  toolSubtitle = 'Hallazgos por herramienta · datos de ejemplo',
}: SecurityMetricsProps) {
  const donutData = (Object.keys(breakdown) as (keyof SeverityBreakdown)[]).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: breakdown[key],
    color: SEVERITY_COLORS[key],
  }))

  return (
    <div className={className}>
      <div className="grid gap-5 lg:grid-cols-2">
        <CyberPanel title={severityTitle} subtitle={severitySubtitle}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="85%"
                  paddingAngle={2}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {donutData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </CyberPanel>

        <CyberPanel title={toolTitle} subtitle={toolSubtitle}>
          {byTool.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Sin hallazgos para graficar
            </div>
          ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTool} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="tool"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  width={84}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  cursor={{ fill: 'rgba(var(--cyber-accent-rgb), 0.06)' }}
                />
                <Bar dataKey="findings" fill="var(--cyber-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </CyberPanel>
      </div>
    </div>
  )
}
