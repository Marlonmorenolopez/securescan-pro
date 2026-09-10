'use client'
// components/particles-provider.tsx — SecureScan Pro · Home v3
//
// Envuelve la app con NextParticlesProvider (paquete oficial @tsparticles/nextjs,
// pensado para evitar el mismatch de SSR que tsparticles tiene en Next.js).
// Se registra únicamente el motor "slim" (loadSlim), más liviano que el motor
// completo — solo necesitamos partículas simples + líneas para el Hero.

import { NextParticlesProvider } from '@tsparticles/nextjs'
import { loadSlim } from '@tsparticles/slim'
import type { Engine } from '@tsparticles/engine'

export function ParticlesProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextParticlesProvider init={async (engine: Engine) => { await loadSlim(engine) }}>
      {children}
    </NextParticlesProvider>
  )
}
