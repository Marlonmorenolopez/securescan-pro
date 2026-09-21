# Cómo agregar una nueva Skill a SecureScan Pro

Este documento explica cómo **catalogar** una nueva Skill (herramienta de
seguridad) en el frontend y qué hace falta para **integrarla** de verdad.
Son cosas distintas, y el sistema está diseñado para que no se confundan.

> **Distinción importante**
>
> - **Catalogar** = agregar la Skill al Registry (`lib/skills.ts`).
> - **Integrar** = que el backend realmente la ejecute y el frontend sepa
>   leer su resultado.
>
> El campo `status` lo separa: `'available'` (el backend ya la ejecuta) y
> `'planned'` (catalogada, sin capacidad real todavía).
> **Una Skill `planned` es inerte:** los helpers del Registry no la devuelven,
> así que no aparece en la navegación, el buscador, los conteos del dashboard,
> `/docs`, el ToolGrid de `/scanner` ni los selectores de `/footprint`. No hay
> botones, endpoints ni resultados simulados para ella.

## Arquitectura (fuente única de verdad)

```
lib/skills.ts                  EL CATÁLOGO. Metadata estructural de cada Skill.
  │                            Los helpers (getSkillsByCategory, getSkillNames,
  │                            AVAILABLE_SKILLS…) devuelven solo 'available'.
  │
  ├── lib/nav-config.tsx       nombres por subgroup → navegación, taxonomía,
  │                            conteos, buscador. Define los GROUPS (key/icono).
  ├── lib/tool-docs.ts         docs de /docs y del ToolDetailDrawer.
  │                            Textos: messages → skills.<id>.description / features[]
  ├── lib/scan-extractors.ts   contrato con el backend (paso del pipeline, flag,
  │                            campo del scan / clave de threat_intel). Consume el
  │                            Registry; lo usan /scanner y /footprint.
  ├── components/tool-icons.tsx logos SVG (activo visual). Se enlazan con
  │                            Skill.svgIconKey → TOOL_ICONS[svgIconKey].
  └── messages/{es,en}.json    convención por id: skills.<id>.short (todas),
                               skills.<id>.description y .features[] (con docs).
```

Lo que **no** vive en el Registry (a propósito): el texto traducido, el
contrato de ejecución con el backend, y el color/ruta de cada categoría (ya
están en `nav-config.tsx`).

## Convención de textos por Skill (i18n)

En **ambos** `messages/es.json` y `messages/en.json`:

```json
"skills": {
  "amass": {
    "short": "Una línea, para ToolCards, formularios y cobertura.",
    "description": "Párrafo para /docs y el drawer (solo si la Skill tiene `docs`).",
    "features": ["Punto 1", "Punto 2"]
  }
}
```

- `short` es obligatorio para toda Skill `available`.
- `description` y `features` (lista, misma longitud en ES y EN) solo si la
  Skill tiene `docs`.
- El nombre de la herramienta es un nombre propio y **no** se traduce.
- No hay claves numéricas ni namespaces alternativos: la clave es el `id`.

## Qué archivos toca cada tipo de Skill

| Tipo | Archivos |
|---|---|
| **Planned** (sin backend) | `lib/skills.ts` (1 entrada con `status: 'planned'`, sin `docs`). Correr `npm run check:skills`. |
| **Available — OSINT / Code Security** | `lib/skills.ts` + bloque `skills.<id>` (ES/EN) + la página propia del módulo (`app/osint`, `app/code-scan`), que llama a sus endpoints existentes. |
| **Available — fuente de Huella Digital** | `lib/skills.ts` + `skills.<id>` (ES/EN) + `FOOTPRINT_KEYS` en `lib/scan-extractors.ts` + su panel de resultados (`components/results/intel/`, `FootprintSources`, `FootprintOverview`). El backend debe devolverla en `threat_intel`. |
| **Available — herramienta de Pentesting** | `lib/skills.ts` + `skills.<id>` (ES/EN) + `PENTEST_EXTRACTORS` en `lib/scan-extractors.ts` + contrato de ejecución del Web Scan: pasos del pipeline (`scan-context`, `scan-progress`, `ScanPipeline`), switch del formulario (`scan-form`) y `requestedTools`. Esas listas reflejan el contrato del backend y no se derivan del Registry. |
| **Logo propio** (opcional) | `components/tool-icons.tsx` (componente + entrada en `TOOL_ICONS`) y `svgIconKey` en la Skill. Sin logo se usa el icono Lucide de la Skill. |
| **Grupo (subgroup) nuevo** | Un `group` en la `NavSection` de `lib/nav-config.tsx` + su label en `navCatalog.sections.<sección>.groups.<key>` (ES/EN). |

## Pasos

### 1. Registrar la Skill

```ts
{
  id: 'amass',                 // kebab-case, único
  name: 'Amass',
  category: 'osint',           // pentesting | osint | huella-digital | code-security
  subgroup: 'dominios',        // debe existir como `key` en el group de esa NavSection
  status: 'planned',           // 'available' SOLO si el backend ya la ejecuta
  icon: Globe2,                // icono Lucide de respaldo
}
```

Campos opcionales con consumidor real: `svgIconKey` (logo), `docs`
(`{ usage, documentationUrl }`, solo con contenido real y nunca en `planned`),
`targetSupport` (dato verificado; todavía sin vista que lo use).

### 2. Textos (solo `available`)

Agrega el bloque `skills.<id>` en ES y EN (ver convención arriba).

### 3. Integración con el backend (solo cuando exista de verdad)

Requisitos **del backend** que este repositorio no implementa: la herramienta
debe ejecutarse en el orquestador y su resultado debe llegar en el scan
(`currentScan.<campo>` o `threat_intel.<clave>`), o tener un endpoint propio
(OSINT / Code Security). Cuando eso exista:

1. `status: 'available'`.
2. Extractor en `lib/scan-extractors.ts` (según la tabla).
3. Piezas de UI/contrato indicadas en la tabla.

**Nunca** actives `available` sin que la capacidad exista: sería mostrar algo
que no funciona.

### 4. Validar

```bash
npm run check:skills   # coherencia del catálogo
npx tsc --noEmit
npm run build
npm audit
```

`npm run check:skills` verifica: ids únicos y kebab-case; `planned` sin `docs`;
cada `subgroup` existe en `nav-config` con su label ES/EN; cada `svgIconKey`
existe en `TOOL_ICONS`; cada Skill `available` tiene `skills.<id>.short` (y
`description`/`features` si tiene `docs`) en ES y EN con igual número de
features; paridad completa ES/EN; y que cada Skill de Pentesting/Huella tenga
extractor (y viceversa).

## Ejemplo: catalogar "Amass" sin backend

```ts
{ id: 'amass', name: 'Amass', category: 'osint', subgroup: 'dominios',
  status: 'planned', icon: Globe2 }
```

Con solo esa entrada (y `npm run check:skills` en verde) Amass queda
catalogada pero **inerte**: no aparece en ninguna superficie ejecutable ni en
`/docs`. El día que el backend la integre, se cambia a `available` y se siguen
los pasos 2 y 3.
