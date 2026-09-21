'use client'
// components/cyber/HoloDigitalInfrastructure.tsx — SecureScan Pro v5.0 · 3D Holographic Digital Infrastructure

import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Shield, Lock, Server, Globe, Cpu, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface HoloDigitalInfrastructureProps {
  className?: string
  targetName?: string
}

export function HoloDigitalInfrastructure({
  className,
  targetName = 'PERIMETER::MONITOR',
}: HoloDigitalInfrastructureProps) {
  const prefersReduced = useReducedMotion() ?? false

  // Nodos orbitales perimetrales
  const perimeterNodes = useMemo(() => [
    { id: 'gw',   label: 'API GATEWAY',   angle: 30,  icon: Globe,  status: 'secure',  x: 280, y: 110 },
    { id: 'auth', label: 'AUTH / OAUTH',  angle: 90,  icon: Lock,   status: 'warning', x: 330, y: 240 },
    { id: 'db',   label: 'DB CLUSTER',    angle: 150, icon: Server, status: 'secure',  x: 270, y: 350 },
    { id: 'waf',  label: 'PERIMETER WAF', angle: 210, icon: Shield, status: 'secure',  x: 130, y: 340 },
    { id: 'mesh', label: 'SERVICE MESH',  angle: 270, icon: Cpu,    status: 'secure',  x: 70,  y: 220 },
    { id: 'core', label: 'INGRESS / DNS', angle: 330, icon: Radio,  status: 'secure',  x: 120, y: 100 },
  ], [])

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none perspective-1000 overflow-hidden rounded-xl border border-[rgba(var(--cyber-accent-rgb),0.20)] bg-[rgba(4,7,13,0.70)] p-4 shadow-2xl backdrop-blur-md holo-depth-2',
        className
      )}
      style={{ minHeight: '380px' }}
    >
      {/* Retícula de fondo HUD */}
      <div className="cyber-grid-bg pointer-events-none absolute inset-0 opacity-40" />

      {/* Brackets decorativos de consola */}
      <span className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l-2 border-t-2 border-[var(--cyber-accent)]" />
      <span className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r-2 border-t-2 border-[var(--cyber-accent)]" />
      <span className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b-2 border-l-2 border-[var(--cyber-accent)]" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b-2 border-r-2 border-[var(--cyber-accent)]" />

      {/* Header de telemetría del lienzo */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between font-mono text-[10px] text-muted-foreground/80 border-b border-[rgba(255,255,255,0.06)] pb-1.5 z-10">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--cyber-accent)] status-dot" />
          <span className="text-[var(--cyber-accent)] font-bold">{targetName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>SCAN_SWEEP::1.8s</span>
          <span className="text-emerald-400 font-semibold">STATUS::ACTIVE</span>
        </div>
      </div>

      {/* Lienzo SVG central de la infraestructura holográfica */}
      <div className="relative w-[380px] h-[380px] flex items-center justify-center pt-4">
        <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible">
          <defs>
            {/* Gradiente radial de radar */}
            <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0.25)" />
              <stop offset="60%" stopColor="rgba(0, 240, 255, 0.05)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
            {/* Gradiente de líneas de escaneo */}
            <linearGradient id="laserBeam" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0.8)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Anillos concéntricos de defensa orbital */}
          <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(0, 240, 255, 0.10)" strokeWidth="1" strokeDasharray="4 6" />
          <circle cx="200" cy="200" r="120" fill="none" stroke="rgba(0, 240, 255, 0.15)" strokeWidth="1" />
          <circle cx="200" cy="200" r="80" fill="none" stroke="rgba(37, 99, 235, 0.20)" strokeWidth="1.5" strokeDasharray="6 8" />
          <circle cx="200" cy="200" r="40" fill="url(#radarGlow)" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="1" />

          {/* Ejes cartesianos HUD */}
          <line x1="200" y1="30" x2="200" y2="370" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="30" y1="200" x2="370" y2="200" stroke="rgba(0, 240, 255, 0.08)" strokeWidth="1" strokeDasharray="3 3" />

          {/* Haz de Radar Rotatorio */}
          <motion.g
            animate={prefersReduced ? {} : { rotate: 360 }}
            transition={{ duration: 7, ease: 'linear', repeat: Infinity }}
            style={{ originX: '200px', originY: '200px' }}
          >
            <line x1="200" y1="200" x2="360" y2="200" stroke="url(#laserBeam)" strokeWidth="2" />
            <polygon points="200,200 360,180 360,200" fill="rgba(0, 240, 255, 0.06)" />
          </motion.g>

          {/* Líneas de enlace a los nodos */}
          {perimeterNodes.map((n) => (
            <g key={`link-${n.id}`}>
              <line
                x1="200"
                y1="200"
                x2={n.x}
                y2={n.y}
                stroke="rgba(0, 240, 255, 0.20)"
                strokeWidth="1"
              />
              <circle cx={(200 + n.x) / 2} cy={(200 + n.y) / 2} r="1.5" fill="rgba(0, 240, 255, 0.6)" />
            </g>
          ))}

          {/* Núcleo Central de Comando */}
          <g className="cursor-pointer">
            <circle cx="200" cy="200" r="22" fill="rgba(8, 14, 26, 0.95)" stroke="var(--cyber-accent)" strokeWidth="2" />
            <circle cx="200" cy="200" r="14" fill="rgba(0, 240, 255, 0.15)" />
            <text x="200" y="204" textAnchor="middle" fill="#00F0FF" fontSize="10" fontFamily="monospace" fontWeight="bold">
              SOC
            </text>
          </g>

          {/* Renderizado de Nodos Perimetrales */}
          {perimeterNodes.map((node) => {
            const isWarn = node.status === 'warning'
            const stroke = isWarn ? '#F59E0B' : '#00F0FF'
            const fill = isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 240, 255, 0.15)'

            return (
              <g key={node.id} className="transition-all duration-300 hover:scale-110" style={{ transformOrigin: `${node.x}px ${node.y}px` }}>
                <circle cx={node.x} cy={node.y} r="14" fill="rgba(8, 14, 26, 0.95)" stroke={stroke} strokeWidth="1.5" />
                <circle cx={node.x} cy={node.y} r="8" fill={fill} />
                <text
                  x={node.x}
                  y={node.y > 200 ? node.y + 22 : node.y - 18}
                  textAnchor="middle"
                  fill="rgba(226, 232, 240, 0.85)"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="600"
                  letterSpacing="0.05em"
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Footer de Telemetría */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between font-mono text-[9px] text-muted-foreground/60">
        <span>GRID::40x40px</span>
        <span>SECURITY PROTOCOL: OWASP / NIST SP-800</span>
        <span>LATENCY::0.02s</span>
      </div>
    </div>
  )
}
