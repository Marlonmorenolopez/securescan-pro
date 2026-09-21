// lib/tool-docs.ts — SecureScan Pro v5.0
//
// Construye la vista "ToolDoc" (descripción/uso/features/link traducidos)
// a partir del Skill Registry central (lib/skills.ts) — NO duplica datos.
// Antes este archivo tenía su propio array hardcodeado; ahora solo lee
// `skill.docs` de cada Skill y resuelve las claves i18n con `t`.
//
// Consumido por: app/docs/page.tsx, app/scanner/page.tsx y
// components/footprint/FootprintSources.tsx (ToolDetailDrawer).
// Los textos siguen la convención por id del Registry
// (messages/{es,en}.json → skills.<id>.description / skills.<id>.features[]).
// El `t` recibido debe ser un traductor RAÍZ (useTranslations() sin
// namespace): así se resuelve el path completo `skills.<id>.*`.

import type { useTranslations } from 'next-intl'
import type { LucideIcon } from 'lucide-react'
import type { FC } from 'react'
import { AVAILABLE_SKILLS, SKILL_TEXT_NAMESPACE, getSkillById } from '@/lib/skills'
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

/** Docs de las Skills 'available' que tienen `docs` (las 'planned' nunca se documentan). */
export function getToolDocs(t: TFunc): ToolDoc[] {
  return AVAILABLE_SKILLS
    .filter(skill => !!skill.docs)
    .map(skill => {
      const docs = skill.docs!
      const base = `${SKILL_TEXT_NAMESPACE}.${skill.id}`
      return {
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        description: t(`${base}.description`),
        usage: docs.usage,
        features: t.raw(`${base}.features`) as string[],
        documentation: docs.documentationUrl,
      }
    })
}

/** Logo custom (SVG) de una Skill, si existe — mismo lookup que ya usaba /scanner. */
export function getSkillSvgIcon(skillId: string): FC<{ className?: string }> | undefined {
  const skill = getSkillById(skillId)
  if (!skill?.svgIconKey) return undefined
  return TOOL_ICONS[skill.svgIconKey]
}
