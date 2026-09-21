'use client'
// components/cyber/Sidebar.tsx — SecureScan Pro v5.0
// Navegación lateral por secciones funcionales (Security, Laboratorios,
// Análisis, Operaciones), con grupos expandibles/contraíbles y colapso
// completo a "rail" de iconos. Todas las rutas son las EXISTENTES de la
// app (ver lib/nav-config.tsx) — este componente es puramente de
// presentación/navegación, no toca backend ni rutas.
//
// i18n: labels/descriptions vienen de messages/{es,en}.json → "navCatalog"
// vía lib/nav-i18n.ts. Los nombres propios de herramientas no se traducen.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronsLeft, ChevronsRight, Menu, X, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TOP_LEAVES, ALL_GROUPS, OPERATIONS_LEAVES, ANALYSIS_LEAVES, DOCS_LEAF,
  COLOR_VARS, type NavSection, type NavLeaf, type CyberColor,
} from '@/lib/nav-config'
import { useNavLabel, useLeafLabel } from '@/lib/nav-i18n'
import { SecureScanIcon } from '@/components/tool-icons'

// Un href está activo si la ruta coincide o cuelga de él. Con `exact` solo
// coincide la ruta exacta (ej. /settings NO debe activarse en
// /settings/notifications, porque son dos pantallas distintas).
function useActive(href: string, exact = false) {
  const pathname = usePathname()
  if (href === '/' || exact) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] focus-visible:ring-offset-0'

