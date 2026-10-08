'use client'
// components/cyber/ModuleHeader.tsx — PentaWark v5.0
//
// Cabecera común de los módulos de SECURITY, que son experiencias
// independientes (Pentesting → /scanner, Huella Digital → /footprint).
// Aporta la misma "carcasa" (breadcrumb e identidad del módulo); el
// CONTENIDO de cada módulo (jerarquía, paneles, datos) es propio de cada
// página. Reutiliza los tokens del Design System (surface-3, holo-edge,
// COLOR_VARS) — no define estilos nuevos.

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { COLOR_VARS, type NavSection } from '@/lib/nav-config'
import { useNavLabel } from '@/lib/nav-i18n'
import { cn } from '@/lib/utils'

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

      <nav aria-label={t('breadcrumb')} className="relative flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
        <span>{t('security')}</span>
        <span aria-hidden="true">/</span>
        <span style={{ color: c.fg }} aria-current="page">{label}</span>
      </nav>

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
