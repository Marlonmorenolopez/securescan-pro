// lib/nav-config.tsx — SecureScan Pro v5.0
//
// Catálogo ÚNICO de navegación y herramientas, consumido por:
//   - components/cyber/Sidebar.tsx        (navegación lateral agrupada)
//   - components/header.tsx               (búsqueda rápida)
//   - app/dashboard/page.tsx              (tarjetas de sección)
//
// IMPORTANTE: esto es organización visual del FRONTEND. Cada `href` apunta
// a una ruta que YA EXISTE en la app (ver app/*/page.tsx) — no se inventan
// rutas ni funcionalidades nuevas. "Huella Digital" y "Pentesting" apuntan
// ambas a /scanner porque, en el backend actual, ambas corren como parte
// del mismo Web Scan orchestrator (ver TOOL_ORDER en components/scan-progress.tsx).

import type { LucideIcon } from 'lucide-react'
import {
  Home, LayoutDashboard, Target, Search, Fingerprint, Code2, FlaskConical,
  BarChart3, Settings2, Radar, ListTree, ShieldCheck, KeyRound, Bug,
  Swords, UserSearch, Globe2, ShieldAlert, Network, Eye, Lock, KeySquare,
  ScanSearch, FileWarning, Box, History, CalendarClock, Bell, Sliders,
  GitCompare, FileText, TrendingUp, BookOpen,
} from 'lucide-react'
import { getSkillNames } from '@/lib/skills'

export type CyberColor = 'cyan' | 'purple' | 'emerald' | 'blue' | 'magenta' | 'amber'

export const COLOR_VARS: Record<CyberColor, { fg: string; rgb: string }> = {
  cyan:    { fg: 'var(--cyber-accent)',   rgb: 'var(--cyber-accent-rgb)' },
  purple:  { fg: 'var(--cyber-purple)',   rgb: 'var(--cyber-purple-rgb)' },
  emerald: { fg: 'var(--cyber-green)',    rgb: '16, 185, 129' },
  blue:    { fg: 'var(--cyber-blue)',     rgb: 'var(--cyber-blue-rgb)' },
  magenta: { fg: 'var(--cyber-magenta)',  rgb: 'var(--cyber-magenta-rgb)' },
  amber:   { fg: 'var(--cyber-amber)',    rgb: '217, 119, 6' },
}

export interface NavToolGroup {
  /** Clave estable para i18n — ver messages/{es,en}.json → navCatalog.sections.<id>.groups.<key> */
  key: string
  label: string
  icon: LucideIcon
  tools: string[]
}

export interface NavSection {
  id: string
  label: string
  href: string
  icon: LucideIcon
  color: CyberColor
  description: string
  groups: NavToolGroup[]
}

export interface NavLeaf {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  id: string
  label: string
  color: CyberColor
  sections: NavSection[]
}

// ── SECURITY ────────────────────────────────────────────────────────────────

export const PENTESTING: NavSection = {
  id: 'pentesting',
  label: 'Pentesting',
  href: '/scanner',
  icon: Target,
  color: 'cyan',
  description: 'Evalúa y explota vulnerabilidades en tus objetivos.',
  groups: [
    { key: 'reconocimiento', label: 'Reconocimiento', icon: Radar,   tools: getSkillNames('pentesting', 'reconocimiento') },
    { key: 'enumeracion', label: 'Enumeración',    icon: ListTree, tools: getSkillNames('pentesting', 'enumeracion') },
    { key: 'webSecurity', label: 'Web Security',   icon: ShieldCheck, tools: getSkillNames('pentesting', 'webSecurity') },
    { key: 'authentication', label: 'Authentication', icon: KeyRound, tools: getSkillNames('pentesting', 'authentication') },
    { key: 'sqlInjection', label: 'SQL Injection',  icon: Bug,      tools: getSkillNames('pentesting', 'sqlInjection') },
    { key: 'exploitation', label: 'Exploitation',   icon: Swords,   tools: getSkillNames('pentesting', 'exploitation') },
  ],
}

export const OSINT: NavSection = {
  id: 'osint',
  label: 'OSINT',
  href: '/osint',
  icon: Search,
  color: 'purple',
  description: 'Recopila información pública y descubre lo que otros no ven.',
  groups: [
    { key: 'personas', label: 'Personas', icon: UserSearch, tools: getSkillNames('osint', 'personas') },
    { key: 'dominios', label: 'Dominios',  icon: Globe2,     tools: getSkillNames('osint', 'dominios') },
    { key: 'breaches', label: 'Breaches',  icon: ShieldAlert, tools: getSkillNames('osint', 'breaches') },
  ],
}

// Huella Digital corre como fase del mismo Web Scan (ver scan-progress.tsx:
// TOOL_ORDER incluye 'Huella Digital' → VirusTotal, AbuseIPDB, crt.sh,
// Safe Browsing, testssl, dnstwist), por eso comparte href con Pentesting.
export const HUELLA_DIGITAL: NavSection = {
  id: 'huella-digital',
  label: 'Huella Digital',
  href: '/scanner',
  icon: Fingerprint,
  color: 'emerald',
  description: 'Analiza la exposición y huella en internet de tus activos.',
  groups: [
    { key: 'dominios', label: 'Dominios',        icon: Globe2,  tools: getSkillNames('huella-digital', 'dominios') },
    { key: 'infraestructura', label: 'Infraestructura', icon: Network, tools: getSkillNames('huella-digital', 'infraestructura') },
    { key: 'reputacion', label: 'Reputación',      icon: ShieldAlert, tools: getSkillNames('huella-digital', 'reputacion') },
    { key: 'tlsSsl', label: 'TLS / SSL',       icon: Lock,    tools: getSkillNames('huella-digital', 'tlsSsl') },
  ],
}

