'use client'
// lib/nav-i18n.ts — SecureScan Pro v5.0
// Puente entre el catálogo estructural (lib/nav-config.tsx, sin strings
// traducibles) y el sistema i18n existente (next-intl + messages/{es,en}.json
// → namespace "navCatalog"). Los nombres propios de herramientas (Nmap,
// Gitleaks, etc.) NO se traducen — solo label/description de sección y
// label de grupo.

import { useTranslations } from 'next-intl'
import type { NavSection, NavToolGroup, NavLeaf } from '@/lib/nav-config'

export function useNavLabel(section: NavSection): string {
  const t = useTranslations('navCatalog.sections')
  return t(`${section.id}.label`)
}

export function useNavDescription(section: NavSection): string {
  const t = useTranslations('navCatalog.sections')
  return t(`${section.id}.description`)
}

export function useGroupLabel(section: NavSection, group: NavToolGroup): string {
  const t = useTranslations('navCatalog.sections')
  return t(`${section.id}.groups.${group.key}`)
}

export function useLeafLabel(leaf: NavLeaf): string {
  const t = useTranslations('navCatalog.leaves')
  return t(leaf.id)
}
