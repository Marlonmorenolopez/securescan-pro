'use client'
// components/footprint/FootprintOverview.tsx — SecureScan Pro v5.0
//
// Vista de HUELLA DIGITAL: superficie externa + 4 paneles de inteligencia
// (Dominios, Infraestructura, Reputación, TLS/SSL). Todo sale del modelo
// derivado en lib/scan-extractors.ts → getFootprintModel(), que a su vez lee
// `scan.threat_intel` (datos reales del backend). Reglas:
//   · simulated:true  → "sin datos reales" (nunca un 0)
//   · sin dato        → "—" o estado vacío explícito
//   · no se calcula ningún score: el Security Score del backend es de Pentesting
//     y no usa Threat Intelligence.

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import {
  Globe2, Network, ShieldAlert, Lock, ExternalLink, Layers, Server, Radar,
  BadgeAlert, CircleSlash, TriangleAlert, Hourglass,
} from 'lucide-react'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberBadge, type BadgeType } from '@/components/cyber/CyberBadge'
import { SeverityBars } from '@/components/cyber/SeverityBars'
import { EmptyState } from '@/components/cyber/EmptyState'
import {
  getTlsSeverityBreakdown,
  type FootprintModel, type FootprintSourceView, type SourceState,
} from '@/lib/scan-extractors'
import type { CrtShResult } from '@/components/results/intel/CrtShPanel'
import type { DnstwistResult } from '@/components/results/intel/DnstwistPanel'
import type { ShodanResult } from '@/components/results/intel/ShodanPanel'
import type { AbuseIPDBResult } from '@/components/results/intel/AbuseIPDBPanel'
import type { VirusTotalResult } from '@/components/results/intel/VirusTotalPanel'
import type { SafeBrowsingResult } from '@/components/results/intel/SafeBrowsingPanel'
import type { TestSSLResult } from '@/components/results/intel/TestSSLPanel'
import { COLOR_VARS } from '@/lib/nav-config'
import { cn } from '@/lib/utils'

// ─── Piezas compartidas ──────────────────────────────────────────────────────

const STATE_ICON: Record<SourceState, typeof CircleSlash> = {
  data: Layers, noData: CircleSlash, error: TriangleAlert, notRun: Hourglass,
}

/** Estado no-"data" de una fuente: dice CLARAMENTE por qué no hay dato. */
export function SourceStateNotice({ view, compact = false }: { view: FootprintSourceView; compact?: boolean }) {
  const t = useTranslations('footprint.state')
  const Icon = STATE_ICON[view.state]
  const tone =
    view.state === 'error' ? 'text-red-400' :
    view.state === 'noData' ? 'text-amber-400' : 'text-muted-foreground'
  return (
    <div className={cn('flex items-start gap-2 rounded-md border border-dashed border-[hsl(var(--border))] px-3 text-xs', compact ? 'py-2' : 'py-3')}>
      <Icon aria-hidden="true" className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', tone)} />
      <div className="min-w-0">
        <p className={cn('font-medium', tone)}>
          {view.skill.name} · {t(`${view.state}.title`)}
        </p>
        <p className="text-muted-foreground">{t(`${view.state}.detail`)}</p>
        {view.reason && <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground/80">{view.reason}</p>}
      </div>
    </div>
  )
}

/** Cifra grande; `null` = sin dato real → "—" (no 0). */
function Figure({ value, className }: { value: number | string | null; className?: string }) {
  const t = useTranslations('footprint.state')
  if (value === null) {
    return (
      <span className={className}>
        <span aria-hidden="true" className="text-muted-foreground/60">—</span>
        <span className="sr-only">{t('noValue')}</span>
      </span>
    )
  }
  return <span className={className}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
}

function Chip({ children, mono = true, tone = 'default' }: { children: ReactNode; mono?: boolean; tone?: 'default' | 'warn' | 'danger' }) {
  return (
    <span className={cn(
      'inline-flex max-w-full items-center break-all rounded border px-2 py-0.5 text-[11px]',
      mono && 'font-mono',
      tone === 'default' && 'border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 text-foreground/90',
      tone === 'warn' && 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      tone === 'danger' && 'border-red-500/40 bg-red-500/10 text-red-300',
    )}>{children}</span>
  )
}

function SubHeading({ icon: Icon, children, action }: { icon: typeof Globe2; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h4 className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon aria-hidden="true" className="h-3 w-3" /> {children}
      </h4>
      {action}
    </div>
  )
}

function ExtLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--cyber-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] rounded">
      {children} <ExternalLink aria-hidden="true" className="h-2.5 w-2.5" />
    </a>
  )
}