export const CODE_SECURITY: NavSection = {
  id: 'code-security',
  label: 'Code Security',
  href: '/code-scan',
  icon: Code2,
  color: 'blue',
  description: 'Analiza tu código y dependencias en busca de riesgos.',
  groups: [
    { key: 'secrets', label: 'Secrets',      icon: KeySquare,  tools: getSkillNames('code-security', 'secrets') },
    { key: 'sast', label: 'SAST',         icon: ScanSearch, tools: getSkillNames('code-security', 'sast') },
    { key: 'backdoors', label: 'Backdoors',    icon: Eye,        tools: getSkillNames('code-security', 'backdoors') },
    { key: 'dependencies', label: 'Dependencies', icon: FileWarning, tools: getSkillNames('code-security', 'dependencies') },
    { key: 'containers', label: 'Containers',   icon: Box,        tools: getSkillNames('code-security', 'containers') },
  ],
}

export const SECURITY_GROUP: NavGroup = {
  id: 'security',
  label: 'Security',
  color: 'cyan',
  sections: [PENTESTING, OSINT, HUELLA_DIGITAL, CODE_SECURITY],
}

// ── LABORATORIOS ─────────────────────────────────────────────────────────────

export const LABS: NavSection = {
  id: 'laboratorios',
  label: 'Laboratorios',
  href: '/lab',
  icon: FlaskConical,
  color: 'magenta',
  description: 'Practica en entornos seguros y aprende con escenarios reales.',
  groups: [
    { key: 'entornos', label: 'Entornos', icon: FlaskConical, tools: ['DVWA', 'OWASP Juice Shop', 'WebGoat'] },
  ],
}

export const LABS_GROUP: NavGroup = {
  id: 'labs',
  label: 'Laboratorios',
  color: 'magenta',
  sections: [LABS],
}

// ── ANÁLISIS (rutas reales: /history, /history/compare, /history/timeline) ──

export const ANALYSIS: NavSection = {
  id: 'analisis',
  label: 'Análisis',
  href: '/history',
  icon: BarChart3,
  color: 'amber',
  description: 'Convierte los resultados en información valiosa y accionable.',
  groups: [
    { key: 'findingsRiskScoring', label: 'Findings & Risk Scoring', icon: TrendingUp, tools: ['Historial de hallazgos'] },
    { key: 'compararAnalisis', label: 'Comparar Análisis',       icon: GitCompare, tools: ['Comparar escaneos'] },
    { key: 'reportes', label: 'Reportes',                icon: FileText,   tools: ['Exportar reporte'] },
  ],
}

export const ANALYSIS_LEAVES: NavLeaf[] = [
  { id: 'findings',  label: 'Findings',          href: '/history',          icon: TrendingUp },
  { id: 'compare',   label: 'Comparar Análisis',  href: '/history/compare',  icon: GitCompare },
  { id: 'timeline',  label: 'Tendencias',         href: '/history/timeline', icon: BarChart3 },
]

export const ANALYSIS_GROUP: NavGroup = {
  id: 'analysis',
  label: 'Análisis',
  color: 'amber',
  sections: [ANALYSIS],
}

// ── OPERACIONES ───────────────────────────────────────────────────────────────

export const OPERATIONS_LEAVES: NavLeaf[] = [
  { id: 'historial',    label: 'Historial',            href: '/history',                 icon: History },
  { id: 'schedules',    label: 'Escaneos Programados',  href: '/schedules',               icon: CalendarClock },
  { id: 'notifications',label: 'Notificaciones',        href: '/settings/notifications',  icon: Bell },
  { id: 'settings',     label: 'Configuración',         href: '/settings/notifications',  icon: Sliders },
]

export const OPERATIONS: NavSection = {
  id: 'operaciones',
  label: 'Operaciones',
  href: '/history',
  icon: Settings2,
  color: 'cyan',
  description: 'Gestiona tus escaneos, historial y configuración.',
  groups: [
    { key: 'historial', label: 'Historial', icon: History, tools: ['Historial de escaneos'] },
    { key: 'programacion', label: 'Programación', icon: CalendarClock, tools: ['Escaneos programados'] },
    { key: 'notificaciones', label: 'Notificaciones', icon: Bell, tools: ['Alertas y notificaciones'] },
  ],
}

// ── TOP LEVEL ─────────────────────────────────────────────────────────────────

export const TOP_LEAVES: NavLeaf[] = [
  { id: 'inicio',    label: 'Inicio',    href: '/',          icon: Home },
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
]

export const DOCS_LEAF: NavLeaf = { id: 'docs', label: 'Documentación', href: '/docs', icon: BookOpen }

export const ALL_SECTIONS: NavSection[] = [PENTESTING, OSINT, HUELLA_DIGITAL, CODE_SECURITY, LABS, ANALYSIS, OPERATIONS]

export const ALL_GROUPS: NavGroup[] = [SECURITY_GROUP, LABS_GROUP, ANALYSIS_GROUP]
