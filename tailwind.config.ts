// tailwind.config.ts — SecureScan Pro v5.0 · Cyber Neon Theme
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      /* ── Colores (tokens CSS → clases Tailwind) ── */
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary:   { DEFAULT: "hsl(var(--primary))",     foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))",   foreground: "hsl(var(--secondary-foreground))" },
        destructive:{ DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        success:   { DEFAULT: "hsl(var(--success))",     foreground: "hsl(var(--success-foreground))" },
        warning:   { DEFAULT: "hsl(var(--warning))",     foreground: "hsl(var(--warning-foreground))" },
        muted:     { DEFAULT: "hsl(var(--muted))",       foreground: "hsl(var(--muted-foreground))" },
        accent:    { DEFAULT: "hsl(var(--accent))",      foreground: "hsl(var(--accent-foreground))" },
        popover:   { DEFAULT: "hsl(var(--popover))",     foreground: "hsl(var(--popover-foreground))" },
        card:      { DEFAULT: "hsl(var(--card))",        foreground: "hsl(var(--card-foreground))" },
        sidebar: {
          DEFAULT:  "hsl(var(--sidebar))",
          foreground:"hsl(var(--sidebar-foreground))",
          primary: { DEFAULT: "hsl(var(--sidebar-primary))", foreground: "hsl(var(--sidebar-primary-foreground))" },
          accent:  { DEFAULT: "hsl(var(--sidebar-accent))",  foreground: "hsl(var(--sidebar-accent-foreground))" },
          border:  "hsl(var(--sidebar-border))",
          ring:    "hsl(var(--sidebar-ring))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        /* Tokens Cyber — accesibles como clases Tailwind */
        cyber: {
          accent:  "var(--cyber-accent)",
          purple:  "var(--cyber-purple)",
          green:   "var(--cyber-green)",
          red:     "var(--cyber-red)",
          amber:   "var(--cyber-amber)",
        },
      },

      /* ── Border radius ── */
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      /* ── Tipografía ── */
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      /* ── Keyframes ── */
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "cyber-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.3" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":       { transform: "translateY(-7px)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px var(--cyber-glow)" },
          "50%":       { boxShadow: "0 0 22px var(--cyber-glow-strong)" },
        },
        "terminal-blink": {
          "0%, 49%":   { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        "slide-in-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        "status-ping": {
          "0%":         { transform: "scale(1)",   opacity: "0.3" },
          "75%, 100%":  { transform: "scale(2.2)", opacity: "0"   },
        },
        "scan-line": {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },

      /* ── Animaciones ── */
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "cyber-pulse":    "cyber-pulse 2s ease-in-out infinite",
        "float":          "float 4s ease-in-out infinite",
        "glow-pulse":     "glow-pulse 2.5s ease-in-out infinite",
        "terminal-blink": "terminal-blink 1s step-end infinite",
        "slide-in-up":    "slide-in-up 0.4s ease-out",
        "fade-in":        "fade-in 0.3s ease-out",
        "status-ping":    "status-ping 2s cubic-bezier(0,0,0.2,1) infinite",
        "scan-line":      "scan-line 3s linear infinite",
      },

      /* ── Box shadows con glow ── */
      boxShadow: {
        "cyber":        "0 0 12px var(--cyber-glow), 0 0 28px var(--cyber-glow)",
        "cyber-strong": "0 0 20px var(--cyber-glow-strong), 0 0 50px var(--cyber-glow)",
        "cyber-sm":     "0 0 6px var(--cyber-glow)",
        "cyber-inset":  "inset 0 1px 0 rgba(var(--cyber-accent-rgb), 0.12)",
      },

      /* ── Backdrop blur extra ── */
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
