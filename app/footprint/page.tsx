'use client'
// app/footprint/page.tsx — SecureScan Pro v5.0 · Huella Digital
//
// Experiencia INDEPENDIENTE de Huella Digital / superficie externa /
// Threat Intelligence. Comparte con /scanner el ScanProvider (app/layout.tsx)
// y el Design System, pero su jerarquía es propia: lanzador de fuentes →
// estado del análisis → superficie descubierta → paneles de inteligencia
// (Dominios, Infraestructura, Reputación, TLS/SSL) → cobertura y detalle por
// fuente. Solo muestra datos reales de `scan.threat_intel`; sin dato →
// "—" / estado vacío. No hay score: el Security Score del backend es de
// Pentesting y no usa Threat Intelligence.

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, ArrowRight, Fingerprint, History, Loader2, ScanSearch } from 'lucide-react'
import { Header } from '@/components/header'
import { ModuleHeader } from '@/components/cyber/ModuleHeader'
import { ToolTaxonomyStrip } from '@/components/cyber/ToolTaxonomyStrip'
import { CyberCard } from '@/components/cyber/CyberCard'
import { CyberBadge, type BadgeType } from '@/components/cyber/CyberBadge'
import { EmptyState } from '@/components/cyber/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FootprintForm } from '@/components/footprint/FootprintForm'
import { FootprintOverview } from '@/components/footprint/FootprintOverview'
import { FootprintSources } from '@/components/footprint/FootprintSources'
import { HUELLA_DIGITAL, COLOR_VARS } from '@/lib/nav-config'
import { useNavDescription } from '@/lib/nav-i18n'
import { useScan, type ScanResult } from '@/lib/scan-context'
import { getFootprintModel, getFootprintStepStatus, getScanScope } from '@/lib/scan-extractors'
import { cn } from '@/lib/utils'

const SCAN_BADGE: Record<string, BadgeType> = {
  pending: 'pending', running: 'running', completed: 'completed', error: 'error',
}

/** Análisis con datos de Huella Digital disponibles en el historial del backend. */
function hasFootprintPayload(scan: ScanResult): boolean {
  return Object.keys(scan.threat_intel ?? {}).length > 0
}