function Coverage({ withData, total }: { withData: number; total: number }) {
  const t = useTranslations('footprint')
  return (
    <span className="font-mono text-[10px] text-muted-foreground" title={t('coverageHint')}>
      {t('coverage', { withData, total })}
    </span>
  )
}

// ─── Superficie descubierta (KPIs) ───────────────────────────────────────────

function SurfaceMetric({ label, value, hint, icon: Icon }: {
  label: string; value: number | null; hint: string; icon: typeof Globe2
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:px-5">
      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon aria-hidden="true" className="h-3 w-3" /> {label}
      </span>
      <Figure value={value} className="font-mono text-3xl font-bold tabular-nums leading-none text-foreground" />
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </div>
  )
}

export function SurfaceSummary({ model }: { model: FootprintModel }) {
  const t = useTranslations('footprint.surface')
  const m = model.metrics
  const c = COLOR_VARS.emerald
  const risk = m.riskSignals

  return (
    <section aria-label={t('title')} className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
      <CyberCard surface={2} padding="p-0" brackets className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[hsl(var(--border))] px-4 py-2.5 sm:px-5">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: c.fg }}>{t('title')}</h2>
          <Coverage withData={model.withData} total={model.total} />
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-[hsl(var(--border))] sm:grid-cols-4 sm:divide-y-0">
          <SurfaceMetric icon={Globe2}   label={t('subdomains')} value={m.subdomains} hint={t('subdomainsHint')} />
          <SurfaceMetric icon={Server}   label={t('ips')}        value={m.ips ? m.ips.length : null} hint={t('ipsHint')} />
          <SurfaceMetric icon={Network}  label={t('ports')}      value={m.openPorts ? m.openPorts.length : null} hint={t('portsHint')} />
          <SurfaceMetric icon={BadgeAlert} label={t('lookalikes')} value={m.lookalikes} hint={t('lookalikesHint')} />
        </div>
      </CyberCard>

      <CyberCard
        surface={2}
        variant={risk === null ? 'default' : risk > 0 ? 'medium' : 'success'}
        padding="p-4 sm:p-5"
        className="flex flex-col justify-center gap-1"
      >
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <ShieldAlert aria-hidden="true" className="h-3 w-3" /> {t('riskSignals')}
        </span>
        <Figure value={risk} className="font-mono text-4xl font-bold tabular-nums leading-none text-foreground" />
        <span className="text-[11px] leading-snug text-muted-foreground">
          {risk === null ? t('riskSignalsNone') : t('riskSignalsHint')}
        </span>
      </CyberCard>
    </section>
  )
}

// ─── Domain Intelligence ─────────────────────────────────────────────────────

const LIST_LIMIT = 8

