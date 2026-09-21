// lib/skills.ts — SecureScan Pro v5.0
//
// SKILL REGISTRY — fuente ÚNICA de metadata estructural de cada herramienta
// de seguridad ("Skill") disponible en el frontend.
//
// Antes de este archivo, la misma información vivía repetida en 4 lugares
// (lib/nav-config.tsx, lib/tool-docs.ts, components/tool-icons.tsx,
// app/scanner/page.tsx → TOOL_META), cada uno con el nombre de la
// herramienta como string suelto sin validar entre sí. Este archivo es
// ahora el origen de verdad; los demás lo consumen (ver comentarios en
// cada uno) en vez de repetir los datos.
//
// QUÉ *NO* VIVE AQUÍ (a propósito):
//   - El texto traducido (descripción, features) — vive en
//     messages/{es,en}.json. Este archivo solo guarda la CLAVE i18n
//     (`docsKey`), nunca el string literal, para no crear una segunda
//     fuente de contenido traducible.
//   - La extracción de resultados reales del backend (qué campo de
//     `currentScan` corresponde a qué herramienta) — eso sigue en
//     app/scanner/page.tsx (`extractToolStats`), porque es lógica de
//     EJECUCIÓN acoplada al contrato real del backend, no metadata de
//     catálogo. Registrar una Skill aquí NO la conecta al backend.
//
// REGISTRAR una Skill (agregarla a SKILLS) es distinto de INTEGRARLA
// (que el backend realmente la ejecute). Ver docs/adding-a-skill.md.

import type { LucideIcon } from 'lucide-react'
import {
  Radar, ListTree, ShieldCheck, KeyRound, Bug, Swords,
  UserSearch, Globe2, ShieldAlert, Network, Lock,
  KeySquare, ScanSearch, Eye, FileWarning, Box,
} from 'lucide-react'
import type { CyberColor } from '@/lib/nav-config'

/** Categoría real = NavSection.id (lib/nav-config.tsx). No se inventa taxonomía nueva. */
export type SkillCategory = 'pentesting' | 'osint' | 'huella-digital' | 'code-security'

/**
 * 'available'  → el backend ya la ejecuta de verdad (las 29 actuales).
 * 'planned'    → está catalogada para poder mostrarse/documentarse en el
 *                futuro, pero el backend TODAVÍA no la implementa. El
 *                frontend nunca debe fingir que una Skill 'planned' se
 *                puede ejecutar (sin botón de acción, sin resultados).
 */
export type SkillStatus = 'available' | 'planned'

export type TargetType = 'domain' | 'ip' | 'url' | 'username' | 'email' | 'repo' | 'zip' | 'image'

export interface SkillDocs {
  /** Clave en messages/{es,en}.json → docs.<key> */
  descriptionKey: string
  /** Claves en messages/{es,en}.json → docs.<key>, en orden */
  featureKeys: string[]
  /** Comando/uso real, no traducido (es código, no prosa) */
  usage: string
  /** URL de documentación oficial de la herramienta (no de SecureScan) */
  documentationUrl: string
}

export interface Skill {
  id: string
  name: string
  category: SkillCategory
  /** Debe existir como `key` en el group correspondiente de nav-config.tsx */
  subgroup: string
  status: SkillStatus
  /** Icono lucide de respaldo — se usa cuando no hay logo custom en tool-icons.tsx */
  icon: LucideIcon
  /**
   * Clave en components/tool-icons.tsx → TOOL_ICONS[svgIconKey]. Opcional:
   * no todas las Skills tienen logo custom dibujado a mano.
   */
  svgIconKey?: string
  /** Documentación real (solo si existe contenido real — nunca inventar) */
  docs?: SkillDocs
  /** Tipos de target que la herramienta acepta, solo donde es evidente por el formulario real */
  targetSupport?: TargetType[]
  /** Etiquetas libres, decorativas — no consumidas por ninguna UI todavía */
  tags?: string[]
  /** Orden visual dentro de su subgroup (menor = primero). Si se omite, se usa el orden de inserción. */
  order?: number
  /** Prerrequisitos conocidos (ninguno documentado hoy para las 29 actuales) */
  requirements?: string[]
  /** Bolsa libre para metadata futura sin tener que tocar la interfaz */
  meta?: Record<string, unknown>
}

