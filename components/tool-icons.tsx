/**
 * tool-icons.tsx — Logos SVG basados en las marcas originales de ciberseguridad
 *
 * Diseño gráfico optimizado y fiel a la identidad de cada herramienta y laboratorio.
 * Refactorizado para un tamaño base de h-8 w-8 (32px) y grosores de trazo ajustados.
 *
 * Uso:
 * import { NmapIcon, ZapIcon } from '@/components/tool-icons'
 * <NmapIcon className="h-8 w-8" />
 */

import React from 'react'

interface IconProps {
  className?: string
}

// ── HERRAMIENTAS DE ESCANEO Y ENUMERACIÓN ───────────────────────────────────

// NMAP (Ojo/Radar azul clásico, refactorizado)
export function NmapIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="50" rx="45" ry="30" fill="#0A1C2E" stroke="#1F6D9F" strokeWidth="6"/>
      <circle cx="50" cy="50" r="18" fill="#1F6D9F"/>
      <circle cx="50" cy="50" r="6" fill="#FFFFFF"/>
      <path d="M5 50 Q50 10 95 50" stroke="#1F6D9F" strokeWidth="4" fill="none"/>
    </svg>
  )
}

// OWASP ZAP (Escudo azul oscuro con rayo amarillo, refactorizado)
export function ZapIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L90 20 L90 55 C90 80 50 95 50 95 C50 95 10 80 10 55 L10 20 Z" fill="#00549E" stroke="#003D73" strokeWidth="2.5"/>
      <path d="M58 25 L32 55 L48 55 L40 82 L72 45 L52 45 Z" fill="#F4B400"/>
    </svg>
  )
}

// NUCLEI (ProjectDiscovery - Hexágono azul/morado, refactorizado)
export function NucleiIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" stroke="#0056FF" strokeWidth="8" fill="none" strokeLinejoin="round"/>
      <polygon points="50,25 72,38 72,62 50,75 28,62 28,38" stroke="#0056FF" strokeWidth="3.5" fill="none" strokeLinejoin="round"/>
      <circle cx="50" cy="50" r="8" fill="#0056FF"/>
    </svg>
  )
}

// SQLMAP (Jeringa/DB, refactorizado)
export function SqlmapIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="40" cy="70" rx="25" ry="8" fill="#4B5563"/>
      <path d="M15 50 L15 70 A25 8 0 0 0 65 70 L65 50" fill="#6B7280"/>
      <ellipse cx="40" cy="50" rx="25" ry="8" fill="#4B5563"/>
      <path d="M15 30 L15 50 A25 8 0 0 0 65 50 L65 30" fill="#9CA3AF"/>
      <ellipse cx="40" cy="30" rx="25" ry="8" fill="#D1D5DB"/>
      <path d="M90 10 L75 25 L75 55 L65 65 L60 60 L70 50 L70 20 L85 5 Z" fill="#EF4444"/>
      <line x1="65" y1="65" x2="40" y2="90" stroke="#EF4444" strokeWidth="4.5" strokeLinecap="round"/>
    </svg>
  )
}

// GOBUSTER (Fantasma estilizado amarillo/oscuro, refactorizado)
export function GobusterIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M25 50 C25 20 75 20 75 50 L75 90 L65 80 L50 90 L35 80 L25 90 Z" fill="#FACC15"/>
      <circle cx="40" cy="45" r="5" fill="#111827"/>
      <circle cx="60" cy="45" r="5" fill="#111827"/>
      <path d="M45 60 Q50 65 55 60" stroke="#111827" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// FFUF (MASCOTA REAL - Fuzz Faster U Fool, rediseño Image 2)
