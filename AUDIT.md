# AUDIT — Sistema de Skills de SecureScan Pro v5.0

Alcance: solo el sistema de Skills/Tools y su extensibilidad en el **frontend**.
`server/`, Docker, Redis, Celery, orquestador, módulos de seguridad, endpoints y
contratos API **no se tocan ni se tocaron**. No se agregan herramientas ni
capacidades; no hay rediseño visual.

Método: lectura completa de `lib/skills.ts`, `lib/nav-config.tsx`,
`lib/tool-docs.ts`, `lib/nav-i18n.ts`, `lib/scan-extractors.ts`,
`components/tool-icons.tsx`, y búsqueda por `grep` de todos los consumidores y
de nombres/ids de herramientas hardcodeados en `app/`, `components/` y `lib/`.

---

## 1. Cómo funciona hoy el Registry (`lib/skills.ts`)

### 1.1 Estructura de una Skill

| Campo | Obligatorio | Consumidor real hoy |
|---|---|---|
| `id` | sí | extractores, docs (`#id`), ToolCards, drawer |
| `name` | sí | nav (`getSkillNames`), búsqueda del header, ToolCards, docs |
| `category` | sí | `getSkillsByCategory` → nav, `/scanner`, `/footprint`, form |
| `subgroup` | sí | `getSkillNames` → grupos de nav; agrupación en `/footprint` |
| `status` | sí | **ninguno** (ver P1) |
| `icon` (Lucide) | sí | `ToolCard`, `/docs`, `ToolDetailDrawer` |
| `svgIconKey` | no | `getSkillSvgIcon()` → `TOOL_ICONS[key]` |
| `docs` `{descriptionKey, featureKeys[], usage, documentationUrl}` | no | `getToolDocs()` → `/docs`, `ToolDetailDrawer` |
| `targetSupport` | no | **ninguno** |
| `tags`, `order`, `requirements`, `meta` | no | **ninguno** (campos del tipo sin datos ni lectores) |

Exports adicionales sin consumidor: `CATEGORY_COLOR`, `CATEGORY_ROUTE`
(duplican `color`/`href` que ya viven en `nav-config`).

### 1.2 Categorías (verificadas, no se cambian)

| Categoría | Skills | Subgroups |
|---|---|---|
| `pentesting` | **12** | reconocimiento, enumeracion, webSecurity, authentication, sqlInjection, exploitation |
| `huella-digital` | **7** | dominios, infraestructura, reputacion, tlsSsl |
| `osint` | **4** | personas, dominios, breaches |
| `code-security` | **6** | secrets, sast, backdoors, dependencies, containers |
| **Total** | **29** | |

Los 12 de Pentesting, incluidos ZAP Spider e Injection Scanner (que **no** se
ejecutan individualmente: corren dentro del ZAP full scan y del paso SQLMap del
flujo orquestado), las 7 fuentes de Huella, las 4 de OSINT y las 6 de Code
Security coinciden con lo pedido.

### 1.3 Relaciones con el backend (no están en el Registry, y es correcto)

El Registry es **catálogo**. El acoplamiento con el backend vive en:

* `lib/scan-extractors.ts` — id de Skill → paso del pipeline, flag de
  `options.tools`, campo del scan (`PENTEST_EXTRACTORS`) y clave de
  `threat_intel` (`FOOTPRINT_KEYS`).
* `lib/scan-context.tsx` — payload real a `POST /api/scan`, `defaultSteps`.
* `components/scan-form.tsx` — los 10 switches reales del backend.
* `components/scan-progress.tsx`, `components/cyber/ScanPipeline.tsx` — pasos
  del pipeline por nombre de paso del backend.
* Páginas de OSINT y Code Security — cada una llama a sus endpoints propios.

---

## 2. Mapa de dependencias

```
lib/skills.ts (Registry)
 ├─ lib/nav-config.tsx        getSkillNames() por subgroup → NavToolGroup.tools
 │    ├─ Sidebar, ModuleHeader, CategoryCard, ToolTaxonomyStrip, dashboard (toolCount)
 │    ├─ Header (índice de búsqueda: un item por nombre de herramienta)
 │    └─ app/osint, app/code-scan, app/footprint, app/scanner (grupos/labels)
 ├─ lib/tool-docs.ts          getToolDocs() → /docs (índice+buscador) y ToolDetailDrawer
 │                            getSkillSvgIcon() → TOOL_ICONS[svgIconKey]
 ├─ lib/scan-extractors.ts    getSkillsByCategory('pentesting'|'huella-digital')
 │    ├─ /scanner (ToolGrid, KPIs), results-dashboard (gráfico por herramienta)
 │    └─ /footprint (FootprintForm, FootprintSources, FootprintOverview)
 └─ components/scan-form.tsx  getSkillsByCategory (nombres) + getSkillById (covers)
```

