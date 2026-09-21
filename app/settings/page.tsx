'use client'
// app/settings/page.tsx — SecureScan Pro v5.0 · Configuración general
//
// Pantalla DISTINTA de Notificaciones (/settings/notifications). Solo contiene
// configuración y estado REALES que ya existen:
//   · Interfaz: idioma (cookie NEXT_LOCALE, mismo mecanismo que el header) y
//     tema (next-themes). Son preferencias locales del navegador y funcionan.
//   · Servidor: GET /api/config y GET /api/health, en SOLO LECTURA. Esos valores
//     los define el backend por variables de entorno; aquí no se pueden editar
//     y no se simula ningún control que no exista.
//   · Accesos a otras pantallas reales (Notificaciones, Escaneos programados, Docs).

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'
import {
  Sliders, Languages, SunMoon, Sun, Moon, Monitor, Server, RefreshCw, Bell,
  CalendarClock, BookOpen, ArrowRight, Lock, Database, Loader2,
} from 'lucide-react'
import { Header } from '@/components/header'
import { LanguageSwitcher } from '@/components/language-switcher'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { CyberBadge } from '@/components/cyber/CyberBadge'
import { CyberButton } from '@/components/cyber/CyberButton'
import { EmptyState } from '@/components/cyber/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getConfig, getHealth } from '@/lib/api-client'
import type { ConfigResponse, HealthResponse } from '@/lib/api-client'
import { cn } from '@/lib/utils'

// ─── Piezas ──────────────────────────────────────────────────────────────────

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0 max-w-full">{children}</div>
    </div>
  )
}

function Chips({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">{empty}</span>
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {items.map(i => (
        <span key={i} className="break-all rounded border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 px-2 py-0.5 font-mono text-[11px] text-foreground/90">{i}</span>
      ))}
    </div>
  )
}

const THEMES = [
  { id: 'light',  icon: Sun },
  { id: 'dark',   icon: Moon },
  { id: 'system', icon: Monitor },
] as const

function InterfaceSection() {
  const t = useTranslations('settingsPage.interface')
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}>
      <Row label={t('language')} hint={t('languageHint')}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{t(`languageName.${locale === 'en' ? 'en' : 'es'}`)}</span>
          <LanguageSwitcher />
        </div>
      </Row>
      <Row label={t('theme')} hint={t('themeHint')}>
        <div role="group" aria-label={t('theme')} className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] p-1">
          {THEMES.map(({ id, icon: Icon }) => {
            const active = mounted && theme === id
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setTheme(id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
                  active
                    ? 'bg-[rgba(var(--cyber-accent-rgb),0.14)] text-[var(--cyber-accent)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {t(`themeOption.${id}`)}
              </button>
            )
          })}
        </div>
      </Row>
    </CyberPanel>
  )
}

