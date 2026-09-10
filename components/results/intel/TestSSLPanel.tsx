'use client'
// components/results/intel/TestSSLPanel.tsx — SecureScan Pro v5.1
// Panel de testssl.sh REAL — protocolos, vulnerabilidades con nombre
// propio (Heartbleed, POODLE, etc.) y certificado. Reemplaza al panel
// del equivalente ligero anterior (forma de datos distinta).

import { useState } from 'react'
import { Lock, ChevronDown, ShieldAlert, ExternalLink } from 'lucide-react'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { cn } from '@/lib/utils'

export interface TestSSLFinding {
  id: string
  severity: string
  finding: string
  cve: string | null
  cwe: string | null
}

export interface TestSSLResult {
  host: string
  port: number
  available: boolean
  simulated: boolean
  tls_enabled: boolean
  protocols: TestSSLFinding[]
  vulnerabilities: TestSSLFinding[]
  server_defaults: TestSSLFinding[]
  warnings: string[]
  scan_time: number | null
  error: string | null
}

interface TestSSLPanelProps {
  data?: TestSSLResult
}

const SEVERITY_BADGE: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info' | 'completed'> = {
  CRITICAL: 'critical', FATAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium', WARN: 'medium',
  LOW: 'low',
  OK: 'completed',
  INFO: 'info', DEBUG: 'info',
}

const CERT_FIELD_LABELS: Record<string, string> = {
  cert_commonName: 'Subject',
  cert_chain_of_trust: 'Cadena de confianza',
  cert_expirationStatus: 'Vencimiento',
  cert_notAfter: 'Vence',
  cert_subjectAltName: 'SAN',
  cert_keySize: 'Tamaño de llave',
  cert_signatureAlgorithm: 'Algoritmo de firma',
  cert_revocation: 'Revocación (CRL/OCSP)',
}

function findingBadge(severity: string) {
  return SEVERITY_BADGE[severity] ?? 'info'
}