function DomainIntelligence({ model }: { model: FootprintModel }) {
  const t = useTranslations('footprint.domain')
  const crt = model.bySkill.crtsh
  const dns = model.bySkill.dnstwist
  const group = model.groups.find(g => g.key === 'dominios')

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}
      action={group && <Coverage withData={group.withData} total={group.total} />}>
      <div className="grid gap-5 md:grid-cols-2">
        {/* crt.sh */}
        <div className="min-w-0">
          <SubHeading icon={Globe2} action={crt.state === 'data' ? <ExtLink href={(crt.raw as CrtShResult).permalink}>crt.sh</ExtLink> : undefined}>
            {t('subdomains')}
          </SubHeading>
          {crt.state === 'data' ? (() => {
            const d = crt.raw as CrtShResult
            return d.subdomains.length === 0 ? (
              <EmptyState icon={Globe2} size="compact" title={t('noSubdomains')} />
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('subdomainsSummary', { subdomains: d.subdomains.length, certificates: d.certificate_count })}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {d.subdomains.slice(0, LIST_LIMIT).map(s => <li key={s}><Chip>{s}</Chip></li>)}
                </ul>
                {d.subdomains.length > LIST_LIMIT && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{t('moreInDetail', { count: d.subdomains.length - LIST_LIMIT })}</p>
                )}
              </>
            )
          })() : <SourceStateNotice view={crt} />}
        </div>

        {/* dnstwist */}
        <div className="min-w-0">
          <SubHeading icon={BadgeAlert}>{t('lookalikes')}</SubHeading>
          {dns.state === 'data' ? (() => {
            const d = dns.raw as DnstwistResult
            return d.registered_variants.length === 0 ? (
              <EmptyState icon={BadgeAlert} size="compact"
                title={t('noLookalikes')} detail={t('candidatesChecked', { count: d.candidates_checked })} />
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t('lookalikesSummary', { registered: d.registered_variants.length, checked: d.candidates_checked })}
                </p>
                <ul className="space-y-1">
                  {d.registered_variants.slice(0, LIST_LIMIT).map(v => (
                    <li key={v.domain} className="flex items-center justify-between gap-2 rounded border border-[hsl(var(--border))] px-2 py-1">
                      <span className="min-w-0 break-all font-mono text-[11px] text-foreground/90">{v.domain}</span>
                      {v.ip && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{v.ip}</span>}
                    </li>
                  ))}
                </ul>
                {d.registered_variants.length > LIST_LIMIT && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{t('moreInDetail', { count: d.registered_variants.length - LIST_LIMIT })}</p>
                )}
              </>
            )
          })() : <SourceStateNotice view={dns} />}
        </div>
      </div>
    </CyberPanel>
  )
}

// ─── Infrastructure Intelligence ─────────────────────────────────────────────

function InfrastructureIntelligence({ model }: { model: FootprintModel }) {
  const t = useTranslations('footprint.infra')
  const sho = model.bySkill.shodan
  const abu = model.bySkill.abuseipdb
  const group = model.groups.find(g => g.key === 'infraestructura')

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}
      action={group && <Coverage withData={group.withData} total={group.total} />}>
      {sho.state !== 'data' ? <SourceStateNotice view={sho} /> : (() => {
        const d = sho.raw as ShodanResult
        const risky = new Set(['compromised', 'malware', 'honeypot', 'tor'])
        return (
          <div className="space-y-4">
            <div>
              <SubHeading icon={Server} action={<ExtLink href={d.permalink}>Shodan</ExtLink>}>{t('addresses')}</SubHeading>
              <div className="flex flex-wrap gap-1.5">
                <Chip>{d.ip}</Chip>
                {d.hostnames.slice(0, 6).map(h => <Chip key={h}>{h}</Chip>)}
              </div>
              {d.hostnames.length > 6 && <p className="mt-1 text-[11px] text-muted-foreground">{t('moreHostnames', { count: d.hostnames.length - 6 })}</p>}
            </div>

            <div>
              <SubHeading icon={Network}>{t('ports')} ({d.ports.length})</SubHeading>
              {d.ports.length === 0
                ? <p className="text-xs text-muted-foreground">{t('noPorts')}</p>
                : <div className="flex flex-wrap gap-1.5">{d.ports.slice(0, 20).map(p => <Chip key={p}>{p}</Chip>)}</div>}
            </div>

            <div>
              <SubHeading icon={BadgeAlert}>{t('cves')} ({d.vulns.length})</SubHeading>
              {d.vulns.length === 0 ? <p className="text-xs text-muted-foreground">{t('noCves')}</p> : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {d.vulns.slice(0, 8).map(v => (
                      <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noopener noreferrer"
                        className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]">
                        <Chip tone="danger">{v}</Chip>
                      </a>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{t('cvesCaveat')}</p>
                </>
              )}
            </div>

            {d.tags.length > 0 && (
              <div>
                <SubHeading icon={Layers}>{t('tags')}</SubHeading>
                <div className="flex flex-wrap gap-1.5">
                  {d.tags.map(tag => <Chip key={tag} tone={risky.has(tag.toLowerCase()) ? 'warn' : 'default'}>{tag}</Chip>)}
                </div>
              </div>
            )}

            {/* Contexto de red aportado por AbuseIPDB (país / ISP / tipo de uso) */}
            {abu.state === 'data' && (() => {
              const a = abu.raw as AbuseIPDBResult
              const rows: [string, string | null][] = [[t('country'), a.country_code], [t('isp'), a.isp], [t('usageType'), a.usage_type]]
              if (rows.every(([, v]) => !v)) return null
              return (
                <div>
                  <SubHeading icon={Radar}>{t('networkContext')}</SubHeading>
                  <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                    {rows.filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="min-w-0"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="break-words font-mono text-foreground/90">{v}</dd></div>
                    ))}
                  </dl>
                </div>
              )
            })()}
          </div>
        )
      })()}
    </CyberPanel>
  )
}