/** color visual de una Skill = el color de su categoría (lib/nav-config.tsx → COLOR_VARS) */
export const CATEGORY_COLOR: Record<SkillCategory, CyberColor> = {
  pentesting: 'cyan',
  osint: 'purple',
  'huella-digital': 'emerald',
  'code-security': 'blue',
}

/** ruta real de una Skill = la ruta de su categoría (lib/nav-config.tsx → NavSection.href) */
export const CATEGORY_ROUTE: Record<SkillCategory, string> = {
  pentesting: '/scanner',
  osint: '/osint',
  'huella-digital': '/scanner',
  'code-security': '/code-scan',
}

// ─── SKILLS ────────────────────────────────────────────────────────────────
// Las 29 herramientas reales que el backend ya ejecuta hoy. Nombres, ids y
// subgroups verificados contra lib/nav-config.tsx, lib/tool-docs.ts,
// components/tool-icons.tsx y app/scanner/page.tsx antes de escribir esto.

export const SKILLS: Skill[] = [
  // ── Pentesting ──────────────────────────────────────────────────────────
  { id: 'wappalyzer', name: 'Wappalyzer', category: 'pentesting', subgroup: 'reconocimiento', status: 'available', icon: Radar, svgIconKey: 'Wappalyzer',
    docs: { descriptionKey: 'tool1Desc', featureKeys: ['tool1Feature1','tool1Feature2','tool1Feature3','tool1Feature4','tool1Feature5'],
      usage: `# Wappalyzer via librería Python\nfrom Wappalyzer import Wappalyzer, WebPage\nwappalyzer = Wappalyzer.latest()\nwebpage = WebPage.new_from_url('https://target.com')\ntechs = wappalyzer.analyze_with_versions(webpage)`,
      documentationUrl: 'https://github.com/wappalyzer/wappalyzer' },
    targetSupport: ['domain', 'url'] },
  { id: 'nmap', name: 'Nmap', category: 'pentesting', subgroup: 'reconocimiento', status: 'available', icon: Radar, svgIconKey: 'Nmap',
    docs: { descriptionKey: 'tool2Desc', featureKeys: ['tool2Feature1','tool2Feature2','tool2Feature3','tool2Feature4','tool2Feature5'],
      usage: `# Escaneo de puertos comunes\nnmap -sV -sC target.com\n\n# Escaneo agresivo\nnmap -A -T4 target.com\n\n# Scripts NSE de vulnerabilidades\nnmap --script vuln target.com`,
      documentationUrl: 'https://nmap.org/book/man.html' },
    targetSupport: ['domain', 'ip'] },
  { id: 'gobuster', name: 'Gobuster', category: 'pentesting', subgroup: 'enumeracion', status: 'available', icon: ListTree, svgIconKey: 'Gobuster',
    docs: { descriptionKey: 'tool6Desc', featureKeys: ['tool6Feature1','tool6Feature2','tool6Feature3','tool6Feature4','tool6Feature5'],
      usage: `# Fuerza bruta de directorios\ngobuster dir -u https://target.com -w wordlist.txt\n\n# Descubrimiento DNS\ngobuster dns -d target.com -w subdomains.txt`,
      documentationUrl: 'https://github.com/OJ/gobuster' },
    targetSupport: ['domain', 'url'] },
  { id: 'ffuf', name: 'ffuf', category: 'pentesting', subgroup: 'enumeracion', status: 'available', icon: ListTree, svgIconKey: 'ffuf',
    docs: { descriptionKey: 'tool5Desc', featureKeys: ['tool5Feature1','tool5Feature2','tool5Feature3','tool5Feature4','tool5Feature5'],
      usage: `# Fuerza bruta de directorios\nffuf -u https://target.com/FUZZ -w wordlist.txt\n\n# Fuzzing de parámetros GET\nffuf -u https://target.com/page?FUZZ=value -w params.txt`,
      documentationUrl: 'https://github.com/ffuf/ffuf' },
    targetSupport: ['domain', 'url'] },
  { id: 'zap', name: 'OWASP ZAP', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck, svgIconKey: 'OWASP ZAP',
    docs: { descriptionKey: 'tool7Desc', featureKeys: ['tool7Feature1','tool7Feature2','tool7Feature3','tool7Feature4','tool7Feature5'],
      usage: `# API - Spider\ncurl "http://localhost:8080/JSON/spider/action/scan/?url=https://target.com"\n\n# API - Active Scan\ncurl "http://localhost:8080/JSON/ascan/action/scan/?url=https://target.com"`,
      documentationUrl: 'https://www.zaproxy.org/docs/' },
    targetSupport: ['domain', 'url'] },
  { id: 'zap-spider', name: 'ZAP Spider', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck, svgIconKey: 'ZAP Spider',
    targetSupport: ['domain', 'url'] },
  { id: 'nuclei', name: 'Nuclei', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck, svgIconKey: 'Nuclei',
    docs: { descriptionKey: 'tool8Desc', featureKeys: ['tool8Feature1','tool8Feature2','tool8Feature3','tool8Feature4','tool8Feature5'],
      usage: `# Escaneo con todas las plantillas\nnuclei -u https://target.com\n\n# Por severidad\nnuclei -u https://target.com -severity critical,high\n\n# Con cookie\nnuclei -u https://target.com -H "Cookie: session=abc"`,
      documentationUrl: 'https://docs.projectdiscovery.io/tools/nuclei' },
    targetSupport: ['domain', 'url'] },
  { id: 'injection-scanner', name: 'Injection Scanner', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck,
    targetSupport: ['domain', 'url'] },
  { id: 'patator', name: 'Patator', category: 'pentesting', subgroup: 'authentication', status: 'available', icon: KeyRound, svgIconKey: 'Patator',
    docs: { descriptionKey: 'tool3Desc', featureKeys: ['tool3Feature1','tool3Feature2','tool3Feature3','tool3Feature4','tool3Feature5'],
      usage: `# Fuerza bruta HTTP POST\npatator http_fuzz url=https://target.com/login method=POST \\\n  body='user=FILE0&pass=FILE1' 0=users.txt 1=passwords.txt`,
      documentationUrl: 'https://github.com/lanjelot/patator' },
    targetSupport: ['url'] },
  { id: 'sqlmap', name: 'SQLMap', category: 'pentesting', subgroup: 'sqlInjection', status: 'available', icon: Bug, svgIconKey: 'SQLMap',
    docs: { descriptionKey: 'tool9Desc', featureKeys: ['tool9Feature1','tool9Feature2','tool9Feature3','tool9Feature4','tool9Feature5'],
      usage: `# URL con parámetro\nsqlmap -u "https://target.com/page?id=1"\n\n# Con cookie de sesión\nsqlmap -u "https://target.com/page?id=1" --cookie="session=abc"\n\n# Formulario POST\nsqlmap -u "https://target.com/login" --data="user=admin&pass=test"`,
      documentationUrl: 'https://sqlmap.org/' },
    targetSupport: ['url'] },
  { id: 'metasploit', name: 'Metasploit', category: 'pentesting', subgroup: 'exploitation', status: 'available', icon: Swords, svgIconKey: 'Metasploit',
    docs: { descriptionKey: 'tool4Desc', featureKeys: ['tool4Feature1','tool4Feature2','tool4Feature3','tool4Feature4','tool4Feature5'],
      usage: `# Iniciar msfconsole\nmsfconsole\n\n# Usar módulo auxiliar (solo scanners)\nmsf> use auxiliary/scanner/http/http_version\nmsf> set RHOSTS target.com\nmsf> run`,
      documentationUrl: 'https://docs.metasploit.com/' },
    targetSupport: ['domain', 'ip'] },
  { id: 'searchsploit', name: 'Searchsploit', category: 'pentesting', subgroup: 'exploitation', status: 'available', icon: Swords, svgIconKey: 'Searchsploit',
    docs: { descriptionKey: 'tool10Desc', featureKeys: ['tool10Feature1','tool10Feature2','tool10Feature3','tool10Feature4','tool10Feature5'],
      usage: `# Buscar por servicio y versión\nsearchsploit apache 2.4\n\n# Formato JSON\nsearchsploit -j wordpress 5.8\n\n# Búsqueda exacta\nsearchsploit -e "Apache 2.4.49"`,
      documentationUrl: 'https://www.exploit-db.com/searchsploit' } },

  // ── OSINT ───────────────────────────────────────────────────────────────
  { id: 'username-search', name: 'Username Search', category: 'osint', subgroup: 'personas', status: 'available', icon: UserSearch,
    targetSupport: ['username'] },
  { id: 'sherlock', name: 'Sherlock', category: 'osint', subgroup: 'personas', status: 'available', icon: UserSearch,
    targetSupport: ['username'] },
  { id: 'theharvester', name: 'theHarvester', category: 'osint', subgroup: 'dominios', status: 'available', icon: Globe2,
    targetSupport: ['domain'] },
  { id: 'xposedornot', name: 'XposedOrNot', category: 'osint', subgroup: 'breaches', status: 'available', icon: ShieldAlert,
    targetSupport: ['email'] },

  // ── Huella Digital ──────────────────────────────────────────────────────
  { id: 'crtsh', name: 'crt.sh', category: 'huella-digital', subgroup: 'dominios', status: 'available', icon: Globe2,
    targetSupport: ['domain'] },
  { id: 'dnstwist', name: 'dnstwist', category: 'huella-digital', subgroup: 'dominios', status: 'available', icon: Globe2,
    targetSupport: ['domain'] },
  { id: 'shodan', name: 'Shodan', category: 'huella-digital', subgroup: 'infraestructura', status: 'available', icon: Network,
    targetSupport: ['domain', 'ip'] },
  { id: 'virustotal', name: 'VirusTotal', category: 'huella-digital', subgroup: 'reputacion', status: 'available', icon: ShieldAlert,
    targetSupport: ['domain', 'ip', 'url'] },
  { id: 'abuseipdb', name: 'AbuseIPDB', category: 'huella-digital', subgroup: 'reputacion', status: 'available', icon: ShieldAlert,
    targetSupport: ['ip'] },
  { id: 'safebrowsing', name: 'Google Safe Browsing', category: 'huella-digital', subgroup: 'reputacion', status: 'available', icon: ShieldAlert,
    targetSupport: ['domain', 'url'] },
  { id: 'testssl', name: 'testssl.sh', category: 'huella-digital', subgroup: 'tlsSsl', status: 'available', icon: Lock,
    targetSupport: ['domain'] },

  // ── Code Security ───────────────────────────────────────────────────────
  { id: 'gitleaks', name: 'Gitleaks', category: 'code-security', subgroup: 'secrets', status: 'available', icon: KeySquare,
    targetSupport: ['repo', 'zip'] },
  { id: 'trufflehog', name: 'TruffleHog', category: 'code-security', subgroup: 'secrets', status: 'available', icon: KeySquare,
    targetSupport: ['repo', 'zip'] },
  { id: 'semgrep', name: 'Semgrep', category: 'code-security', subgroup: 'sast', status: 'available', icon: ScanSearch,
    targetSupport: ['repo', 'zip'] },
  { id: 'backdoor-scanner', name: 'Backdoor Scanner', category: 'code-security', subgroup: 'backdoors', status: 'available', icon: Eye,
    targetSupport: ['repo', 'zip'] },
  { id: 'dependency-check', name: 'Dependency-Check', category: 'code-security', subgroup: 'dependencies', status: 'available', icon: FileWarning,
    targetSupport: ['repo', 'zip'] },
  { id: 'trivy', name: 'Trivy', category: 'code-security', subgroup: 'containers', status: 'available', icon: Box,
    targetSupport: ['repo', 'zip', 'image'] },
]

// ─── Helpers de consulta ────────────────────────────────────────────────────

export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return SKILLS.filter(s => s.category === category)
}

export function getSkillsBySubgroup(category: SkillCategory, subgroup: string): Skill[] {
  return SKILLS.filter(s => s.category === category && s.subgroup === subgroup)
}

export function getSkillById(id: string): Skill | undefined {
  return SKILLS.find(s => s.id === id)
}

/** Nombres de las Skills de un subgroup, en el orden del registro — esto es lo que antes se escribía a mano en cada `NavToolGroup.tools`. */
export function getSkillNames(category: SkillCategory, subgroup: string): string[] {
  return getSkillsBySubgroup(category, subgroup).map(s => s.name)
}
