'use client'

import { useState, useEffect } from 'react'
import {
  Globe, Play, Settings2, AlertTriangle, ChevronDown,
  Layers, Network, Search, Zap, Database, Shield,
  FolderSearch, ShieldAlert, Bug, KeyRound,
  Info, Check, X, Loader2, Fingerprint,
} from 'lucide-react'
import {
  JuiceShopIcon,
  DvwaIcon,
  WebGoatIcon,
} from '@/components/tool-icons'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label }    from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge }    from '@/components/ui/badge'
import { useScan, type ScanOptions } from '@/lib/scan-context'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { getSkillsByCategory, getSkillById } from '@/lib/skills'
import { getSkillSvgIcon } from '@/lib/tool-docs'

// labTargets movido dentro de ScanForm — ver B1-c

type ToolId =
  | 'wappalyzer' | 'nmap' | 'gobuster' | 'zap' | 'searchsploit'
  | 'metasploit'  | 'nuclei' | 'sqlmap'  | 'patator' | 'ffuf'

// Identidad de cada herramienta (nombre, logo) = Skill Registry, con el mismo
// id. Aquí solo vive lo propio del formulario: tiempo estimado y opt-in.
interface ToolConfig {
  id: ToolId
  estimatedTime: string
  optional?: boolean
  /**
   * Otras Skills de Pentesting (ids del Registry) que este switch activa en el
   * backend: el Registry lista 12 herramientas, pero el formulario expone 10
   * switches porque ZAP Spider corre dentro del ZAP full scan e Injection
   * Scanner corre en el paso de SQLMap (server/app.py → run_scan).
   */
  covers?: string[]
}

// Descripción traducida: messages/{es,en}.json → skills.<id>.short
const toolsConfig: ToolConfig[] = [
  // ── Reconocimiento ──────────────────────────────────────────────────
  { id: 'wappalyzer', estimatedTime: '10s' },
  { id: 'nmap', estimatedTime: '30s' },
  { id: 'gobuster', estimatedTime: '2m' },
  { id: 'ffuf', estimatedTime: '2m' },
  // ── Análisis de vulnerabilidades ────────────────────────────────────
  { id: 'zap', estimatedTime: '10m', covers: ['zap-spider'] },
  { id: 'nuclei', estimatedTime: '5m' },
  { id: 'sqlmap', estimatedTime: '4m', covers: ['injection-scanner'] },
  // ── Explotación y exploits ──────────────────────────────────────────
  { id: 'searchsploit', estimatedTime: '10s' },
  { id: 'metasploit', estimatedTime: '5m', optional: true },
  // ── Fuerza bruta ────────────────────────────────────────────────────
  { id: 'patator', estimatedTime: '2m' },
]

// intensityProfiles movido dentro de ScanForm — ver B1-c (se añade DESPUÉS de labTargets)

