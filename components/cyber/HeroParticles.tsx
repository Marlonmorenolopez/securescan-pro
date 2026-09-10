'use client'
// components/cyber/HeroParticles.tsx — SecureScan Pro · Home v3
//
// Fondo de partículas para el Hero usando tsparticles (vía @tsparticles/nextjs,
// que resuelve SSR). Configuración deliberadamente sutil: pocas partículas,
// movimiento lento, líneas tenues — decorativo, nunca protagonista.
//
// Sustituye a CyberParticles en el Hero del Home v3. CyberParticles (CSS puro)
// se mantiene disponible para otras secciones/páginas que no necesiten líneas
// de conexión entre partículas.

import { NextParticles } from '@tsparticles/nextjs'
import type { ISourceOptions } from '@tsparticles/engine'

const options: ISourceOptions = {
  fullScreen: { enable: false },
  background: { color: { value: 'transparent' } },
  fpsLimit: 60,
  particles: {
    number: { value: 22, density: { enable: true } },
    color: { value: '#00d4ff' },
    opacity: { value: 0.25, animation: { enable: true, speed: 0.4, sync: false, startValue: 'random' } },
    size: { value: { min: 1, max: 2.5 } },
    move: {
      enable: true,
      speed: 0.35,
      direction: 'none',
      random: true,
      outModes: { default: 'out' },
    },
    links: {
      enable: true,
      distance: 130,
      color: '#00d4ff',
      opacity: 0.08,
      width: 1,
    },
  },
  interactivity: {
    events: { onHover: { enable: false }, onClick: { enable: false } },
  },
  detectRetina: true,
}

interface HeroParticlesProps {
  className?: string
}

export function HeroParticles({ className }: HeroParticlesProps) {
  return (
    <div className={className} aria-hidden="true">
      <NextParticles id="hero-particles" options={options} />
    </div>
  )
}