export function TestSSLPanel({ data }: TestSSLPanelProps) {
  const [showAllVulns, setShowAllVulns] = useState(false)
  const [showAllCert, setShowAllCert] = useState(false)

  if (!data) {
    return (
      <div className="space-y-3 py-10 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground/30" />
        <p className="font-medium text-muted-foreground">TestSSL aún no tiene resultados</p>
      </div>
    )
  }

  if (!data.tls_enabled) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CyberBadge type="info" size="sm" label="Sin TLS en este puerto" />
          <span className="font-mono text-[11px] text-muted-foreground">{data.host}:{data.port}</span>
        </div>
        <p className="text-xs text-muted-foreground">{data.error || 'El objetivo no respondió a un handshake TLS en este puerto.'}</p>
      </div>
    )
  }

  // Solo lo que no es OK/INFO cuenta como hallazgo real de vulnerabilidad
  const realVulns = data.vulnerabilities.filter((v) => !['OK', 'INFO', 'DEBUG'].includes(v.severity))
  const vulnsToShow = showAllVulns ? data.vulnerabilities : realVulns
  const worstSeverity = realVulns.some((v) => ['CRITICAL', 'FATAL'].includes(v.severity)) ? 'critical'
    : realVulns.some((v) => v.severity === 'HIGH') ? 'high'
    : realVulns.length > 0 ? 'medium' : null

  const certFindings = data.server_defaults.filter((f) => f.id.startsWith('cert_') || f.id === 'OCSP_stapling')
  const keyCertFindings = certFindings.filter((f) => f.id in CERT_FIELD_LABELS)
  const certToShow = showAllCert ? certFindings : keyCertFindings

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {worstSeverity ? (
          <CyberBadge type={worstSeverity} size="sm" label={`${realVulns.length} hallazgo(s) de vulnerabilidad`} />
        ) : (
          <CyberBadge type="completed" size="sm" label="Sin vulnerabilidades con nombre detectadas" />
        )}
        <span className="font-mono text-[11px] text-muted-foreground">
          {data.host}:{data.port} · {data.vulnerabilities.length} chequeos · {data.scan_time}s
        </span>
      </div>

      {data.error && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-400">{data.error}</p>
      )}

      {/* Protocolos */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {data.protocols.filter((p) => ['SSLv2', 'SSLv3', 'TLS1', 'TLS1_1', 'TLS1_2', 'TLS1_3'].includes(p.id)).map((p) => (
          <CyberCard key={p.id} padding="p-2">
            <div className="font-mono text-[10px] text-muted-foreground">{p.id.replace('TLS1_', 'TLS 1.').replace('TLS1', 'TLS 1.0').replace('SSLv', 'SSL v')}</div>
            <div className={cn(
              'mt-0.5 font-mono text-xs font-semibold',
              p.finding.includes('not offered') ? 'text-muted-foreground' : 'text-emerald-400',
            )}>
              {p.finding.includes('not offered') ? 'No' : 'Sí'}
            </div>
          </CyberCard>
        ))}
      </div>

      {/* Vulnerabilidades con nombre propio */}
      <div>
        <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Vulnerabilidades ({realVulns.length} de {data.vulnerabilities.length} con hallazgo)
        </h4>
        {vulnsToShow.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ninguna de las vulnerabilidades con nombre propio (Heartbleed, POODLE, FREAK, DROWN...) aplica a este servidor.</p>
        ) : (
          <div className="space-y-1.5">
            {vulnsToShow.map((v) => (
              <div key={v.id} className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                v.severity === 'OK' || v.severity === 'INFO'
                  ? 'border-[hsl(var(--border))]'
                  : 'border-red-500/30 bg-red-500/[0.04]',
              )}>
                <ShieldAlert className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', v.severity === 'OK' ? 'text-emerald-400' : 'text-red-400')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CyberBadge type={findingBadge(v.severity)} size="sm" />
                    <span className="font-mono text-xs font-medium text-foreground">{v.id}</span>
                    {v.cve && (
                      <a
                        href={`https://nvd.nist.gov/vuln/detail/${v.cve.split(' ')[0]}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 font-mono text-[10px] text-[var(--cyber-accent)] hover:underline"
                      >
                        {v.cve.split(' ')[0]} <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{v.finding}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {!showAllVulns && data.vulnerabilities.length > realVulns.length && (
          <button onClick={() => setShowAllVulns(true)} className="mt-1.5 flex items-center gap-1 font-mono text-xs text-[var(--cyber-accent)] hover:underline">
            <ChevronDown className="h-3 w-3" /> Ver los {data.vulnerabilities.length - realVulns.length} chequeos sin hallazgo
          </button>
        )}
      </div>

      {/* Certificado */}
      {certFindings.length > 0 && (
        <div>
          <h4 className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">Certificado</h4>
          <div className="space-y-1 rounded-lg border border-[hsl(var(--border))] p-2">
            {certToShow.map((f) => (
              <div key={f.id} className="flex justify-between gap-2 px-2 py-1 font-mono text-xs">
                <span className="text-muted-foreground">{CERT_FIELD_LABELS[f.id] ?? f.id}:</span>
                <span className={cn('truncate text-right', ['HIGH', 'CRITICAL', 'FATAL'].includes(f.severity) ? 'text-red-400' : 'text-foreground')}>
                  {f.finding.length > 60 ? f.finding.slice(0, 60) + '…' : f.finding}
                </span>
              </div>
            ))}
          </div>
          {!showAllCert && certFindings.length > keyCertFindings.length && (
            <button onClick={() => setShowAllCert(true)} className="mt-1.5 flex items-center gap-1 font-mono text-xs text-[var(--cyber-accent)] hover:underline">
              <ChevronDown className="h-3 w-3" /> Ver los {certFindings.length - keyCertFindings.length} campos más del certificado
            </button>
          )}
        </div>
      )}
    </div>
  )
}