// Peludo azul con fuego en la cabeza y tres chispas.
export function FfufIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo circular oscuro */}
      <circle cx="50" cy="50" r="45" fill="#111827"/>
      
      {/* Tres flamas estilizadas (Derivadas de Image 2) */}
      <path d="M48 35 C42 20 48 10 44 5 C52 15 48 25 48 35 Z" fill="#FBBF24"/>
      <path d="M54 35 C50 15 62 8 58 2 C66 12 56 25 54 35 Z" fill="#EF4444"/>
      <path d="M60 38 C58 25 68 18 64 12 C70 20 62 30 60 38 Z" fill="#F97316"/>

      {/* Cuerpo peludo azul */}
      <circle cx="50" cy="52" r="24" fill="#22D3EE"/>
      <circle cx="36" cy="46" r="10" fill="#22D3EE"/>
      <circle cx="64" cy="46" r="10" fill="#22D3EE"/>
      <circle cx="40" cy="66" r="12" fill="#22D3EE"/>
      <circle cx="60" cy="66" r="12" fill="#22D3EE"/>
      <circle cx="32" cy="56" r="11" fill="#22D3EE"/>
      <circle cx="68" cy="56" r="11" fill="#22D3EE"/>
      
      {/* Cara interna */}
      <ellipse cx="50" cy="56" rx="16" ry="13" fill="#FEF3C7"/>

      {/* Ojos y Boca */}
      <circle cx="44" cy="54" r="2" fill="#111827"/>
      <circle cx="56" cy="54" r="2" fill="#111827"/>
      <path d="M48 59 Q50 63 52 59" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" fill="none"/>

      {/* Brazos, Piernas y Chispas */}
      <path d="M30 52 Q20 45 18 35" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M70 52 Q80 58 84 66" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="16" cy="24" r="3" fill="#FACC15"/>
      <circle cx="26" cy="18" r="2" fill="#FACC15"/>
    </svg>
  )
}

// WAPPALYZER (Fondo morado oscuro con W blanca, refactorizado)
export function WappalyzerIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="20" fill="#2E0A6A"/>
      <path d="M20 30 L35 70 L50 40 L65 70 L80 30" stroke="#FFFFFF" strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// METASPLOIT (Escudo azul sólido con la M, refactorizado)
export function MetasploitIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L10 25 L10 65 Q10 85 50 95 Q90 85 90 65 L90 25 Z" fill="#003594"/>
      <path d="M25 65 L25 40 L50 60 L75 40 L75 65 M50 60 L50 85" stroke="#FFFFFF" strokeWidth="9" fill="none" strokeLinejoin="round"/>
    </svg>
  )
}

// SEARCHSPLOIT (LOGOTIPO REAL - Lupa Offensive Security, rediseño Image 1)
export function SearchsploitIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo oscuro premium */}
      <rect width="100" height="100" rx="15" fill="#111827"/>
      
      {/* Lupa Oficial (Derivada de Image 1) */}
      <circle cx="28" cy="50" r="18" stroke="white" strokeWidth="5"/>
      <path d="M41.6 63.6 L60 82" stroke="white" strokeWidth="7" strokeLinecap="round"/>
      
      {/* Texto Oficial SearchSploit stacked */}
      <text x="50" y="45" textAnchor="start" fill="white" fontSize="22" fontFamily="Inter, sans-serif" fontWeight="900">Search</text>
      <text x="50" y="72" textAnchor="start" fill="white" fontSize="22" fontFamily="Inter, sans-serif" fontWeight="900">Sploit</text>
    </svg>
  )
}

// PATATOR (Patata/Fuerza bruta, refactorizado)
export function PatatorIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="50" rx="35" ry="45" fill="#D4A373" stroke="#8B5A2B" strokeWidth="5"/>
      <circle cx="40" cy="35" r="4" fill="#8B5A2B"/>
      <circle cx="65" cy="50" r="3" fill="#8B5A2B"/>
      <circle cx="35" cy="65" r="5" fill="#8B5A2B"/>
      <path d="M45 70 Q50 75 55 70" stroke="#8B5A2B" strokeWidth="4" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// ── LABORATORIOS Y ENTORNOS DE PRUEBA ────────────────────────────────────────

// OWASP JUICE SHOP (Caja de jugo, refactorizado)
export function JuiceShopIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 25 L65 10 L75 10" stroke="#10B981" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <polygon points="25,35 50,15 75,35" fill="#F59E0B" stroke="#D97706" strokeWidth="2.5"/>
      <rect x="25" y="35" width="50" height="55" rx="4" fill="#FBBF24" stroke="#D97706" strokeWidth="2.5"/>
      <circle cx="50" cy="65" r="14" fill="#FFFFFF"/>
      <path d="M50 55 L58 68 L42 68 Z" fill="#1E3A8A"/>
    </svg>
  )
}