export function ScanForm() {
  const t = useTranslations('scanner')
  const tSkills = useTranslations('skills')
  const { startScan, isScanning, error, clearError } = useScan()
  // Nombres de las 12 herramientas de Pentesting, derivados del Skill Registry
  const pentestingToolNames = getSkillsByCategory('pentesting').map(sk => sk.name).join(' · ')

  // labTargets usa t() para los campos traducibles
  const labTargets = [
    {
      name: 'Juice Shop',
      url: 'http://localhost:3001',
      container: 'juice-shop:3000',
      description: 'OWASP Top 10 2021, API REST, Angular',
      icon: JuiceShopIcon,
      difficulty: t('difficulty.medium'),
    },
    {
      name: 'DVWA',
      url: 'http://localhost:3002',
      container: 'dvwa:80',
      description: 'SQLi, XSS, CSRF, File Upload, Brute Force',
      icon: DvwaIcon,
      difficulty: t('difficulty.easy'),
    },
    {
      name: 'WebGoat',
      url: 'http://localhost:3003',
      container: 'webgoat:8080',
      description: 'Tutoriales guiados OWASP, JWT, XXE',
      icon: WebGoatIcon,
      difficulty: t('difficulty.variable'),
    },
  ]

  const intensityProfiles = [
    {
      value: 'light',
      label: t('profiles.light'),
      description: t('profiles.lightDesc'),
      tools: ['wappalyzer', 'nmap'] as ToolId[],
    },
    {
      value: 'normal',
      label: t('profiles.normal'),
      description: t('profiles.normalDesc'),
      tools: ['wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit'] as ToolId[],
    },
    {
      value: 'aggressive',
      label: t('profiles.aggressive'),
      description: t('profiles.aggressiveDesc'),
      tools: ['wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit',
              'metasploit', 'nuclei', 'sqlmap', 'patator', 'ffuf'] as ToolId[],
    },
  ] as const

  const [target, setTarget]                   = useState('')
  const [customUrl, setCustomUrl]             = useState('')
  const [showAdvanced, setShowAdvanced]       = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<string>('normal')
  const [validationError, setValidationError] = useState<string | null>(null)

  const [options, setOptions] = useState<ScanOptions>({
    tools: {
      wappalyzer: true, nmap: true, gobuster: false, zap: false,
      searchsploit: false, metasploit: false,
      nuclei: false, sqlmap: false, patator: false, ffuf: false,
      // Huella Digital (fase paralela del backend). Aquí solo se decide si
      // se recopila; la selección de fuentes vive en el módulo /footprint.
      threat_intel: true,
    },
    parallel: true,
    intensity: 'normal',
  })

  useEffect(() => {
    // Limpiar errores cada vez que el usuario cambia el target.
    // clearError está memoizado con useCallback en ScanContext — seguro omitirlo
    // del array para evitar el loop: error→clearError→render→error.
    setValidationError(null)
    if (error) clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const applyProfile = (profileValue: string) => {
    const profile = intensityProfiles.find(p => p.value === profileValue)
    if (!profile) return
    setSelectedProfile(profileValue)
    setOptions(prev => ({
      ...prev,
      intensity: profileValue as ScanOptions['intensity'],
      tools: {
        wappalyzer:   profile.tools.includes('wappalyzer'),
        nmap:         profile.tools.includes('nmap'),
        gobuster:     profile.tools.includes('gobuster'),
        zap:          profile.tools.includes('zap'),
        searchsploit: profile.tools.includes('searchsploit'),
        metasploit:   profile.tools.includes('metasploit'),
        nuclei:       profile.tools.includes('nuclei'),
        sqlmap:       profile.tools.includes('sqlmap'),
        patator:      profile.tools.includes('patator'),
        ffuf:         profile.tools.includes('ffuf'),
        // Huella Digital es independiente del perfil de intensidad -- se
        // conserva la elección del usuario en vez de resetearla al elegir
        // Ligero/Normal/Agresivo.
        threat_intel:       prev.tools?.threat_intel ?? true,
      },
    }))
  }

  const validateTarget = (value: string): boolean => {
    if (!value.trim()) {
      setValidationError(t('validationEmptyTarget'))
      return false
    }
    if (value.includes('://')) {
      try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol)) {
          setValidationError(t('validationProtocol'))
          return false
        }
      } catch {
        setValidationError(t('validationInvalidUrl'))
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateTarget(target)) return
    await startScan(target, options)
  }

  const handleToolToggle = (tool: ToolId) => {
    setOptions(prev => ({
      ...prev,
      tools: { ...prev.tools!, [tool]: !prev.tools![tool] },
    }))
    setSelectedProfile('custom')
  }

  // ── Huella Digital: switch maestro (la selección de fuentes está en /footprint) ──
  const threatIntelEnabled = options.tools?.threat_intel ?? true

  const handleThreatIntelMasterToggle = () => {
    setOptions(prev => ({
      ...prev,
      tools: { ...prev.tools!, threat_intel: !threatIntelEnabled },
    }))
    setSelectedProfile('custom')
  }

  // Solo cuentan las herramientas de Pentesting (no el switch de Huella Digital)
  const activeToolsCount = toolsConfig.filter(tool => options.tools?.[tool.id]).length
  const estimatedTime =
    activeToolsCount <= 2 ? t('estimatedTimes.fast') :
    activeToolsCount <= 5 ? t('estimatedTimes.medium') :
    activeToolsCount <= 8 ? t('estimatedTimes.slow') : t('estimatedTimes.deep')

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Globe className="h-5 w-5 text-primary" />
              {t('title')}
              <Badge variant="secondary" className="ml-2">
                {activeToolsCount} {t('tools')}
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              {pentestingToolNames}
            </CardDescription>
          </div>
          <div className="text-right text-sm text-muted-foreground hidden sm:block">
            <div className="font-medium">{t('estimatedTime')}</div>
            <div>{estimatedTime}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Aviso Legal */}
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('legalTitle')}</AlertTitle>
          <AlertDescription>{t('legalBody')}</AlertDescription>
        </Alert>

        {/* Error del Contexto */}
        {error && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <AlertTitle>{t('errorTitle')}</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={clearError} className="h-auto py-1">{t('close')}</Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Error de Validación */}
        {validationError && (
          <Alert variant="default" className="bg-amber-50 border-amber-200 text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input de Target */}
          <div className="space-y-2">
            <Label htmlFor="target">{t('targetLabel')}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="target"
                  type="text"
                  placeholder={t('targetPlaceholder')}
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  className={`pl-10 ${validationError ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                  disabled={isScanning}
                />
              </div>
              <Button type="submit" disabled={isScanning || !target.trim()} className="min-w-[120px]">
                {isScanning ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('scanningButton')}</>
                ) : (
                  <><Play className="mr-2 h-4 w-4" />{t('scanButton')}</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('formats')}{' '}
              <code className="bg-muted px-1 rounded">http://localhost:3001</code>,{' '}
              <code className="bg-muted px-1 rounded">juice-shop:3000</code>
            </p>
          </div>

          {/* Laboratorios */}
          <div className="space-y-3">
            <Label>{t('labsTitle')}</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {labTargets.map(lab => {
                const Icon = lab.icon
                const isSelected = target === lab.url || target === `http://${lab.container}`
                return (
                  <button
                    key={lab.name}
                    type="button"
                    onClick={() => setTarget(isSelected ? '' : `http://${lab.container}`)}
                    disabled={isScanning}
                    className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all hover:shadow-md ${
                      isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-md ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">{lab.name}</span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{lab.description}</p>
                    <Badge variant="outline" className="text-xs mt-auto">{lab.difficulty}</Badge>
                  </button>
                )
              })}
            </div>
          </div>

          {/* URL Personalizada */}
          <div className="space-y-2">
            <Label htmlFor="custom-url" className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              {t('customUrlLabel')}
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-url"
                type="text"
                placeholder={t('customUrlPlaceholder')}
                value={customUrl}
                disabled={isScanning}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (customUrl.trim()) setTarget(customUrl.trim())
                  }
                }}
                onChange={e => setCustomUrl(e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isScanning || !customUrl.trim()}
                onClick={() => {
                  if (customUrl.trim()) setTarget(customUrl.trim())
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                {t('useButton')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('customUrlHint')}
            </p>
            {target && !labTargets.some(l => target.includes(l.url) || target.includes(l.container)) && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
                <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-sm text-blue-700 dark:text-blue-300 font-mono truncate">{target}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto text-blue-400 hover:text-blue-600"
                  onClick={() => setTarget('')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Perfiles de Intensidad */}
          <div className="space-y-3">
            <Label>{t('profileTitle')}</Label>
            <div className="flex flex-wrap gap-2">
              {intensityProfiles.map(profile => (
                <Button
                  key={profile.value}
                  type="button"
                  variant={selectedProfile === profile.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => applyProfile(profile.value)}
                  disabled={isScanning}
                  className="h-auto py-2"
                >
                  <span className="font-medium">{profile.label}</span>
                  <span className="ml-1 text-xs opacity-70">{profile.description}</span>
                </Button>
              ))}
              {selectedProfile === 'custom' && (
                <Button type="button" variant="secondary" size="sm" disabled className="h-auto py-2">
                  {t('profiles.custom')}
                </Button>
              )}
            </div>
          </div>

          {/* Configuración Avanzada */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="w-full justify-between" disabled={isScanning}>
                <span className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  {t('advancedConfig')}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {toolsConfig.map(tool => {
                  const skill = getSkillById(tool.id)!
                  const Icon = getSkillSvgIcon(tool.id) ?? skill.icon
                  const isEnabled = options.tools?.[tool.id] ?? false
                  return (
                    <div
                      key={tool.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        isEnabled ? 'border-primary/30 bg-primary/5' : 'border-border'
                      }`}
                    >
                      <Checkbox
                        id={`tool-${tool.id}`}
                        checked={isEnabled}
                        onCheckedChange={() => handleToolToggle(tool.id)}
                        disabled={isScanning}
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`tool-${tool.id}`} className="flex items-center gap-2 cursor-pointer">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="font-medium text-sm">{skill.name}</span>
                          {tool.optional && (
                            <Badge variant="outline" className="text-xs border-orange-500/50 text-orange-500">{t('optIn')}</Badge>
                          )}
                        </label>
                        <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                          {tSkills(`${tool.id}.short`)} · {tool.estimatedTime}
                        </p>
                        {tool.covers && (
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5 ml-6">
                            {t('alsoRuns', { tools: tool.covers.map(id => getSkillById(id)?.name ?? id).join(', ') })}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Huella Digital — solo el switch maestro (`threat_intel`). Las 7 fuentes se
                  eligen en el módulo Huella Digital (/footprint); los resultados de esta
                  ejecución se muestran allí, separados de los de Pentesting. */}
              <div className="mt-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/20 p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="tool-threat-intel-master"
                    checked={threatIntelEnabled}
                    onCheckedChange={handleThreatIntelMasterToggle}
                    disabled={isScanning}
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor="tool-threat-intel-master" className="flex flex-wrap items-center gap-2 cursor-pointer">
                      <Fingerprint className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium text-sm">{t('footprintToggleTitle')}</span>
                      <Badge variant="secondary" className="text-xs">{t('footprintToggleBadge')}</Badge>
                    </label>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {t('footprintToggleHint')}{' '}
                      <Link href="/footprint" className="text-[var(--cyber-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyber-accent)]">
                        {t('footprintToggleLink')}
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </form>
      </CardContent>
    </Card>
  )
}
