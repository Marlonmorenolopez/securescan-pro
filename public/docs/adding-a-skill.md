# Cómo agregar una nueva Skill a SecureScan Pro

Este documento explica el procedimiento para **registrar** una nueva Skill
(herramienta de seguridad) en el catálogo del frontend, y por qué eso es
distinto de **integrarla** de verdad al backend.

> **Distinción importante**
>
> - **Registrar una Skill** = agregarla a `lib/skills.ts` para que el
>   catálogo, la navegación y (si tiene documentación) `/docs` sepan que
>   existe.
> - **Integrar una Skill** = que `SecurityOrchestrator` (backend) realmente
>   la ejecute y que `app/scanner/page.tsx` sepa extraer sus resultados
>   reales de la respuesta del scan.
>
> Registrar **nunca** debe hacer que el frontend finja que puede ejecutar
> una herramienta que el backend todavía no soporta. Por eso el campo
> `status` de cada Skill distingue `'available'` (el backend ya la corre)
> de `'planned'` (está catalogada, pero no se ejecuta todavía).

## Arquitectura actual (fuente única de verdad)

```
lib/skills.ts                 ← EL CATÁLOGO. Metadata de cada Skill.
  │
  ├── lib/nav-config.tsx       consume SKILLS vía getSkillNames() para
  │                            construir la navegación agrupada.
  │
  ├── lib/tool-docs.ts         consume SKILLS (campo .docs) para construir
  │                            la vista de documentación de /docs y del
  │                            ToolDetailDrawer en /scanner y /footprint.
  │
  └── components/tool-icons.tsx  catálogo APARTE de logos SVG custom,
                                  referenciado por Skill.svgIconKey.
                                  (se mantiene separado a propósito: es un
                                  activo visual, no metadata de catálogo)
```

Lo que **NO** vive en `lib/skills.ts` (y no debe moverse ahí):

- El texto traducido (descripción, features) — vive en
  `messages/{es,en}.json`. El registro solo guarda la **clave** i18n.
- La extracción de resultados reales del backend — vive en
  `lib/scan-extractors.ts` (`getPentestingToolStats`, `getFootprintModel`,
  `extractSeverityCounts`). Esa lógica traduce campos reales de la respuesta
  del scan (`currentScan.nuclei_findings`, `currentScan.threat_intel`, etc.) y
  está acoplada al contrato del backend, no es metadata de catálogo. Las
  páginas `/scanner` (Pentesting) y `/footprint` (Huella Digital) la consumen
  y derivan sus herramientas del Registry: **no** mantienen listas propias.

## Pasos para registrar una Skill nueva

### 1. Registrar metadata

Agrega un objeto a `SKILLS` en `lib/skills.ts`:

```ts
{
  id: 'amass',
  name: 'Amass',
  category: 'osint',        // debe ser una SkillCategory real existente
  subgroup: 'dominios',     // debe existir como `key` en ese grupo en nav-config.tsx
  status: 'planned',        // 'planned' hasta que el backend la ejecute de verdad
  icon: Globe2,             // icono lucide de respaldo
}
```

### 2. Definir categoría/subcategoría

`category` debe ser una de las 4 ya existentes (`pentesting`, `osint`,
`huella-digital`, `code-security`) — no inventes una categoría nueva sin
también agregar la `NavSection` correspondiente en `nav-config.tsx`.

`subgroup` debe coincidir con un `key` ya definido en el `groups[]` de esa
`NavSection`, o necesitarás agregar un grupo nuevo ahí también.

### 3. Agregar traducciones (si vas a documentarla)

Si la Skill va a tener descripción real, agrega las claves en
`messages/es.json` **y** `messages/en.json`, bajo el namespace `docs`:

```json
"docs": {
  "amassDesc": "...",
  "amassFeature1": "..."
}
```

Verifica paridad de claves entre ambos archivos antes de continuar.

### 4. Agregar documentación (solo si existe de verdad)

Si tiene documentación real, agrega el campo `docs` a su entrada en
`lib/skills.ts`:

```ts
docs: {
  descriptionKey: 'amassDesc',
  featureKeys: ['amassFeature1', 'amassFeature2'],
  usage: `amass enum -d target.com`,
  documentationUrl: 'https://github.com/owasp-amass/amass',
}
```

Si **no** tiene documentación todavía, simplemente omite el campo `docs`.
`ToolDetailDrawer` ya maneja ese caso mostrando un mensaje honesto
("no hay documentación disponible") en vez de inventar contenido.

### 5. Conectar el identificador con el backend (solo cuando exista de verdad)

Esto es un paso **aparte y posterior**, y solo aplica cuando el backend
realmente implemente la herramienta:

1. Cambia `status: 'planned'` a `status: 'available'` en `lib/skills.ts`.
2. Si es una herramienta de **Pentesting** que corre dentro del Web Scan,
   agrega su extractor en `PENTEST_EXTRACTORS` de `lib/scan-extractors.ts`
   (paso del pipeline, flag de `options.tools` y campo real que el backend
   devuelve en `currentScan`). `/scanner` la mostrará sola porque itera el
   Registry. Si es una fuente de **Huella Digital**, agrega su clave en
   `FOOTPRINT_KEYS` (la clave dentro de `currentScan.threat_intel`) y su
   métrica en `getFootprintModel()`; `/footprint` la mostrará en la
   cobertura de fuentes. En desarrollo, `assertExtractorCoverage()` avisa si
   una Skill del Registry no tiene extractor.
3. Si tiene logo propio, agrégalo a `components/tool-icons.tsx` y referencia
   su key en `svgIconKey`.

**Nunca actives `status: 'available'` sin que el paso anterior esté hecho
de verdad** — eso sería mostrar una capacidad que no existe.

### 6. Verificar resultados

- La Skill debe aparecer en el Sidebar, en la tarjeta de categoría del
  Dashboard, y en el buscador rápido del Header — automáticamente, sin
  tocar esos archivos (todos derivan de `nav-config.tsx` → `lib/skills.ts`).
- Si tiene `docs`, debe aparecer en `/docs`.
- Si `status: 'planned'`, NO debe tener botón de ejecución en ningún lado.

### 7. Ejecutar validaciones

```bash
npx tsc --noEmit
npm run build
npm audit
```

Y confirma que la paridad de claves ES/EN se mantiene (0 faltantes, 0
duplicadas).

## Ejemplo conceptual: agregar "Amass" (sin implementarlo)

Amass es una herramienta real de descubrimiento de subdominios. Para
catalogarla (sin fingir que el backend la ejecuta):

```ts
{
  id: 'amass',
  name: 'Amass',
  category: 'osint',
  subgroup: 'dominios',
  status: 'planned',
  icon: Globe2,
  targetSupport: ['domain'],
  tags: ['subdomains', 'recon'],
}
```

Con esto, Amass aparecería listada bajo OSINT → Dominios (sidebar,
tarjeta de categoría, buscador), pero **sin** botón de ejecución ni
resultados — porque `SecurityOrchestrator` todavía no la implementa. El
día que el backend la integre de verdad, se sigue el paso 5 de arriba.
