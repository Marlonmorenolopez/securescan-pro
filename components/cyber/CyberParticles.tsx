'use client'
// components/cyber/CyberParticles.tsx — SecureScan Pro v5.0 · Semana 6
//
// Fondo decorativo con partículas flotantes + líneas de datos verticales.
// 100% CSS (@keyframes), cero JS de animación — el único JS es generar las
// posiciones una vez al montar. Coste de rendimiento despreciable comparado
// con Three.js/R3F (decisión tomada en la auditoría original).
//
// IMPORTANTE — Hydration:
//   Las posiciones usan Math.random(), lo que rompería SSR (mismatch
//   servidor/cliente). Se resuelve generándolas SOLO en el cliente dentro
//   de useEffect + mounted guard, igual que el patrón ya usado en
//   use-mobile.tsx y CyberStat.
//
// Uso:
//   <div className="relative ...">
//     <CyberParticles count={20} />
//     ...contenido encima con z-10...
//   </div>

import { useEffect, useState } from 'react'

interface Particle {
  id:       number
  left:     string
  size:     number
  duration: number
  delay:    number
  drift:    number
  opacity:  number
}

interface DataStream {
  id:       number
  left:     string
  duration: number
  delay:    number
}

interface CyberParticlesProps {
  /** Número de partículas flotantes (recomendado: 12-25) */
  count?: number
  /** Número de líneas de datos verticales (recomendado: 2-5) */
  streams?: number
  /** Desactivar completamente (útil si el padre ya sabe que reduced-motion está activo) */
  disabled?: boolean
  className?: string
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id:       i,
    left:     `${Math.random() * 100}%`,
    size:     Math.random() * 2.5 + 1,       // 1px – 3.5px
    duration: Math.random() * 12 + 14,        // 14s – 26s (lento, no distrae)
    delay:    Math.random() * -20,            // negativo = ya en curso al montar
    drift:    (Math.random() - 0.5) * 60,     // -30px a +30px de deriva horizontal
    opacity:  Math.random() * 0.35 + 0.15,    // 0.15 – 0.5 (sutil)
  }))
}

function generateStreams(count: number): DataStream[] {
  return Array.from({ length: count }, (_, i) => ({
    id:       i,
    left:     `${10 + (i * (80 / Math.max(count - 1, 1)))}%`,
    duration: Math.random() * 4 + 5,          // 5s – 9s
    delay:    Math.random() * -8,
  }))
}

export function CyberParticles({
  count = 18,
  streams = 3,
  disabled = false,
  className = '',
}: CyberParticlesProps) {
  const [mounted, setMounted]               = useState(false)
  const [particles, setParticles]           = useState<Particle[]>([])
  const [dataStreams, setDataStreams]       = useState<DataStream[]>([])

  useEffect(() => {
    setMounted(true)
    setParticles(generateParticles(count))
    setDataStreams(generateStreams(streams))
    // Solo generar una vez al montar — no regenerar si count/streams cambian
    // en runtime (no es un caso de uso esperado para un fondo decorativo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Nada que renderizar en SSR ni si está deshabilitado
  if (!mounted || disabled) return null

  return (
    <div className={`cyber-particles ${className}`} aria-hidden="true">
      {/* Partículas flotantes */}
      {particles.map(p => (
        <span
          key={`particle-${p.id}`}
          className="cyber-particle"
          style={{
            left:               p.left,
            bottom:             '-10px',
            width:              `${p.size}px`,
            height:             `${p.size}px`,
            animationDuration:  `${p.duration}s`,
            animationDelay:     `${p.delay}s`,
            ['--particle-drift' as string]:  `${p.drift}px`,
            ['--particle-opacity' as string]: p.opacity,
          }}
        />
      ))}

      {/* Líneas de datos verticales */}
      {dataStreams.map(s => (
        <span
          key={`stream-${s.id}`}
          className="cyber-data-stream"
          style={{
            left:              s.left,
            animationDuration: `${s.duration}s`,
            animationDelay:    `${s.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