function FootprintContent() {
  const t = useTranslations('footprint')
  const locale = useLocale()
  const description = useNavDescription(HUELLA_DIGITAL)
  const { currentScan, scanHistory, refreshHistory, isScanning, error, clearError } = useScan()
  const c = COLOR_VARS[HUELLA_DIGITAL.color]

  const [historyId, setHistoryId] = useState<string | null>(null)

  // Al abrir el módulo se refresca el historial real (GET /api/history, ya existente)
  useEffect(() => { void refreshHistory() }, [refreshHistory])
  // Un análisis nuevo siempre pasa por delante de uno del historial seleccionado
  useEffect(() => { setHistoryId(null) }, [currentScan?.id])

  const recent = useMemo(
    () => scanHistory.filter(hasFootprintPayload).slice(0, 5),
    [scanHistory],
  )
  const historyScan = historyId ? scanHistory.find(h => h.id === historyId) ?? null : null
  const activeScan = historyScan ?? currentScan

  const model = useMemo(() => getFootprintModel(activeScan), [activeScan])
  const scope = useMemo(() => getScanScope(activeScan), [activeScan])
  const stepStatus = getFootprintStepStatus(activeScan)

  const isRunning = activeScan?.status === 'running' || activeScan?.status === 'pending'
  const footprintPending = isRunning && stepStatus !== 'completed' && stepStatus !== 'error'
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">

          <ModuleHeader section={HUELLA_DIGITAL} title={t('title')} description={description}>
            <ToolTaxonomyStrip sections={[HUELLA_DIGITAL]} />
          </ModuleHeader>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('errorTitle')}</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>{error}</span>
                <button type="button" onClick={clearError} className="shrink-0 rounded text-xs underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]">
                  {t('close')}
                </button>
              </AlertDescription>
            </Alert>
          )}

          <FootprintForm />

          {/* ── Análisis recientes con datos de Huella Digital (historial real) ── */}
          {recent.length > 0 && (
            <nav aria-label={t('recent.title')} className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <History aria-hidden="true" className="h-3 w-3" /> {t('recent.title')}
              </span>
              {recent.map(scan => {
                const active = activeScan?.id === scan.id
                return (
                  <button
                    key={scan.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setHistoryId(scan.id === currentScan?.id ? null : scan.id)}
                    className={cn(
                      'inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
                      active ? 'text-foreground' : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground',
                    )}
                    style={active ? { borderColor: `rgba(${c.rgb},0.55)`, background: `rgba(${c.rgb},0.10)` } : undefined}
                  >
                    <span className="truncate">{scan.target}</span>
                    <span className="hidden shrink-0 text-muted-foreground sm:inline">{fmt(scan.startTime)}</span>
                  </button>
                )
              })}
            </nav>
          )}

          {/* ── Sin análisis ── */}
          {!activeScan && !isScanning && (
            <CyberCard surface={1} padding="p-2">
              <EmptyState icon={ScanSearch} title={t('empty.title')} detail={t('empty.detail')} />
            </CyberCard>
          )}

          {!activeScan && isScanning && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground" role="status">
              <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" style={{ color: c.fg }} />
              <p className="font-mono text-sm">{t('starting')}</p>
            </div>
          )}

          {/* ── Análisis activo ── */}
          {activeScan && (
            <>
              {/* Estado del análisis */}
              <CyberCard surface={1} padding="p-4" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t('status.target')}</p>
                  <p className="truncate font-mono text-sm font-semibold text-foreground">{activeScan.target}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <CyberBadge type={SCAN_BADGE[activeScan.status] ?? 'idle'} label={t(`status.scan.${activeScan.status}`)} />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {t('status.footprintPhase')}: {t(`status.phase.${stepStatus}`)}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{fmt(activeScan.startTime)}</span>
                </div>
                <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-3 text-xs text-muted-foreground">
                  <span>{scope.pentesting ? t('status.originShared') : t('status.originFootprintOnly')}</span>
                  {scope.pentesting && (
                    <Link href="/scanner" className="inline-flex items-center gap-1 font-mono font-semibold text-[var(--cyber-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] rounded">
                      {t('status.viewPentesting')} <ArrowRight aria-hidden="true" className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </CyberCard>

              {/* Este análisis no incluyó Huella Digital */}
              {!scope.footprint && (
                <CyberCard surface={1} padding="p-2">
                  <EmptyState icon={Fingerprint} title={t('notIncluded.title')} detail={t('notIncluded.detail')} />
                </CyberCard>
              )}

              {/* Recolectando */}
              {scope.footprint && !model.hasAnyResult && footprintPending && (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground" role="status">
                  <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin" style={{ color: c.fg }} />
                  <p className="font-mono text-sm">{t('collecting')}</p>
                </div>
              )}

              {/* Terminó sin ningún resultado */}
              {scope.footprint && !model.hasAnyResult && !footprintPending && (
                <CyberCard surface={1} padding="p-2">
                  <EmptyState icon={Fingerprint} title={t('noResults.title')} detail={t('noResults.detail')} />
                </CyberCard>
              )}

              {model.hasAnyResult && (
                <>
                  {footprintPending && (
                    <p role="status" className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> {t('partial')}
                    </p>
                  )}
                  <FootprintOverview model={model} />
                  <FootprintSources model={model} target={activeScan.target} />
                </>
              )}
            </>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t border-[hsl(var(--border))] py-5">
        <div className="container mx-auto px-4 text-center font-mono text-xs text-muted-foreground">
          <p>{t('footerBrand')}</p>
          <p className="mt-0.5 opacity-50">{t('footerLegal')}</p>
        </div>
      </footer>
    </div>
  )
}

export default function FootprintPage() {
  return (
    <Suspense fallback={null}>
      <FootprintContent />
    </Suspense>
  )
}