Consumo por área pedida:

| Área | ¿Deriva del Registry? |
|---|---|
| Navegación (Sidebar, taxonomía, dashboard, búsqueda) | **Sí** (nombres por subgroup). Los *grupos* (key/label/icon) siguen en `nav-config` |
| ToolCards / ToolGrid de Pentesting | **Sí** |
| Fuentes de Huella (form, cobertura, drawer) | **Sí** |
| Documentación (`/docs`, drawer) | **Sí** (solo las Skills con `docs`) |
| Iconos SVG | Parcial (ver D3) |
| OSINT (4 ToolCards) | **No** — lista escrita a mano en `app/osint/page.tsx` |
| Code Security (6 ToolCards) | **No** — array manual en `app/code-scan/page.tsx` |
| Form de escaneo (10 switches) | Parcial — `toolsConfig` repite nombre e icono |
| Pipeline (progreso, `ScanPipeline`) | **No** — listas de pasos del backend (contrato) |
| i18n de textos por Skill | **No** — claves numéricas y namespaces dispersos (ver D5) |

---

## 3. Duplicaciones y problemas encontrados

### Problemas de diseño (afectan la extensibilidad)

* **P1 — `status: 'planned'` no está soportado por ningún consumidor.** El campo
  existe y el comentario dice que una Skill `planned` no debe fingirse
  ejecutable, pero ninguna función lo lee. Hoy, agregar una Skill `planned`
  la haría aparecer en la navegación, en el índice de búsqueda, en el conteo del
  dashboard, en `/docs`, en el ToolGrid de `/scanner` y **como fuente
  seleccionable en `/footprint`** (enviaría un id inexistente al backend en
  `threat_intel_tools`). Es exactamente el escenario "Amass sin backend".
* **P2 — Campos y exports muertos** (`tags`, `order`, `requirements`, `meta`,
  `CATEGORY_COLOR`, `CATEGORY_ROUTE`): sin datos ni lectores; `CATEGORY_*`
  además duplican datos de `nav-config` (riesgo de divergencia).
* **P3 — Nada valida la coherencia del catálogo.** Un `subgroup` que no exista
  en `nav-config` deja la Skill invisible en la navegación y rompe
  `FootprintForm` (`groups.find(...)!`); un `svgIconKey` inexistente cae al
  icono Lucide sin aviso; una clave de `docs` ausente en `es.json`/`en.json` se
  muestra como `docs.xyz` en pantalla. Solo `assertExtractorCoverage()`
  (advertencia en dev) cubría un caso.

### Duplicaciones (lista manual que debería derivarse)

* **D1 — OSINT**: 4 `<ToolCard name=… icon=… description="…">` con nombre,
  categoría y descripción escritos a mano (y descripciones en español **sin
  i18n**).
* **D2 — Code Security**: array literal de 6 herramientas con `key`, `icon`,
  `name`, `category`, `desc` (español sin i18n). Además diverge del Registry:
  ids `backdoors`/`dependency_check` (clave del backend) vs `backdoor-scanner`/
  `dependency-check`; nombre `OWASP Dependency-Check` vs `Dependency-Check`;
  iconos distintos. *Los nombres e iconos visibles no se cambian en este trabajo
  (sería un cambio visual); se documenta la divergencia.*
* **D3 — Iconos**: `TOOL_ICONS` está indexado por **nombre visible** (`'OWASP
  ZAP'`, `'ffuf'`), con la clave duplicada `'ZAP'`/`'ZAP Spider'` para el
  pipeline; `scan-form.tsx` importa 10 componentes de icono directamente en vez
  de pedirlos al Registry; el landing (`app/page.tsx`) también. Injection Scanner
  no tiene logo propio (usa el Lucide de fallback: correcto, no se inventa uno).
* **D4 — `scan-form.tsx` `toolsConfig`** repite `name` e `icon` que ya están en
  el Registry.
* **D5 — Textos por Skill en i18n dispersos**, con tres esquemas distintos:
  `docs.tool1Desc … docs.tool10Feature5` (**claves numéricas**, sin relación con
  el id, más `docs.<xyz>Desc/FeatureN` para las 9 Skills agregadas después),
  `scanner.toolDesc.<id>` (10), `footprint.sources.role.<id>` (7), y textos
  hardcodeados en OSINT/Code. Agregar una Skill obliga a inventar numeración
  y decidir en cuál de los esquemas escribir. `SkillDocs` guarda
  `descriptionKey`/`featureKeys[]` explícitos por Skill.
