'use client'
// components/footprint/FootprintForm.tsx — SecureScan Pro v5.0
//
// Lanzador del módulo HUELLA DIGITAL. Usa el MISMO endpoint y contrato que ya
// existen (scan-context → POST /api/scan) con un preset de opciones reales:
//   · las 10 herramientas de Pentesting en `false`
//   · `threat_intel: true` + `threat_intel_tools: [fuentes elegidas]`
// El backend no cambia: son las mismas opciones que expone el formulario de
// Pentesting, aquí presentadas como su propio flujo. Las fuentes vienen del
// Skill Registry (categoría huella-digital), agrupadas por subgrupo.

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Fingerprint, Loader2, KeyRound, Info, Radar } from 'lucide-react'
import { useScan } from '@/lib/scan-context'
import { getFootprintSkills } from '@/lib/scan-extractors'
import { HUELLA_DIGITAL, COLOR_VARS } from '@/lib/nav-config'
import { useGroupLabel } from '@/lib/nav-i18n'
import { CyberButton } from '@/components/cyber/CyberButton'
import { CyberPanel } from '@/components/cyber/CyberPanel'
import { cn } from '@/lib/utils'

/** Fuentes que requieren API key en el servidor (ver docs de cada Skill). */
const NEEDS_API_KEY = new Set(['virustotal', 'abuseipdb', 'safebrowsing'])

/** Presets reales: ninguna herramienta de Pentesting se ejecuta. */
const NO_PENTEST_TOOLS = {
  wappalyzer: false, nmap: false, gobuster: false, zap: false, searchsploit: false,
  metasploit: false, nuclei: false, sqlmap: false, patator: false, ffuf: false,
} as const

function GroupLabel({ groupKey }: { groupKey: string }) {
  const group = HUELLA_DIGITAL.groups.find(g => g.key === groupKey)!
  const label = useGroupLabel(HUELLA_DIGITAL, group)
  const Icon = group.icon
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Icon aria-hidden="true" className="h-3 w-3" /> {label}
    </span>
  )
}

export function FootprintForm() {
  const t = useTranslations('footprint.form')
  const { startScan, isScanning } = useScan()
  const c = COLOR_VARS[HUELLA_DIGITAL.color]

  const skills = useMemo(() => getFootprintSkills(), [])
  const groups = useMemo(() => Array.from(new Set(skills.map(s => s.subgroup))), [skills])

  const [target, setTarget] = useState('')
  const [selected, setSelected] = useState<string[]>(() => skills.map(s => s.id))
  const [touched, setTouched] = useState(false)

  const targetInvalid = touched && target.trim().length === 0
  const noneSelected = selected.length === 0

  const toggle = (id: string) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!target.trim() || noneSelected || isScanning) return
    await startScan(target.trim(), {
      tools: { ...NO_PENTEST_TOOLS, threat_intel: true, threat_intel_tools: selected },
      parallel: true,
    })
  }

  return (
    <CyberPanel title={t('title')} subtitle={t('subtitle')}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="footprint-target" className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('targetLabel')}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="footprint-target"
              type="text"
              value={target}
              onChange={e => setTarget(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t('targetPlaceholder')}
              disabled={isScanning}
              aria-invalid={targetInvalid}
              aria-describedby={targetInvalid ? 'footprint-target-error' : 'footprint-note'}
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'h-10 flex-1 rounded-md border bg-[hsl(var(--background))] px-3 font-mono text-sm',
                'placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
                targetInvalid ? 'border-red-500/70' : 'border-[hsl(var(--border))]',
              )}
            />
            <CyberButton
              type="submit"
              variant="primary"
              size="md"
              loading={isScanning}
              disabled={isScanning || noneSelected}
              icon={isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            >
              {isScanning ? t('submitting') : t('submit')}
            </CyberButton>
          </div>
          {targetInvalid && (
            <p id="footprint-target-error" role="alert" className="text-xs text-red-400">{t('targetRequired')}</p>
          )}
        </div>

        <fieldset className="space-y-3" disabled={isScanning}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <legend className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('sourcesLabel')} <span className="text-foreground">({selected.length}/{skills.length})</span>
            </legend>
            <div className="flex items-center gap-3 text-xs">
              <button type="button" onClick={() => setSelected(skills.map(s => s.id))}
                className="text-[var(--cyber-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] rounded">
                {t('selectAll')}
              </button>
              <button type="button" onClick={() => setSelected([])}
                className="text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)] rounded">
                {t('clearAll')}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map(groupKey => (
              <div key={groupKey} className="space-y-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20 p-3">
                <GroupLabel groupKey={groupKey} />
                <div className="flex flex-wrap gap-2">
                  {skills.filter(s => s.subgroup === groupKey).map(skill => {
                    const on = selected.includes(skill.id)
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        role="switch"
                        aria-checked={on}
                        onClick={() => toggle(skill.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-xs transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]',
                          'disabled:cursor-not-allowed disabled:opacity-60',
                          on
                            ? 'text-foreground'
                            : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground',
                        )}
                        style={on ? { borderColor: `rgba(${c.rgb},0.55)`, background: `rgba(${c.rgb},0.10)` } : undefined}
                      >
                        <skill.icon aria-hidden="true" className="h-3.5 w-3.5" style={on ? { color: c.fg } : undefined} />
                        {skill.name}
                        {NEEDS_API_KEY.has(skill.id) && (
                          <KeyRound aria-label={t('needsApiKey')} className="h-3 w-3 text-amber-500" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {noneSelected && <p role="alert" className="text-xs text-amber-400">{t('noSourcesSelected')}</p>}
        </fieldset>

        <div id="footprint-note" className="space-y-2 rounded-lg border border-[hsl(var(--border))] p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-start gap-2"><Radar aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('noteScope')}</p>
          <p className="flex items-start gap-2"><KeyRound aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{t('noteApiKeys')}</p>
          <p className="flex items-start gap-2"><Info aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('notePublicTargets')}</p>
        </div>
      </form>
    </CyberPanel>
  )
}
