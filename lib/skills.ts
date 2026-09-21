// lib/skills.ts — SecureScan Pro v5.0
//
// SKILL REGISTRY — fuente ÚNICA de metadata estructural de cada herramienta
// de seguridad ("Skill") disponible en el frontend.
//
// Antes de este archivo, la misma información vivía repetida en 4 lugares
// (lib/nav-config.tsx, lib/tool-docs.ts, components/tool-icons.tsx,
// app/scanner/page.tsx → TOOL_META, ya eliminado), cada uno con el nombre de la
// herramienta como string suelto sin validar entre sí. Este archivo es
// ahora el origen de verdad; los demás lo consumen (ver comentarios en
// cada uno) en vez de repetir los datos.
//
// QUÉ *NO* VIVE AQUÍ (a propósito):
//   - El texto traducido. Vive en messages/{es,en}.json bajo una convención
//     por id (ver SKILL_TEXT_NAMESPACE abajo): `skills.<id>.short`,
//     `skills.<id>.description`, `skills.<id>.features[]`. El Registry no
//     guarda claves ni strings traducibles: agregar una Skill no exige
//     inventar numeración ni elegir entre varios namespaces.
//   - La extracción de resultados reales del backend (qué campo de
//     `currentScan` corresponde a qué herramienta, qué paso del pipeline
//     reporta su estado) — eso vive en lib/scan-extractors.ts
//     (`getPentestingToolStats`, `getFootprintModel`), porque es lógica de
//     EJECUCIÓN acoplada al contrato real del backend, no metadata de
//     catálogo. Las páginas /scanner (Pentesting) y /footprint (Huella
//     Digital) derivan sus herramientas de este Registry a través de ese
//     archivo. Registrar una Skill aquí NO la conecta al backend.
//   - Color y ruta de la categoría: ya viven en lib/nav-config.tsx
//     (NavSection.color / NavSection.href) — no se duplican aquí.
//
// ESTADO (`status`) — semántica real, aplicada por los helpers de abajo:
//   - 'available' → el backend ya la ejecuta. Aparece en navegación,
//     búsqueda, conteos, /docs, ToolGrid y selectores.
//   - 'planned'   → catalogada, SIN capacidad real todavía. Los helpers de
//     consulta NO la devuelven, así que no aparece en ninguna superficie
//     ejecutable ni en /docs, y no puede llevar `docs` (no se documenta lo
//     que no existe). Ver scripts/check-skills.mjs.
//
// REGISTRAR una Skill (agregarla a SKILLS) es distinto de INTEGRARLA
// (que el backend realmente la ejecute). Ver public/docs/adding-a-skill.md.

import type { LucideIcon } from 'lucide-react'
import {
  Radar, ListTree, ShieldCheck, KeyRound, Bug, Swords,
  UserSearch, Globe2, ShieldAlert, Network, Lock,
  KeySquare, ScanSearch, Eye, FileWarning, Box,
} from 'lucide-react'

/** Categoría real = NavSection.id (lib/nav-config.tsx). No se inventa taxonomía nueva. */
export type SkillCategory = 'pentesting' | 'osint' | 'huella-digital' | 'code-security'

/**
 * 'available' → el backend ya la ejecuta de verdad (las 29 actuales).
 * 'planned'   → catalogada pero SIN capacidad real: los helpers de consulta
 *               la excluyen, por lo que ninguna UI puede mostrarla como
 *               ejecutable. No puede tener `docs`.
 */
export type SkillStatus = 'available' | 'planned'

export type TargetType = 'domain' | 'ip' | 'url' | 'username' | 'email' | 'repo' | 'zip' | 'image'

export interface SkillDocs {
  /** Comando/uso real, no traducido (es código, no prosa) */
  usage: string
  /** URL de documentación oficial de la herramienta (no de SecureScan) */
  documentationUrl: string
}