* **D6 — Listas del contrato de ejecución** (no derivables del Registry sin
  ampliar el contrato; se **dejan** y se documentan):
  pasos del pipeline en `scan-context.defaultSteps`,
  `scan-progress.TOOL_ORDER/TOOL_CONFIG`, `ScanPipeline.PIPELINE_STEPS` y
  `scan-extractors.PENTEST_EXTRACTORS.step`; `ToolId`/`toolsConfig`/perfiles de
  intensidad en `scan-form`; `requestedTools` en `scan-context`; enum de
  `lib/validators.ts`; pestañas por herramienta en `results-dashboard`.
* **D7 — Contenido de marketing/demo** con nombres hardcodeados:
  `app/page.tsx` (10 herramientas, orden, colores), `app/docs/page.tsx`
  (`archSteps`), `lib/home-mock-data.ts` (datos de demostración
  preexistentes), `osint-history-list.tsx` (etiqueta de un tipo de historial).
  No son catálogo funcional; **no se tocan**.

### Otros hallazgos menores (no bloquean; documentados)

* `/docs` muestra `"{n} de {m} herramientas"` con texto fijo en español.
* `targetSupport` (29 Skills con dato verificado) no tiene consumidor todavía:
  se **conserva** porque el dato es correcto, pero no es campo obligatorio ni
  debe ampliarse hasta que exista una vista que lo use (p. ej. el drawer).
* `public/docs/tools.md` (documento antiguo) menciona WhatWeb, que no existe.

---

## 4. Propuesta

Principio: un campo o convención solo se agrega si tiene consumidor real hoy.

| # | Cambio | Justificación |
|---|---|---|
| C1 | `status` con semántica real: los helpers del Registry devuelven solo Skills `available`; `planned` queda catalogada pero **inerte** en nav, búsqueda, conteos, docs, ToolGrid y `/footprint`. Una Skill `planned` no puede llevar `docs`. | P1 |
| C2 | Eliminar campos/exports muertos (`tags`, `order`, `requirements`, `meta`, `CATEGORY_COLOR`, `CATEGORY_ROUTE`). | P2 |
| C3 | Convención i18n por id: `skills.<id>.short`, `skills.<id>.description`, `skills.<id>.features[]`. Reemplaza las claves numéricas, `scanner.toolDesc` y `footprint.sources.role`. `SkillDocs` queda `{usage, documentationUrl}`. | D5 |
| C4 | Consumir `skills.<id>.short` en OSINT, Code Security, form de escaneo y cobertura de Huella (solo cambia el origen del texto; ES idéntico). | D1, D2, D5 |
| C5 | `scan-form`: nombre e icono derivados del Registry (`getSkillById`, `getSkillSvgIcon`). | D3, D4 |
| C6 | `scripts/check-skills.mjs` + `npm run check:skills`: valida el catálogo (ids únicos, subgroup ↔ nav-config, `svgIconKey` ↔ `TOOL_ICONS`, extractores, docs/short/features en ES y EN, paridad ES/EN, `planned` sin docs). | P3 |
| C7 | `scan-extractors`: `getExtractorCoverageGaps()` (lo consume el script y la advertencia de dev). | P3 |
| C8 | Reescribir `public/docs/adding-a-skill.md` con el flujo real y la matriz de archivos por tipo de Skill. | entregable |

Archivos que se modificarán: `lib/skills.ts`, `lib/tool-docs.ts`,
`lib/scan-extractors.ts`, `components/scan-form.tsx`,
`components/footprint/FootprintSources.tsx`, `app/osint/page.tsx`,
`app/code-scan/page.tsx`, `messages/es.json`, `messages/en.json`,
`package.json` (solo un script), `public/docs/adding-a-skill.md`.
Archivos nuevos: `scripts/check-skills.mjs`, `AUDIT.md`.

Archivos que **no** deben modificarse: todo `server/`, Docker/Redis/Celery,
`lib/api-client.ts`, `lib/scan-context.tsx`, `lib/nav-config.tsx`,
`components/tool-icons.tsx`, `components/scan-progress.tsx`,
`components/cyber/ScanPipeline.tsx`, `lib/validators.ts`,
`components/results-dashboard.tsx`, `app/page.tsx`, `app/docs/page.tsx`,
`lib/home-mock-data.ts` (contrato de ejecución o contenido de marketing/demo,
fuera de alcance).

---

## 5. Flujo ideal para una nueva Skill (tras C1–C8)