// DVWA (LOGOTIPO REAL - Damn Vulnerable Web App, rediseño Image 0)
// Fondo gris, órbitas verde lima/blanco, letras Arial-style.
export function DvwaIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Fondo gris corporativo (Derivado de Image 0) */}
      <rect width="100" height="100" rx="15" fill="#4A4E54"/>
      
      {/* Órbita Verde Lima trasera */}
      <path d="M25 65 C30 80, 75 88, 85 65 C95 45, 70 20, 45 28" stroke="#A3E635" strokeWidth="5" strokeLinecap="round" fill="none"/>
      
      {/* Órbita Blanca delantera */}
      <path d="M15 45 C25 22, 68 12, 85 35 C95 50, 80 75, 55 82" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" fill="none"/>
      
      {/* Texto Oficial DVWA */}
      <text x="48" y="58" textAnchor="middle" fill="#FFFFFF" fontSize="24" fontFamily="Arial Black, sans-serif" fontWeight="900" letterSpacing="-1.5">DVWA</text>
    </svg>
  )
}

// WEBGOAT (Cabra estilizada, refactorizado)
export function WebGoatIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" fill="#1F2937" />
      <path d="M40 30 C 25 15 10 30 25 45" stroke="#9CA3AF" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M60 30 C 75 15 90 30 75 45" stroke="#9CA3AF" strokeWidth="7" fill="none" strokeLinecap="round" />
      <ellipse cx="25" cy="50" rx="12" ry="5" fill="#9CA3AF" transform="rotate(20 25 50)" />
      <ellipse cx="75" cy="50" rx="12" ry="5" fill="#9CA3AF" transform="rotate(-20 75 50)" />
      <polygon points="35,40 65,40 50,75" fill="#D1D5DB" />
      <circle cx="45" cy="50" r="3" fill="#111827" />
      <circle cx="55" cy="50" r="3" fill="#111827" />
      <path d="M45 75 L50 90 L55 75 Z" fill="#9CA3AF" />
    </svg>
  )
}

// ── BRANDING PROPIO ──────────────────────────────────────────────────────────

// SECURESCAN PRO (Logo Propio Refactorizado - Escudo cibernético)
export function SecureScanIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L92 25 L92 55 C92 77 73 93 50 100 C27 93 8 77 8 55 L8 25 Z" fill="#0f172a" stroke="url(#shield-grad)" strokeWidth="6"/>
      <defs>
        <linearGradient id="shield-grad" x1="8" y1="5" x2="92" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8"/>
          <stop offset="100%" stopColor="#818cf8"/>
        </linearGradient>
      </defs>
      <circle cx="50" cy="48" r="22" fill="none" stroke="url(#shield-grad)" strokeWidth="5"/>
      <circle cx="50" cy="48" r="10" fill="#38bdf8"/>
    </svg>
  )
}

// ── MAPA DE EXPORTACIÓN (Para renderizado dinámico en la UI) ────────────────

export const TOOL_ICONS: Record<string, React.FC<IconProps>> = {
  'Wappalyzer':   WappalyzerIcon,
  'Nmap':         NmapIcon,
  'OWASP ZAP':    ZapIcon,
  'ZAP':          ZapIcon,
  'ZAP Spider':   ZapIcon,
  'Nuclei':       NucleiIcon,
  'SQLMap':       SqlmapIcon,
  'Gobuster':     GobusterIcon,
  'ffuf':         FfufIcon,
  'Metasploit':   MetasploitIcon,
  'Searchsploit': SearchsploitIcon,
  'Patator':      PatatorIcon,
  'Juice Shop':   JuiceShopIcon,
  'DVWA':         DvwaIcon,
  'WebGoat':      WebGoatIcon,
  'SecureScan':   SecureScanIcon,
}

export default TOOL_ICONS