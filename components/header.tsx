'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Github, Moon, Sun, Bell, Search, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/language-switcher'
import { getHealth } from '@/lib/api-client'
import {
  ALL_SECTIONS, TOP_LEAVES, OPERATIONS_LEAVES, ANALYSIS_LEAVES, DOCS_LEAF, COLOR_VARS,
} from '@/lib/nav-config'

type SystemStatus = 'checking' | 'online' | 'offline'

/**
 * Indicador "Sistema: Online/Offline" — polling silencioso contra
 * /api/health (vía getHealth(), timeout corto, sin reintentos).
 * No bloquea ni afecta el resto del Header si el backend está caído.
 */
function SystemStatusIndicator() {
  const t = useTranslations('nav')
  const [status, setStatus] = useState<SystemStatus>('checking')

  useEffect(() => {
    let active = true

    const check = async () => {
      const res = await getHealth()
      if (!active) return
      setStatus(res.data?.status === 'healthy' ? 'online' : 'offline')
    }

    check()
    const id = setInterval(check, 15000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const config: Record<SystemStatus, { label: string; dot: string; text: string }> = {
    checking: { label: t('systemChecking'), dot: 'h-1.5 w-1.5 rounded-full bg-muted-foreground/50',          text: 'text-muted-foreground' },
    online:   { label: t('systemOnline'),   dot: 'status-dot bg-emerald-400',                                 text: 'text-emerald-400'      },
    offline:  { label: t('systemOffline'),  dot: 'h-1.5 w-1.5 rounded-full bg-red-400',                       text: 'text-red-400'          },
  }
  const cfg = config[status]

  return (
    <span
      className="hidden items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-2.5 py-1 lg:flex"
      title={t('systemTooltip')}
    >
      <span className={cfg.dot} />
      <span className={cn('font-mono text-[10px] uppercase tracking-wider', cfg.text)}>
        {cfg.label}
      </span>
    </span>
  )
}

// Índice de búsqueda plano, construido a partir del catálogo único de
// navegación (lib/nav-config.tsx). Búsqueda 100% cliente sobre rutas
// existentes — no se inventa ninguna capacidad de backend.
interface SearchEntry { label: string; sub?: string; href: string; color: keyof typeof COLOR_VARS }

function buildSearchIndex(
  tLeaves: (key: string) => string,
  tSections: (key: string) => string,
): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const leaf of [...TOP_LEAVES, ...OPERATIONS_LEAVES, ...ANALYSIS_LEAVES, DOCS_LEAF]) {
    entries.push({ label: tLeaves(leaf.id), href: leaf.href, color: 'cyan' })
  }
  for (const section of ALL_SECTIONS) {
    const sectionLabel = tSections(`${section.id}.label`)
    entries.push({ label: sectionLabel, href: section.href, color: section.color })
    for (const group of section.groups) {
      const groupLabel = tSections(`${section.id}.groups.${group.key}`)
      for (const tool of group.tools) {
        entries.push({ label: tool, sub: `${sectionLabel} · ${groupLabel}`, href: section.href, color: section.color })
      }
    }
  }
  return entries
}

function QuickSearch() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const boxRef = useRef<HTMLDivElement>(null)
  const tLeaves = useTranslations('navCatalog.leaves')
  const tSections = useTranslations('navCatalog.sections')
  const tNav = useTranslations('nav')
  const index = useMemo(() => buildSearchIndex(tLeaves, tSections), [tLeaves, tSections])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return index
      .filter((e) => e.label.toLowerCase().includes(q) || e.sub?.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, index])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function go(href: string) {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  return (
    <div ref={boxRef} className="relative hidden flex-1 max-w-md md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].href) }}
        placeholder={tNav('searchPlaceholder')}
        className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50 pl-9 pr-8 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-[rgba(var(--cyber-accent-rgb),0.45)] focus:outline-none"
      />
      {query && (
        <button
          onClick={() => { setQuery(''); setOpen(false) }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-80 overflow-y-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] p-1.5 shadow-2xl">
          {results.map((r, i) => {
            const c = COLOR_VARS[r.color]
            return (
              <button
                key={`${r.href}-${r.label}-${i}`}
                onClick={() => go(r.href)}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs hover:bg-[rgba(var(--cyber-accent-rgb),0.08)]"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{r.label}</span>
                  {r.sub && <span className="text-[10px] text-muted-foreground">{r.sub}</span>}
                </span>
                <span
                  className="shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                  style={{ color: c.fg, borderColor: `rgba(${c.rgb},0.35)` }}
                >
                  {r.href}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface HeaderProps {}

export function Header({}: HeaderProps) {
  const t = useTranslations('nav')
  const [mounted, setMounted] = useState(false)
  const { setTheme, resolvedTheme } = useTheme()

  // CRÍTICO: sin este guard, next-themes causa hydration mismatch
  // y el toggle queda congelado o muestra el ícono equivocado
  useEffect(() => {
    setMounted(true)
  }, [])

  // resolvedTheme resuelve 'system' al valor real ('light' | 'dark')
  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))]/60 glass-surface">
      <div className="flex h-16 items-center gap-4 px-4 pl-16 lg:pl-6">
        <QuickSearch />

        <div className="ml-auto flex items-center gap-2">
          <SystemStatusIndicator />

          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <Link href="/settings/notifications">
              <Bell className="h-4 w-4" />
              <span className="sr-only">{t('settings')}</span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
          >
            {mounted ? (
              isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            ) : (
              <Sun className="h-4 w-4 opacity-0" />
            )}
            <span className="sr-only">{t('toggleTheme')}</span>
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <a
              href="https://github.com/Marlonmorenolopez/SecureScan"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="h-4 w-4" />
              <span className="sr-only">{t('github')}</span>
            </a>
          </Button>

          {/* Selector de idioma ES / EN */}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  )
}
