'use client'
// components/cyber/ModuleHeader.tsx — SecureScan Pro v5.0
//
// Cabecera común de los módulos de SECURITY que son experiencias
// independientes (Pentesting → /scanner, Huella Digital → /footprint).
// Aporta la misma "carcasa" (breadcrumb, identidad del módulo, selector de
// módulo) para que ambos se sientan parte de la misma plataforma; el
// CONTENIDO de cada módulo (jerarquía, paneles, datos) es propio de cada
// página. Reutiliza los tokens del Design System (surface-3, holo-edge,
// COLOR_VARS) — no define estilos nuevos.

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { COLOR_VARS, PENTESTING, HUELLA_DIGITAL, type NavSection } from '@/lib/nav-config'
import { useNavLabel } from '@/lib/nav-i18n'
import { cn } from '@/lib/utils'

const MODULES: NavSection[] = [PENTESTING, HUELLA_DIGITAL]

function ModuleTab({ module, active }: { module: NavSection; active: boolean }) {
  const label = useNavLabel(module)
  const Icon = module.icon
  const c = COLOR_VARS[module.color]
  return (
    <Link
      href={module.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
        active
          ? 'bg-[rgba(var(--c-rgb),0.14)] text-[var(--c-fg)]'
          : 'text-muted-foreground hover:bg-[rgba(var(--c-rgb),0.07)] hover:text-foreground',
      )}
      style={{ ['--c-fg' as string]: c.fg, ['--c-rgb' as string]: c.rgb }}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Link>
  )
}

interface ModuleHeaderProps {
  /** Módulo actual: PENTESTING o HUELLA_DIGITAL (lib/nav-config.tsx) */
  section: NavSection
  /** Título (h1) ya traducido */
  title: string
  /** Descripción ya traducida */
  description: string
  /** Contenido propio del módulo bajo el título (taxonomía, indicadores…) */
  children?: ReactNode
  className?: string
}

export function ModuleHeader({ section, title, description, children, className }: ModuleHeaderProps) {
  const t = useTranslations('module')
  const label = useNavLabel(section)
  const Icon = section.icon
  const c = COLOR_VARS[section.color]

  return (
    <header
      className={cn('surface-3 holo-edge relative overflow-hidden rounded-xl border p-5 sm:p-6', className)}
      style={{ borderColor: `rgba(${c.rgb},0.28)` }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, rgba(${c.rgb},0.45), transparent 70%)` }}
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t('breadcrumb')} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <span>{t('security')}</span>
          <span aria-hidden="true">/</span>
          <span style={{ color: c.fg }} aria-current="page">{label}</span>
        </nav>

        <nav
          aria-label={t('switchLabel')}
          className="flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/40 p-1"
        >
          {MODULES.map(m => (
            <ModuleTab key={m.id} module={m} active={m.id === section.id} />
          ))}
        </nav>
      </div>

      <div className="relative mt-4 flex items-start gap-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
          style={{ color: c.fg, borderColor: `rgba(${c.rgb},0.4)`, background: `rgba(${c.rgb},0.10)` }}
        >
          <Icon aria-hidden="true" className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-h1 text-foreground">{title}</h1>
          <p className="text-body mt-1 max-w-3xl text-muted-foreground">{description}</p>
        </div>
      </div>

      {children && <div className="relative mt-5">{children}</div>}
    </header>
  )
}
