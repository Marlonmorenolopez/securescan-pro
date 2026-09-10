// lib/validators.ts
//
// CORRECCIONES APLICADAS:
//   1. scanIdSchema: regex actualizado al formato real de uuid4() del backend.
//      Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (RFC 4122, versión 4)
//   2. isBlockedHost: los hosts de laboratorio Docker (juice-shop, dvwa,
//      webgoat) y localhost:3001-3003 estaban siendo bloqueados, impidiendo
//      cualquier escaneo de laboratorio desde la UI.
//      El backend tiene su propia capa de validación (RESTRICT_TO_LAB_TARGETS)
//      que es la autoridad real — el frontend solo necesita no interferir.

import { z } from 'zod'

// Hosts internos de producción que nunca deben escanearse desde Internet.
// NOTA: localhost y 127.0.0.1 NO están aquí — los laboratorios los usan.
const BLOCKED_HOSTS = [
  '0.0.0.0',
  '::1',
  '10.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  // 172.20.x y 172.21.x son las subredes Docker de SecureScan (lab-net /
  // securescan-net). Se permiten para que los contenedores puedan escanearse.
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
]

// Hosts de laboratorio explícitamente permitidos.
// El backend (RESTRICT_TO_LAB_TARGETS) es la autoridad final de seguridad.
const LAB_HOSTS = [
  'localhost',
  '127.0.0.1',
  'juice-shop',
  'dvwa',
  'webgoat',
]

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  // Extraer solo el hostname sin puerto
  const host = lower.split(':')[0]
  // Los hosts de laboratorio siempre están permitidos
  if (LAB_HOSTS.some(lab => host === lab)) return false
  return BLOCKED_HOSTS.some(blocked => host.startsWith(blocked) || host === blocked)
}

export const urlSchema = z
  .string()
  .min(1, 'URL is required')
  .url('Invalid URL format')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return ['http:', 'https:'].includes(parsed.protocol)
      } catch {
        return false
      }
    },
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  )
  .refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return !isBlockedHost(parsed.hostname)
      } catch {
        return false
      }
    },
    { message: 'Scanning internal/private networks is not allowed' }
  )

export const scanTypeSchema = z.enum(['quick', 'standard', 'full'], {
  errorMap: () => ({ message: 'Invalid scan type' }),
})

export const modulesSchema = z
  .array(z.enum(['wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit', 'metasploit', 'nuclei', 'sqlmap', 'patator', 'ffuf']))
  .min(1, 'Select at least one module')
  .default(['wappalyzer', 'nmap', 'gobuster', 'zap', 'searchsploit'])

export const scanRequestSchema = z.object({
  targetUrl: urlSchema,
  scanType: scanTypeSchema.default('standard'),
  modules: modulesSchema,
})

export type ScanRequest = z.infer<typeof scanRequestSchema>

// CORRECCIÓN: regex actualizado al formato real de uuid4() del backend.
// Formato: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (RFC 4122, versión 4)
export const scanIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid scan ID format'
  )

export function validateUrl(url: string): { valid: boolean; error?: string } {
  const result = urlSchema.safeParse(url)
  if (result.success) {
    return { valid: true }
  }
  return { valid: false, error: result.error.errors[0]?.message }
}

export function validateScanRequest(data: unknown): {
  valid: boolean
  data?: ScanRequest
  error?: string
} {
  const result = scanRequestSchema.safeParse(data)
  if (result.success) {
    return { valid: true, data: result.data }
  }
  return { valid: false, error: result.error.errors[0]?.message }
}

export function validateScanId(id: string): { valid: boolean; error?: string } {
  const result = scanIdSchema.safeParse(id)
  if (result.success) {
    return { valid: true }
  }
  return { valid: false, error: result.error.errors[0]?.message }
}