// ─── Reputation Intelligence ─────────────────────────────────────────────────

function ReputationRow({ name, badge, badgeLabel, children }: { name: string; badge: BadgeType; badgeLabel: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-[hsl(var(--border))] p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-mono text-xs font-semibold text-foreground">{name}</h4>
        <CyberBadge type={badge} size="sm" label={badgeLabel} />
      </div>
      {children}
    </div>
  )
}

function ReputationIntelligence({ model }: { model: FootprintModel }) {
  const t = useTranslations('footprint.reputation')
  const vt = model.bySkill.virustotal
  const abu = model.bySkill.abuseipdb
  const sb = model.bySkill.safebrowsing
  const group = model.groups.find(g => g.key === 'reputacion')

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}
      action={group && <Coverage withData={group.withData} total={group.total} />}>
      <div className="space-y-3">
        {/* VirusTotal */}
        {vt.state !== 'data' ? <SourceStateNotice view={vt} compact /> : (() => {
          const d = vt.raw as VirusTotalResult
          const flagged = d.malicious + d.suspicious
          const total = d.malicious + d.suspicious + d.harmless + d.undetected
          const seg = (n: number) => (total > 0 ? `${(n / total) * 100}%` : '0%')
          return (
            <ReputationRow name="VirusTotal" badge={flagged > 0 ? (d.malicious > 0 ? 'critical' : 'medium') : 'completed'}
              badgeLabel={flagged > 0 ? t('vtFlagged', { count: flagged }) : t('vtClean')}>
              {total > 0 && (
                <div role="img" aria-label={t('vtBreakdown', { malicious: d.malicious, suspicious: d.suspicious, harmless: d.harmless, undetected: d.undetected })}
                  className="flex h-2 overflow-hidden rounded-full bg-muted/30">
                  <span className="bg-red-500" style={{ width: seg(d.malicious) }} />
                  <span className="bg-amber-500" style={{ width: seg(d.suspicious) }} />
                  <span className="bg-emerald-500/70" style={{ width: seg(d.harmless) }} />
                  <span className="bg-slate-500/60" style={{ width: seg(d.undetected) }} />
                </div>
              )}
              <p className="font-mono text-[11px] text-muted-foreground">
                {t('vtBreakdown', { malicious: d.malicious, suspicious: d.suspicious, harmless: d.harmless, undetected: d.undetected })}
              </p>
              <ExtLink href={d.permalink}>VirusTotal</ExtLink>
            </ReputationRow>
          )
        })()}

        {/* AbuseIPDB */}
        {abu.state !== 'data' ? <SourceStateNotice view={abu} compact /> : (() => {
          const d = abu.raw as AbuseIPDBResult
          const score = d.abuse_confidence_score
          const badge: BadgeType = score >= 75 ? 'critical' : score >= 25 ? 'medium' : 'completed'
          const bar = score >= 75 ? 'bg-red-500' : score >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
          return (
            <ReputationRow name="AbuseIPDB" badge={badge} badgeLabel={t('abuseScore', { score })}>
              <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={t('abuseScoreLabel')}
                className="h-2 overflow-hidden rounded-full bg-muted/30">
                <div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.min(100, Math.max(score, score > 0 ? 3 : 0))}%` }} />
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                {t('abuseReports', { reports: d.total_reports, users: d.num_distinct_users })}
              </p>
              <ExtLink href={d.permalink}>AbuseIPDB</ExtLink>
            </ReputationRow>
          )
        })()}

        {/* Safe Browsing */}
        {sb.state !== 'data' ? <SourceStateNotice view={sb} compact /> : (() => {
          const d = sb.raw as SafeBrowsingResult
          return (
            <ReputationRow name="Google Safe Browsing" badge={d.flagged ? 'critical' : 'completed'}
              badgeLabel={d.flagged ? t('sbFlagged') : t('sbClean')}>
              {d.flagged && d.threats.length > 0 && (
                <div className="flex flex-wrap gap-1.5">{d.threats.map(th => <Chip key={th} tone="danger">{th}</Chip>)}</div>
              )}
              {!d.flagged && <p className="text-[11px] text-muted-foreground">{t('sbCleanHint')}</p>}
            </ReputationRow>
          )
        })()}
      </div>
    </CyberPanel>
  )
}

// ─── TLS Intelligence ────────────────────────────────────────────────────────

const CERT_FIELDS = ['cert_commonName', 'cert_expirationStatus', 'cert_notAfter', 'cert_keySize', 'cert_signatureAlgorithm', 'cert_chain_of_trust'] as const

const FINDING_BADGE: Record<string, BadgeType> = {
  CRITICAL: 'critical', FATAL: 'critical', HIGH: 'high', MEDIUM: 'medium', WARN: 'medium',
  LOW: 'low', OK: 'completed', INFO: 'info', DEBUG: 'info',
}

function TlsIntelligence({ model }: { model: FootprintModel }) {
  const t = useTranslations('footprint.tls')
  const ts = model.bySkill.testssl
  const group = model.groups.find(g => g.key === 'tlsSsl')

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}
      action={group && <Coverage withData={group.withData} total={group.total} />}>
      {ts.state !== 'data' ? <SourceStateNotice view={ts} /> : (() => {
        const d = ts.raw as TestSSLResult
        const breakdown = getTlsSeverityBreakdown(d)
        const certRows = CERT_FIELDS
          .map(id => [id, d.server_defaults.find(f => f.id === id)] as const)
          .filter(([, f]) => !!f)
        return (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <div>
                <SubHeading icon={Lock}>{t('protocols')}</SubHeading>
                {d.protocols.length === 0 ? <p className="text-xs text-muted-foreground">{t('noProtocols')}</p> : (
                  <ul className="space-y-1">
                    {d.protocols.map(p => (
                      <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-[hsl(var(--border))] px-2 py-1">
                        <span className="min-w-0 truncate font-mono text-[11px] text-foreground/90" title={p.finding}>{p.id}</span>
                        <CyberBadge type={FINDING_BADGE[p.severity] ?? 'info'} size="sm" label={p.finding} className="max-w-[60%] truncate" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <SubHeading icon={ShieldAlert}>{t('warningsBySeverity')}</SubHeading>
                <SeverityBars breakdown={breakdown} />
                <p className="mt-1 text-[11px] text-muted-foreground">{t('warningsCaveat')}</p>
              </div>
            </div>

            <div className="min-w-0">
              <SubHeading icon={Layers}>{t('certificate')}</SubHeading>
              {certRows.length === 0 ? <p className="text-xs text-muted-foreground">{t('noCertificate')}</p> : (
                <dl className="space-y-2">
                  {certRows.map(([id, f]) => (
                    <div key={id} className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t(`cert.${id}`)}</dt>
                      <dd className="break-words font-mono text-xs text-foreground/90">{f!.finding}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        )
      })()}
    </CyberPanel>
  )
}

// ─── Composición ─────────────────────────────────────────────────────────────
// Jerarquía deliberadamente asimétrica (no una rejilla de tarjetas iguales):
//   Superficie (banda ancha) → Dominios 7/12 + Infraestructura 5/12
//                            → Reputación 5/12 + TLS 7/12

export function FootprintOverview({ model }: { model: FootprintModel }) {
  return (
    <div className="space-y-6">
      <SurfaceSummary model={model} />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7"><DomainIntelligence model={model} /></div>
        <div className="lg:col-span-5"><InfrastructureIntelligence model={model} /></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5"><ReputationIntelligence model={model} /></div>
        <div className="lg:col-span-7"><TlsIntelligence model={model} /></div>
      </div>
    </div>
  )
}