/**
 * Convención i18n por id de Skill (messages/{es,en}.json → "skills"):
 *   skills.<id>.short        una línea (ToolCards, form, cobertura)  — TODAS
 *   skills.<id>.description  párrafo de /docs y del drawer            — solo con `docs`
 *   skills.<id>.features     lista de puntos de /docs y del drawer    — solo con `docs`
 * scripts/check-skills.mjs verifica que existan en ES y EN.
 */
export const SKILL_TEXT_NAMESPACE = 'skills'

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
  /** Documentación real (solo si existe contenido real — nunca inventar; nunca en `planned`) */
  docs?: SkillDocs
  /** Tipos de target que la herramienta acepta, solo donde es evidente por el formulario real */
  targetSupport?: TargetType[]
}

// ─── SKILLS ────────────────────────────────────────────────────────────────
// Las 29 herramientas reales que el backend ya ejecuta hoy. Nombres, ids y
// subgroups verificados contra lib/nav-config.tsx, lib/tool-docs.ts,
// components/tool-icons.tsx y app/scanner/page.tsx antes de escribir esto.

export const SKILLS: Skill[] = [
  // ── Pentesting ──────────────────────────────────────────────────────────
  { id: 'wappalyzer', name: 'Wappalyzer', category: 'pentesting', subgroup: 'reconocimiento', status: 'available', icon: Radar, svgIconKey: 'Wappalyzer',
    docs: {
      usage: `# Wappalyzer via librería Python\nfrom Wappalyzer import Wappalyzer, WebPage\nwappalyzer = Wappalyzer.latest()\nwebpage = WebPage.new_from_url('https://target.com')\ntechs = wappalyzer.analyze_with_versions(webpage)`,
      documentationUrl: 'https://github.com/wappalyzer/wappalyzer' },
    targetSupport: ['domain', 'url'] },
  { id: 'nmap', name: 'Nmap', category: 'pentesting', subgroup: 'reconocimiento', status: 'available', icon: Radar, svgIconKey: 'Nmap',
    docs: {
      usage: `# Escaneo de puertos comunes\nnmap -sV -sC target.com\n\n# Escaneo agresivo\nnmap -A -T4 target.com\n\n# Scripts NSE de vulnerabilidades\nnmap --script vuln target.com`,
      documentationUrl: 'https://nmap.org/book/man.html' },
    targetSupport: ['domain', 'ip'] },
  { id: 'gobuster', name: 'Gobuster', category: 'pentesting', subgroup: 'enumeracion', status: 'available', icon: ListTree, svgIconKey: 'Gobuster',
    docs: {
      usage: `# Fuerza bruta de directorios\ngobuster dir -u https://target.com -w wordlist.txt\n\n# Descubrimiento DNS\ngobuster dns -d target.com -w subdomains.txt`,
      documentationUrl: 'https://github.com/OJ/gobuster' },
    targetSupport: ['domain', 'url'] },
  { id: 'ffuf', name: 'ffuf', category: 'pentesting', subgroup: 'enumeracion', status: 'available', icon: ListTree, svgIconKey: 'ffuf',
    docs: {
      usage: `# Fuerza bruta de directorios\nffuf -u https://target.com/FUZZ -w wordlist.txt\n\n# Fuzzing de parámetros GET\nffuf -u https://target.com/page?FUZZ=value -w params.txt`,
      documentationUrl: 'https://github.com/ffuf/ffuf' },
    targetSupport: ['domain', 'url'] },
  { id: 'zap', name: 'OWASP ZAP', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck, svgIconKey: 'OWASP ZAP',
    docs: {
      usage: `# API - Spider\ncurl "http://localhost:8080/JSON/spider/action/scan/?url=https://target.com"\n\n# API - Active Scan\ncurl "http://localhost:8080/JSON/ascan/action/scan/?url=https://target.com"`,
      documentationUrl: 'https://www.zaproxy.org/docs/' },
    targetSupport: ['domain', 'url'] },
  { id: 'zap-spider', name: 'ZAP Spider', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck, svgIconKey: 'ZAP Spider',
    docs: {
      usage: `# API de ZAP — iniciar el Spider\ncurl "http://localhost:8080/JSON/spider/action/scan/?url=https://target.com"\n\n# Estado del Spider\ncurl "http://localhost:8080/JSON/spider/view/status/?scanId=0"`,
      documentationUrl: 'https://www.zaproxy.org/docs/desktop/start/features/spider/' },
    targetSupport: ['domain', 'url'] },
  { id: 'nuclei', name: 'Nuclei', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck, svgIconKey: 'Nuclei',
    docs: {
      usage: `# Escaneo con todas las plantillas\nnuclei -u https://target.com\n\n# Por severidad\nnuclei -u https://target.com -severity critical,high\n\n# Con cookie\nnuclei -u https://target.com -H "Cookie: session=abc"`,
      documentationUrl: 'https://docs.projectdiscovery.io/tools/nuclei' },
    targetSupport: ['domain', 'url'] },
  { id: 'injection-scanner', name: 'Injection Scanner', category: 'pentesting', subgroup: 'webSecurity', status: 'available', icon: ShieldCheck,
    docs: {
      usage: `# Módulo propio de SecureScan (server/modules/injection_scanner.py): no tiene CLI.\n# Se activa con la opción SQLMap del formulario de Pentesting.\n# Técnicas: SQLi · NoSQLi · XPath · XXE · XSS · CMDi · Path Traversal · SSRF · SSTI · LDAP`,
      documentationUrl: 'https://github.com/Marlonmorenolopez/SecureScan' },
    targetSupport: ['domain', 'url'] },
  { id: 'patator', name: 'Patator', category: 'pentesting', subgroup: 'authentication', status: 'available', icon: KeyRound, svgIconKey: 'Patator',
    docs: {
      usage: `# Fuerza bruta HTTP POST\npatator http_fuzz url=https://target.com/login method=POST \\\n  body='user=FILE0&pass=FILE1' 0=users.txt 1=passwords.txt`,
      documentationUrl: 'https://github.com/lanjelot/patator' },
    targetSupport: ['url'] },
  { id: 'sqlmap', name: 'SQLMap', category: 'pentesting', subgroup: 'sqlInjection', status: 'available', icon: Bug, svgIconKey: 'SQLMap',
    docs: {
      usage: `# URL con parámetro\nsqlmap -u "https://target.com/page?id=1"\n\n# Con cookie de sesión\nsqlmap -u "https://target.com/page?id=1" --cookie="session=abc"\n\n# Formulario POST\nsqlmap -u "https://target.com/login" --data="user=admin&pass=test"`,
      documentationUrl: 'https://sqlmap.org/' },
    targetSupport: ['url'] },
  { id: 'metasploit', name: 'Metasploit', category: 'pentesting', subgroup: 'exploitation', status: 'available', icon: Swords, svgIconKey: 'Metasploit',
    docs: {
      usage: `# Iniciar msfconsole\nmsfconsole\n\n# Usar módulo auxiliar (solo scanners)\nmsf> use auxiliary/scanner/http/http_version\nmsf> set RHOSTS target.com\nmsf> run`,
      documentationUrl: 'https://docs.metasploit.com/' },
    targetSupport: ['domain', 'ip'] },
  { id: 'searchsploit', name: 'Searchsploit', category: 'pentesting', subgroup: 'exploitation', status: 'available', icon: Swords, svgIconKey: 'Searchsploit',
    docs: {
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
    docs: {
      usage: `# Subdominios en logs de Certificate Transparency\ncurl "https://crt.sh/?q=%25.example.com&output=json"`,
      documentationUrl: 'https://crt.sh/' },
    targetSupport: ['domain'] },
  { id: 'dnstwist', name: 'dnstwist', category: 'huella-digital', subgroup: 'dominios', status: 'available', icon: Globe2,
    docs: {
      usage: `# Variantes del dominio que ya están registradas\ndnstwist --registered example.com`,
      documentationUrl: 'https://github.com/elceef/dnstwist' },
    targetSupport: ['domain'] },
  { id: 'shodan', name: 'Shodan', category: 'huella-digital', subgroup: 'infraestructura', status: 'available', icon: Network,
    docs: {
      usage: `# Shodan InternetDB (gratis, sin API key, solo IPs)\ncurl https://internetdb.shodan.io/8.8.8.8`,
      documentationUrl: 'https://internetdb.shodan.io/' },
    targetSupport: ['domain', 'ip'] },
  { id: 'virustotal', name: 'VirusTotal', category: 'huella-digital', subgroup: 'reputacion', status: 'available', icon: ShieldAlert,
    docs: {
      usage: `# Reporte existente de un dominio (requiere VIRUSTOTAL_API_KEY)\ncurl -H "x-apikey: $VIRUSTOTAL_API_KEY" https://www.virustotal.com/api/v3/domains/example.com`,
      documentationUrl: 'https://docs.virustotal.com/reference/overview' },
    targetSupport: ['domain', 'ip', 'url'] },
  { id: 'abuseipdb', name: 'AbuseIPDB', category: 'huella-digital', subgroup: 'reputacion', status: 'available', icon: ShieldAlert,
    docs: {
      usage: `# Reputación de una IP (requiere ABUSEIPDB_API_KEY)\ncurl -G https://api.abuseipdb.com/api/v2/check \\\n  --data-urlencode "ipAddress=8.8.8.8" \\\n  -H "Key: $ABUSEIPDB_API_KEY" -H "Accept: application/json"`,
      documentationUrl: 'https://docs.abuseipdb.com/' },
    targetSupport: ['ip'] },
  { id: 'safebrowsing', name: 'Google Safe Browsing', category: 'huella-digital', subgroup: 'reputacion', status: 'available', icon: ShieldAlert,
    docs: {
      usage: `# threatMatches:find (requiere GOOGLE_SAFE_BROWSING_API_KEY)\n# POST https://safebrowsing.googleapis.com/v4/threatMatches:find?key=$GOOGLE_SAFE_BROWSING_API_KEY\n# threatEntryTypes: URL · platformTypes: ANY_PLATFORM\n# threatEntries: [{"url": "https://example.com/"}]`,
      documentationUrl: 'https://developers.google.com/safe-browsing/v4' },
    targetSupport: ['domain', 'url'] },
  { id: 'testssl', name: 'testssl.sh', category: 'huella-digital', subgroup: 'tlsSsl', status: 'available', icon: Lock,
    docs: {
      usage: `# Protocolos (-p), defaults del servidor/certificado (-S) y vulnerabilidades (-U)\ntestssl.sh -U -S -p example.com`,
      documentationUrl: 'https://testssl.sh/' },
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
// Todos los helpers de listado devuelven SOLO Skills 'available'. Así una
// Skill 'planned' nunca llega a la navegación, a la búsqueda, a los conteos,
// a /docs, al ToolGrid ni a los selectores de fuentes (que enviarían un id
// inexistente al backend). `getSkillById` sí resuelve cualquier Skill.

const isAvailable = (s: Skill) => s.status === 'available'

/** Skills ejecutables (status 'available'), en el orden del registro. */
export const AVAILABLE_SKILLS: Skill[] = SKILLS.filter(isAvailable)

export function getSkillsByCategory(category: SkillCategory): Skill[] {
  return AVAILABLE_SKILLS.filter(s => s.category === category)
}

export function getSkillsBySubgroup(category: SkillCategory, subgroup: string): Skill[] {
  return AVAILABLE_SKILLS.filter(s => s.category === category && s.subgroup === subgroup)
}

/** Cualquier Skill del catálogo (incluye 'planned'); undefined si el id no existe. */
export function getSkillById(id: string): Skill | undefined {
  return SKILLS.find(s => s.id === id)
}

/** Nombres de las Skills de un subgroup, en el orden del registro — lo que alimenta `NavToolGroup.tools`. */
export function getSkillNames(category: SkillCategory, subgroup: string): string[] {
  return getSkillsBySubgroup(category, subgroup).map(s => s.name)
}