| Tipo de Skill | Pasos |
|---|---|
| **Planned** (sin backend, p. ej. Amass) | 1) Entrada en `SKILLS` con `status: 'planned'`. 2) `npm run check:skills`. Nada más: no aparece en ninguna superficie ejecutable ni en `/docs`. |
| **Available, fuente de Huella con backend** | 1) Entrada en `SKILLS` (+ `svgIconKey` opcional). 2) Bloque `skills.<id>` en `es.json` y `en.json`. 3) `FOOTPRINT_KEYS` en `scan-extractors.ts`. 4) Panel de resultados (`components/results/intel/*` + `FootprintSources`/`FootprintOverview`). El backend ya debe devolverla en `threat_intel`. |
| **Available, herramienta de Pentesting con backend** | 1–2) igual. 3) `PENTEST_EXTRACTORS`. 4) Contrato de ejecución: pasos del pipeline y switch del form (D6). |
| **Available, OSINT/Code Security** | 1–2) igual. 3) La página propia de cada módulo llama a sus endpoints (no hay extractor genérico). |

Requisitos de **backend** que este trabajo NO implementa (solo se documentan):
para pasar una Skill nueva de `planned` a `available` el backend debe exponer
su ejecución/resultado (paso del orquestador, campo en el scan o clave en
`threat_intel`, o endpoint propio en OSINT/Code). Sin eso, `planned`.

---

## 6. Implementado (resultado)

| # | Estado | Detalle |
|---|---|---|
| C1 | ✔ | `lib/skills.ts`: `getSkillsByCategory`, `getSkillsBySubgroup`, `getSkillNames` y `AVAILABLE_SKILLS` devuelven solo `available`; `getToolDocs` excluye `planned`. Probado con una Skill `planned` de ejemplo (Amass, solo en una copia temporal): no aparece en navegación, ToolGrid, fuentes de Huella ni `/docs`. Hoy las 29 son `available`, así que **no cambia ningún comportamiento actual**. |
| C2 | ✔ | Eliminados `tags`, `order`, `requirements`, `meta`, `CATEGORY_COLOR`, `CATEGORY_ROUTE` (sin datos ni lectores; `grep` sin usos). |
| C3 | ✔ | `messages/{es,en}.json`: nuevo namespace `skills.<id>.{short,description,features[]}` (29 `short`, 19 con `description`+`features`). Migrados sin cambiar el texto los 99 textos `docs.tool*` / `docs.<xyz>Desc|FeatureN`, `scanner.toolDesc` y `footprint.sources.role`, que se eliminaron. `SkillDocs` ahora es `{usage, documentationUrl}`. Paridad ES/EN: 0 diferencias. |
| C4 | ✔ | `scan-form`, `FootprintSources`, `app/osint`, `app/code-scan` leen `skills.<id>.short`. En OSINT/Code el texto ES es idéntico; ganan versión EN (antes estaban fijos en español). |
| C5 | ✔ | `scan-form`: nombre e icono vía `getSkillById` / `getSkillSvgIcon`; se quitaron 10 imports de iconos y `name`/`icon` duplicados. |
| C6 | ✔ | `scripts/check-skills.mjs` + `npm run check:skills`. Probado en negativo (planned con docs, subgroup inexistente, `svgIconKey` inexistente, id no kebab-case, textos faltantes, sin extractor → 9 errores detectados, exit 1). |
| C7 | ✔ | `getExtractorCoverageGaps()` en `lib/scan-extractors.ts` (la usa el script y la advertencia de desarrollo). También detecta extractores huérfanos. |
| C8 | ✔ | `public/docs/adding-a-skill.md` reescrito: flujo real, convención i18n y matriz de archivos por tipo. Corrige la versión anterior, que decía que una Skill `planned` aparecería en el menú. |

### Decisiones deliberadas (lo que NO se cambió)

* **Listas del contrato de ejecución (D6)** y **contenido de marketing/demo
  (D7)**: se dejan tal cual y se documentan en la matriz. Derivarlas exigiría
  ampliar el contrato con el backend o rediseñar pantallas.
* **Divergencias visibles de Code Security (D2)**: el nombre `OWASP
  Dependency-Check` y los iconos de la página difieren del Registry. Cambiarlos
  sería un cambio visual/de nombres sin evidencia del código; queda anotado
  para decisión del equipo.
* **`targetSupport`**: se conserva (dato verificado) pero sin consumidor; no se
  amplía hasta que exista una vista que lo use.
* **`components/tool-icons.tsx`**: la indexación por nombre visible se mantiene
  porque `ScanPipeline` la usa con nombres de paso del backend; el enlace desde
  el Registry (`svgIconKey`) ya es validado por `check:skills`.
* Injection Scanner no tiene logo propio: se mantiene el icono Lucide de
  respaldo (no se inventa un logo).

### Backend
`server/`, Docker, Redis, Celery, orquestador, módulos y contratos API:
**sin modificaciones**.
