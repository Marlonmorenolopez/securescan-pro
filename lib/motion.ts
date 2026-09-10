// lib/motion.ts — SecureScan Pro v5.0
// Archivo central de Framer Motion variants.
//
// REGLAS DE USO:
//   1. Importar siempre desde aquí, nunca definir variants inline.
//   2. Todos los variants respetan prefers-reduced-motion via `useReducedMotion()`.
//   3. No usar durations > 0.6s — el usuario espera información, no espectáculo.
//   4. No usar spring en elementos que aparecen en bulk (listas grandes).

import type { Variants, Transition } from 'framer-motion'

// ─── Transiciones base ────────────────────────────────────────────────────────

export const easeCyber: Transition = {
  type: 'tween',
  ease: [0.16, 1, 0.3, 1],   // ease-out expo — rápido al inicio, suave al final
  duration: 0.4,
}

export const easeSnappy: Transition = {
  type: 'tween',
  ease: [0.4, 0, 0.2, 1],    // ease-in-out estándar Material
  duration: 0.25,
}

export const easeSpring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

// ─── Fade In ─────────────────────────────────────────────────────────────────
// Uso: elementos individuales que aparecen por primera vez.

export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.2,  ease: 'easeIn'  } },
}

// ─── Slide In Up ─────────────────────────────────────────────────────────────
// Uso: secciones, paneles, resultados completos.

export const slideInUp: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0,  transition: easeCyber },
  exit:    { opacity: 0, y: -10, transition: easeSnappy },
}

// ─── Slide In Down ───────────────────────────────────────────────────────────
// Uso: dropdowns, toasts, elementos que caen desde arriba.

export const slideInDown: Variants = {
  hidden:  { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0,   transition: easeCyber  },
  exit:    { opacity: 0, y: -16, transition: easeSnappy },
}

// ─── Stagger container ───────────────────────────────────────────────────────
// Uso: wrappear listas de cards. Los hijos usan `staggerItem`.

export const staggerContainer: Variants = {
  hidden:  {},
  visible: {
    transition: {
      staggerChildren:  0.07,
      delayChildren:    0.05,
    },
  },
}

// ─── Stagger item ────────────────────────────────────────────────────────────
// Uso: cada hijo dentro de staggerContainer.

export const staggerItem: Variants = {
  hidden:  { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'tween',
      ease: [0.16, 1, 0.3, 1],
      duration: 0.38,
    },
  },
}

// ─── Scale In ────────────────────────────────────────────────────────────────
// Uso: modales, popovers, badges que aparecen.

export const scaleIn: Variants = {
  hidden:  { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1,    transition: easeCyber  },
  exit:    { opacity: 0, scale: 0.96, transition: easeSnappy },
}

// ─── Glow Hover ──────────────────────────────────────────────────────────────
// Uso: CyberCard, botones primarios.
// Se aplica como `whileHover` directamente (no es Variants de animate).

export const glowHover = {
  scale: 1.015,
  transition: easeSnappy,
}

export const glowTap = {
  scale: 0.985,
  transition: { duration: 0.1 },
}

// ─── Page transition ─────────────────────────────────────────────────────────
// Uso: layout de página entre rutas.

export const pageTransition: Variants = {
  hidden:  { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
  },
}

// ─── Loading skeleton pulse ──────────────────────────────────────────────────
// Uso: barras de progreso, indicadores de carga.

export const loadingPulse = {
  animate: {
    opacity: [0.4, 0.8, 0.4],
    transition: {
      duration: 1.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// ─── Float ───────────────────────────────────────────────────────────────────
// Uso: íconos decorativos, elementos hero.

export const floatAnimation = {
  animate: {
    y: [0, -7, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

// ─── Cyber scan line ─────────────────────────────────────────────────────────
// Uso: efectos de escaneo en progress bars.

export const scanLine = {
  animate: {
    x: ['-100%', '100%'],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
      repeatDelay: 0.5,
    },
  },
}

// ─── Helper: deshabilitar animaciones si reduced-motion ──────────────────────
// Uso: pasar a `variants` cuando se necesite respetar la preferencia.
//
//   const shouldAnimate = !prefersReducedMotion
//   <motion.div variants={shouldAnimate ? slideInUp : {}} ... />

export function getVariants(
  variants: Variants,
  prefersReducedMotion: boolean
): Variants {
  if (prefersReducedMotion) {
    // Reemplazar todas las transiciones con duración 0
    const reduced: Variants = {}
    for (const [key, val] of Object.entries(variants)) {
      reduced[key] = typeof val === 'object'
        ? { ...val, transition: { duration: 0 } }
        : val
    }
    return reduced
  }
  return variants
}