function ServerSection() {
  const t = useTranslations('settingsPage.server')
  const [config, setConfig] = useState<ConfigResponse | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    const [cfg, hl] = await Promise.all([getConfig(), getHealth()])
    setConfig(cfg.data ?? null)
    setHealth(hl.data ?? null)
    setFailed(!cfg.data && !hl.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const refresh = (
    <CyberButton variant="outline" size="sm" onClick={load} disabled={loading}
      icon={loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}>
      {t('refresh')}
    </CyberButton>
  )

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')} action={refresh}>
      <p className="mb-3 flex items-start gap-2 rounded-md border border-[hsl(var(--border))] px-3 py-2 text-xs text-muted-foreground">
        <Lock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('readOnlyNote')}
      </p>

      {loading && !config && !health && (
        <div role="status" aria-live="polite" className="space-y-2">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />)}
          <span className="sr-only">{t('loading')}</span>
        </div>
      )}

      {failed && !loading && (
        <Alert variant="destructive">
          <AlertTitle>{t('unreachableTitle')}</AlertTitle>
          <AlertDescription>{t('unreachableDetail')}</AlertDescription>
        </Alert>
      )}

      {(config || health) && (
        <div>
          {health && (
            <>
              <Row label={t('status')}>
                <CyberBadge type={health.status === 'healthy' || health.status === 'ok' ? 'completed' : 'pending'} label={health.status} />
              </Row>
              <Row label={t('storage')} hint={t('storageHint')}>
                <span className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                  <Database aria-hidden="true" className="h-3.5 w-3.5" />
                  {t(health.storage === 'connected' ? 'storageRedis' : 'storageFallback')}
                </span>
              </Row>
              <Row label={t('zap')} hint={t('zapHint')}>
                <CyberBadge type={health.zap_configured ? 'completed' : 'idle'} label={health.zap_configured ? t('configured') : t('notConfigured')} />
              </Row>
            </>
          )}
          {config && (
            <>
              <Row label={t('version')}><span className="font-mono text-xs text-foreground">{config.version}</span></Row>
              <Row label={t('labRestriction')} hint={t('labRestrictionHint')}>
                {config.restrict_to_lab === undefined
                  ? <span className="text-xs text-muted-foreground">{t('unknown')}</span>
                  : <CyberBadge type={config.restrict_to_lab ? 'pending' : 'idle'} label={config.restrict_to_lab ? t('enabled') : t('disabled')} />}
              </Row>
              <Row label={t('allowedTargets')} hint={t('allowedTargetsHint')}>
                <Chips items={config.allowed_targets ?? []} empty={t('none')} />
              </Row>
              <Row label={t('reportFormats')}>
                <Chips items={config.report_formats ?? []} empty={t('none')} />
              </Row>
              {config.metasploit && (
                <Row label={t('metasploit')} hint={t('metasploitHint')}>
                  <span className="font-mono text-xs text-foreground">
                    {t(config.metasploit.mode === 'live' ? 'metasploitLive' : 'metasploitSimulation')} · {config.metasploit.host}:{config.metasploit.port}
                  </span>
                </Row>
              )}
              <Row label={t('availableTools')} hint={t('availableToolsHint')}>
                <span className="font-mono text-xs text-foreground">{(config.available_tools ?? []).length}</span>
              </Row>
            </>
          )}
        </div>
      )}

      {!loading && !failed && !config && !health && (
        <EmptyState icon={Server} size="compact" title={t('empty')} />
      )}
    </CyberPanel>
  )
}

const RELATED = [
  { id: 'notifications', href: '/settings/notifications', icon: Bell },
  { id: 'schedules',     href: '/schedules',              icon: CalendarClock },
  { id: 'docs',          href: '/docs',                   icon: BookOpen },
] as const

function RelatedSection() {
  const t = useTranslations('settingsPage.related')
  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}>
      <ul className="grid gap-3 sm:grid-cols-3">
        {RELATED.map(({ id, href, icon: Icon }) => (
          <li key={id}>
            <Link
              href={href}
              className={cn(
                'group flex h-full flex-col gap-1.5 rounded-lg border border-[hsl(var(--border))] p-3 transition-colors',
                'hover:border-[rgba(var(--cyber-accent-rgb),0.35)] hover:bg-[rgba(var(--cyber-accent-rgb),0.04)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon aria-hidden="true" className="h-4 w-4 text-[var(--cyber-accent)]" /> {t(`${id}.title`)}
                <ArrowRight aria-hidden="true" className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="text-xs text-muted-foreground">{t(`${id}.detail`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </CyberPanel>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useTranslations('settingsPage')
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 py-10">
        <div className="container mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
          <header className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[rgba(var(--cyber-accent-rgb),0.35)] bg-[rgba(var(--cyber-accent-rgb),0.08)] text-[var(--cyber-accent)]">
              <Sliders aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-h1 text-foreground">{t('title')}</h1>
              <p className="text-body mt-1 max-w-2xl text-muted-foreground">{t('description')}</p>
            </div>
          </header>

          <InterfaceSection />
          <ServerSection />
          <RelatedSection />
        </div>
      </main>
    </div>
  )
}
