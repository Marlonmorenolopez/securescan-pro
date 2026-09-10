'use client'
// components/cyber/SecurityOverview.tsx — SecureScan Pro · Home v3
//
// Fila de 4 KPIs estilo "SOC dashboard": Average Grade (gauge), Vulnerabilities
// Found, Scans Completed, Risk Level.
//
// FUENTE DE DATOS: recibe un objeto con la forma de SecurityOverviewMock
// (lib/home-mock-data.ts), que ya respeta los tipos reales (SecurityScore,
// SeverityBreakdown). Para conectar datos reales basta con calcular este
// mismo shape a partir de getScanHistory().scans — el componente no cambia.

import { ShieldCheck, Bug, ScanSearch, Gauge } from 'lucide-react'
import { CyberCard } from './CyberCard'
import { RiskGauge } from './RiskGauge'
import { CyberStat } from './CyberStat'
import type { SecurityOverviewMock } from '@/lib/home-mock-data'

interface SecurityOverviewProps {
  data: SecurityOverviewMock
  className?: string
}

export function SecurityOverview({ data, className }: SecurityOverviewProps) {
  return (
    <div className={className}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Risk score — gauge circular, mismo cálculo que el Scanner real */}
        <CyberCard glow className="flex flex-col items-center justify-center gap-3 py-6">
          <div className="flex items-center gap-1.5 self-start font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <Gauge className="h-3 w-3" />
            Average Security Grade
          </div>
          <RiskGauge total={data.averageScore} grade={data.averageGrade} size={104} strokeWidth={8} />
        </CyberCard>

        <CyberCard glow className="flex flex-col justify-center gap-2">
          <CyberStat
            label="Vulnerabilities Found"
            value={data.totalVulnerabilities}
            color="red"
            icon={Bug}
            pulse
          />
        </CyberCard>

        <CyberCard glow className="flex flex-col justify-center gap-2">
          <CyberStat
            label="Scans Completed"
            value={data.totalScans}
            color="cyber"
            icon={ScanSearch}
          />
        </CyberCard>

        <CyberCard glow className="flex flex-col justify-center gap-2">
          <CyberStat
            label={`Risk Level: ${data.riskLevel}`}
            value={data.breakdown.critical + data.breakdown.high}
            suffix=" críticas/altas"
            color={data.riskLevel === 'CRITICAL' || data.riskLevel === 'HIGH' ? 'red' : 'amber'}
            icon={ShieldCheck}
          />
        </CyberCard>
      </div>
    </div>
  )
}
