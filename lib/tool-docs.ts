// lib/tool-docs.ts — SecureScan Pro v5.0
//
// Construye la vista "ToolDoc" (descripción/uso/features/link traducidos)
// a partir del Skill Registry central (lib/skills.ts) — NO duplica datos.
// Antes este archivo tenía su propio array hardcodeado; ahora solo lee
// `skill.docs` de cada Skill y resuelve las claves i18n con `t`.
//
// Consumido por: app/docs/page.tsx, app/scanner/page.tsx (ToolDetailDrawer).
// El `t` recibido debe ser un traductor RAÍZ (useTranslations() sin
// namespace), porque las claves reales viven bajo "docs.*" en
// messages/{es,en}.json y así se resuelven con el path completo.

import type { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import type { FC } from 'react'
import { SKILLS } from '@/lib/skills'
import { TOOL_ICONS } from '@/components/tool-icons'

export type TFunc = ReturnType<typeof useTranslations>

export interface ToolDoc {
  id: string
  name: string
  icon: LucideIcon
  description: string
  usage: string
  features: string[]
  documentation: string
}

export function getToolDocs(t: TFunc): ToolDoc[] {
  return SKILLS
    .filter(skill => !!skill.docs)
    .map(skill => {
      const docs = skill.docs!
      return {
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        description: t(`docs.${docs.descriptionKey}`),
        usage: docs.usage,
        features: docs.featureKeys.map(key => t(`docs.${key}`)),
        documentation: docs.documentationUrl,
      }
    })
}

/** Logo custom (SVG) de una Skill, si existe — mismo lookup que ya usaba /scanner. */
export function getSkillSvgIcon(skillId: string): FC<{ className?: string }> | undefined {
  const skill = SKILLS.find(s => s.id === skillId)
  if (!skill?.svgIconKey) return undefined
  return TOOL_ICONS[skill.svgIconKey]
}