function SectionLink({ section, collapsed }: { section: NavSection; collapsed: boolean }) {
  const active = useActive(section.href)
  const label = useNavLabel(section)
  const Icon = section.icon
  const c = COLOR_VARS[section.color]

  return (
    <Link
      href={section.href}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        FOCUS_RING,
        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-all',
        active
          ? 'bg-[rgba(var(--c-rgb),0.14)] text-[var(--c-fg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'text-muted-foreground hover:bg-[rgba(var(--c-rgb),0.07)] hover:text-foreground hover:translate-x-0.5'
      )}
      style={{ ['--c-fg' as string]: c.fg, ['--c-rgb' as string]: c.rgb }}
      title={collapsed ? label : undefined}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--c-fg)]"
          style={{ boxShadow: `0 0 8px rgba(${c.rgb},0.8)` }}
        />
      )}
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" style={{ color: active ? c.fg : undefined }} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function ExtraLeafLink({
  leaf, collapsed, color,
}: {
  leaf: NavLeaf
  collapsed: boolean
  color: CyberColor
}) {
  const active = useActive(leaf.href, leaf.exact)
  const label = useLeafLabel(leaf)
  const LeafIcon = leaf.icon
  const c = COLOR_VARS[color]

  return (
    <Link
      href={leaf.href}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        FOCUS_RING,
        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 pl-6 text-xs transition-all',
        active
          ? 'bg-[rgba(var(--c-rgb),0.10)] text-[var(--c-fg)]'
          : 'text-muted-foreground/80 hover:bg-[rgba(var(--c-rgb),0.06)] hover:text-foreground'
      )}
      style={{ ['--c-fg' as string]: c.fg, ['--c-rgb' as string]: c.rgb }}
    >
      <LeafIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function TopLeafLink({ leaf, collapsed }: { leaf: NavLeaf; collapsed: boolean }) {
  const active = useActive(leaf.href, leaf.exact)
  const label = useLeafLabel(leaf)
  const Icon = leaf.icon

  return (
    <Link
      href={leaf.href}
      title={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        FOCUS_RING,
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-all',
        active
          ? 'bg-[rgba(var(--cyber-accent-rgb),0.12)] text-[var(--cyber-accent)]'
          : 'text-muted-foreground hover:bg-[rgba(var(--cyber-accent-rgb),0.07)] hover:text-foreground'
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}

function GroupBlock({
  label, color, sections, collapsed, extraLeaves,
}: {
  label: string
  color: CyberColor
  sections: NavSection[]
  collapsed: boolean
  extraLeaves?: NavLeaf[]
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-1">
      {!collapsed && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(FOCUS_RING, 'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground')}
        >
          <span>{label}</span>
          <ChevronDown aria-hidden="true" className={cn('h-3 w-3 transition-transform', open ? '' : '-rotate-90')} />
        </button>
      )}
      {(open || collapsed) && (
        <div className="space-y-0.5 px-1.5">
          {sections.map((s) => (
            <SectionLink key={s.id} section={s} collapsed={collapsed} />
          ))}
          {extraLeaves?.map((leaf) => (
            <ExtraLeafLink key={leaf.id} leaf={leaf} collapsed={collapsed} color={color} />
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const t = useTranslations('navCatalog')
  const tSidebar = useTranslations('nav')
  // En el drawer móvil siempre se muestran las etiquetas: el modo "rail"
  // (solo iconos) es exclusivo de escritorio.
  const rail = collapsed && !mobileOpen

  // El drawer móvil se cierra al navegar (el layout persiste entre rutas).
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Escape cierra el drawer móvil
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={cn(FOCUS_RING, 'fixed left-3 top-3 z-[60] flex h-9 w-9 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))]/90 backdrop-blur lg:hidden')}
        aria-label={tSidebar('openNav')}
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
      >
        <Menu aria-hidden="true" className="h-4 w-4" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        id="app-sidebar"
        aria-label={tSidebar('mainNavigation')}
        className={cn(
          'flex shrink-0 flex-col border-r border-[hsl(var(--border))] glass-surface',
          'fixed inset-y-0 left-0 z-[70] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-16 items-center gap-2.5 border-b border-[hsl(var(--border))] px-4', rail && 'lg:justify-center lg:px-0')}>
          <SecureScanIcon className="h-7 w-7 shrink-0" />
          {!rail && (
            <div className="flex flex-col leading-tight lg:group-data-[collapsed=false]:flex">
              <span className="font-mono text-sm font-semibold">SecureScan Pro</span>
              <span className="font-mono text-[10px] text-[var(--cyber-accent)]">v5.0</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label={tSidebar('closeNav')}
            className={cn(FOCUS_RING, 'ml-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground lg:hidden')}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav aria-label={tSidebar('mainNavigation')} className="flex-1 overflow-y-auto py-3">
          <div className="space-y-0.5 px-1.5 pb-2">
            {TOP_LEAVES.map((leaf) => (
              <TopLeafLink key={leaf.id} leaf={leaf} collapsed={rail} />
            ))}
          </div>

          {ALL_GROUPS.map((group) => (
            <GroupBlock
              key={group.id}
              label={t(`topGroups.${group.id === 'security' ? 'security' : group.id === 'labs' ? 'labs' : 'analysis'}`)}
              color={group.color}
              sections={group.sections}
              collapsed={rail}
              extraLeaves={
                group.id === 'analysis' ? ANALYSIS_LEAVES : undefined
              }
            />
          ))}

          <GroupBlock
            label={t('topGroups.operations')}
            color="cyan"
            sections={[]}
            collapsed={rail}
            extraLeaves={OPERATIONS_LEAVES}
          />

          <div className="mt-1 space-y-0.5 px-1.5">
            <Link
              href={DOCS_LEAF.href}
              title={rail ? tSidebar('docs') : undefined}
              aria-current={pathname === DOCS_LEAF.href ? 'page' : undefined}
              aria-label={rail ? tSidebar('docs') : undefined}
              className={cn(
                FOCUS_RING,
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-all',
                pathname === DOCS_LEAF.href
                  ? 'bg-[rgba(var(--cyber-accent-rgb),0.12)] text-[var(--cyber-accent)]'
                  : 'text-muted-foreground hover:bg-[rgba(var(--cyber-accent-rgb),0.07)] hover:text-foreground'
              )}
            >
              <BookOpen aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {!rail && <span>{tSidebar('docs')}</span>}
            </Link>
          </div>
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? tSidebar('expandSidebar') : tSidebar('collapseSidebar')}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          className={cn(FOCUS_RING, 'hidden items-center justify-center gap-2 border-t border-[hsl(var(--border))] py-3 text-muted-foreground hover:text-foreground lg:flex')}
        >
          {collapsed ? <ChevronsRight aria-hidden="true" className="h-4 w-4" /> : <ChevronsLeft aria-hidden="true" className="h-4 w-4" />}
          {!collapsed && <span className="font-mono text-[10px] uppercase tracking-wider">{tSidebar('collapseSidebar')}</span>}
        </button>
      </aside>
    </>
  )
}
