'use client'
// components/page-transition.tsx — SecureScan Pro v5.0
// Semana 5: Wrapper de transición entre rutas.
//
// Se usa en layout.tsx envolviendo {children}. Como layout.tsx es Server
// Component (necesita leer locale/messages), la lógica de Framer Motion
// vive aquí, en un Client Component separado.
//
// AnimatePresence con mode="wait" espera a que la página saliente termine
// su animación de exit antes de montar la entrante — evita parpadeos.

import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { pageTransition, getVariants } from '@/lib/motion'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prefersReduced = useReducedMotion() ?? false

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={getVariants(pageTransition, prefersReduced)}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
