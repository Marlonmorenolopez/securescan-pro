# ESTRUCTURA DEL PROYECTO
## SecureScan Pro v5.0 — Árbol de Archivos y Responsabilidades

**Autor:** Técnico en Seguridad de Aplicaciones Web
**Institución:** SENA — Servicio Nacional de Aprendizaje (Colombia)
**Programa:** Técnico en Seguridad de Aplicaciones Web
**Fecha de actualización:** Julio 2026

---

## TABLA DE CONTENIDOS

1. [Vista General del Proyecto](#1-vista-general-del-proyecto)
2. [Árbol Completo de Archivos](#2-árbol-completo-de-archivos)
3. [Raíz del Proyecto — Archivos de Configuración Global](#3-raíz-del-proyecto--archivos-de-configuración-global)
4. [server/ — Backend Python/Flask](#4-server--backend-pythonflask)
5. [server/modules/ — Módulos de Seguridad](#5-servermodules--módulos-de-seguridad)
6. [server/utils/ — Utilidades del Backend](#6-serverutils--utilidades-del-backend)
7. [app/ — Next.js App Router (Frontend)](#7-app--nextjs-app-router-frontend)
8. [components/ — Componentes React](#8-components--componentes-react)
9. [components/cyber/ — Sistema de Diseño Cyber](#9-componentscyber--sistema-de-diseño-cyber)
10. [components/ui/ — Librería Shadcn/ui](#10-componentsui--librería-shadcnui)
11. [lib/ — Lógica Cliente Compartida](#11-lib--lógica-cliente-compartida)
12. [i18n/ — Internacionalización](#12-i18n--internacionalización)
13. [messages/ — Traducciones](#13-messages--traducciones)
14. [public/ — Assets Estáticos y Documentación](#14-public--assets-estáticos-y-documentación)
15. [Archivos de Infraestructura y Automatización](#15-archivos-de-infraestructura-y-automatización)
16. [Archivos de Configuración de Herramientas](#16-archivos-de-configuración-de-herramientas)
17. [Métricas Reales del Proyecto](#17-métricas-reales-del-proyecto)
18. [Convenciones de Nombrado](#18-convenciones-de-nombrado)
19. [Flujo de Datos entre Capas](#19-flujo-de-datos-entre-capas)

---

## 1. VISTA GENERAL DEL PROYECTO

SecureScan Pro v5.0 es un monorepo que contiene el frontend Next.js y el backend Flask en un único repositorio. La raíz del repositorio aloja el proyecto Next.js, mientras que el backend reside completamente dentro del subdirectorio `server/`. Toda la infraestructura de contenedores se define desde la raíz mediante `docker-compose.yml`.

```
Tipo de proyecto:      Monorepo (frontend + backend en mismo repositorio)
Package manager:       pnpm@8.15.0 (frontend) / pip (backend)
Runtime frontend:      Node.js ≥ 20.0.0
Runtime backend:       Python 3.11
Framework frontend:    Next.js 16.2.9 / React 19.2.7 / TypeScript 5.4
Contenedorización:     Docker Compose v2 — 10 servicios
Internacionalización:  next-intl 4.13.0 (español + inglés)
Animaciones:           Framer Motion 12.40.0
Entorno de destino:    Kali Linux / Ubuntu 24 / Windows 11 + Docker Desktop
IDE recomendado:       VS Code
Zona horaria:          America/Bogota (configurada en containers)
```

---

## 2. ÁRBOL COMPLETO DE ARCHIVOS

```
SecureScan-main/
│
├── ── CONFIGURACIÓN GLOBAL ─────────────────────────────────────────
│
├── docker-compose.yml               # Orquestación: 10 servicios Docker
├── Dockerfile.frontend              # Build multi-stage frontend (node:20-alpine)
├── .env.example                     # Plantilla de variables de entorno (40 vars)
├── .gitignore                       # Exclusiones Git (incluye .env, node_modules)
├── .dockerignore                    # Exclusiones para build Docker
├── start.sh                         # Script de arranque completo en orden
├── verify.sh                        # Script de verificación principal
├── verify_securescan.sh             # Script de verificación extendida
├── fix_frontend_dvwa.sh             # Script de reparación DVWA + Frontend
├── patch_i18n.py                    # Script de parche del sistema i18n
│
├── ── FRONTEND (Next.js 16.2.9 / React 19 / TypeScript 5.4) ──────
│
├── package.json                     # Dependencias Node.js (pnpm@8.15.0)
├── pnpm-lock.yaml                   # Lockfile de dependencias pnpm
├── next.config.mjs                  # Config Next.js: rewrites, headers, CSP, output
├── tailwind.config.ts               # Config Tailwind CSS v3 + tokens cyber custom
├── tsconfig.json                    # Config TypeScript (strict, paths @/*)
├── postcss.config.js                # PostCSS: tailwindcss + autoprefixer
├── components.json                  # Config Shadcn/ui (estilo, paths, iconos)
├── global.d.ts                      # Declaraciones de tipos globales
├── next-env.d.ts                    # Tipos generados por Next.js (no editar)
├── proxy.ts                         # Configuración de proxy para rewrites
│
├── app/                             # App Router de Next.js (páginas y layouts)
│   ├── layout.tsx                   # Layout raíz: ThemeProvider, i18n, Toaster
│   ├── globals.css                  # Variables CSS globales + estilos cyber
│   ├── page.tsx                     # Landing page (645 líneas)
│   ├── scanner/
│   │   └── page.tsx                 # Página principal del escáner (598 líneas)
│   ├── history/
│   │   └── page.tsx                 # Historial de escaneos (465 líneas)
│   ├── lab/
│   │   └── page.tsx                 # Panel de control del laboratorio (532 líneas)
│   ├── docs/
│   │   └── page.tsx                 # Documentación + visor Markdown (689 líneas)
│   └── api/
│       └── docs/
│           └── [slug]/
│               └── route.ts         # API Route: sirve docs Markdown estáticos
│
├── components/                      # Componentes React de la aplicación
│   ├── header.tsx                   # Header de navegación global (203 líneas)
│   ├── scan-form.tsx                # Formulario de inicio de escaneo (464 líneas)
│   ├── scan-progress.tsx            # Progreso en tiempo real del scan (365 líneas)
│   ├── results-dashboard.tsx        # Dashboard de resultados completo (1.134 líneas)
│   ├── report-download-modal.tsx    # Modal para descarga de reportes (305 líneas)
│   ├── tool-icons.tsx               # Iconos SVG de las 11 herramientas (261 líneas)
│   ├── language-switcher.tsx        # Selector de idioma ES/EN
│   ├── theme-provider.tsx           # Provider de tema claro/oscuro
│   ├── page-transition.tsx          # Animaciones de transición entre páginas
│   ├── particles-provider.tsx       # Provider de partículas de fondo
│   │
│   ├── cyber/                       # Sistema de diseño Cyber (17 archivos)
│   │   ├── CyberButton.tsx          # Botón con variantes cyber (104 líneas)
│   │   ├── CyberCard.tsx            # Tarjeta con glow y borde cyber (80 líneas)
│   │   ├── CyberPanel.tsx           # Panel con header y subtítulo (54 líneas)
│   │   ├── CyberBadge.tsx           # Badge de severidad/estado (59 líneas)
│   │   ├── CyberStat.tsx            # Estadística con label e icono (90 líneas)
│   │   ├── CyberTable.tsx           # Tabla con estilos cyber (113 líneas)
│   │   ├── CyberParticles.tsx       # Partículas animadas de fondo (127 líneas)
│   │   ├── HeroParticles.tsx        # Partículas del hero principal (55 líneas)
│   │   ├── ThreatMap.tsx            # Mapa de amenazas animado (215 líneas)
│   │   ├── RiskGauge.tsx            # Gauge circular de riesgo (84 líneas)
│   │   ├── SecurityMetrics.tsx      # Panel de métricas de seguridad (131 líneas)
│   │   ├── SecurityOverview.tsx     # Resumen general de seguridad (67 líneas)
│   │   ├── SecurityToolkit.tsx      # Grid de herramientas disponibles (68 líneas)
│   │   ├── ResultsDashboardPreview.tsx # Preview del dashboard en landing (98 líneas)
│   │   ├── RecentActivity.tsx       # Feed de actividad reciente (94 líneas)
│   │   ├── EmptyState.tsx           # Estado vacío con icono y mensaje (41 líneas)
│   │   └── index.ts                 # Re-exportaciones del sistema cyber (23 líneas)
│   │
│   └── ui/                          # Librería Shadcn/ui (55 archivos)
│       └── [ver Sección 10]
│
├── lib/                             # Lógica cliente compartida (6 archivos)
│   ├── api-client.ts                # Cliente HTTP tipado para la API (523 líneas)
│   ├── scan-context.tsx             # React Context del estado de escaneo (414 líneas)
│   ├── validators.ts                # Validación de inputs del formulario (137 líneas)
│   ├── motion.ts                    # Variantes de animación Framer Motion (193 líneas)
│   ├── home-mock-data.ts            # Datos mock para la landing page (208 líneas)
│   └── utils.ts                     # Utilidad cn() — tailwind-merge + clsx (6 líneas)
│
├── i18n/                            # Configuración de internacionalización
│   ├── request.ts                   # Configuración de locale por petición (16 líneas)
│   └── routing.ts                   # Rutas localizadas (7 líneas)
│
├── messages/                        # Traducciones de la interfaz
│   ├── es.json                      # Textos en español (~1.100 keys)
│   └── en.json                      # Textos en inglés (~1.100 keys)
│
├── public/                          # Assets estáticos servidos directamente
│   ├── apple-icon.png               # Icono para dispositivos Apple
│   ├── icon.png                     # Icono principal
│   ├── icon-dark-100x100.png        # Favicon modo oscuro
│   ├── icon-light-100x100.png       # Favicon modo claro
│   ├── icon-real.png                # Icono alternativo
│   ├── docs.png                     # OG image página de docs
│   ├── history.png                  # OG image página de historial
│   ├── lab.png                      # OG image página del laboratorio
│   ├── scanner.png                  # OG image página del scanner
│   └── docs/                        # Documentación Markdown estática (6 archivos)
│       ├── api.md
│       ├── architecture.md
│       ├── contributing.md
│       ├── deployment.md
│       ├── security.md
│       └── tools.md
│
└── ── BACKEND (Python 3.11 / Flask) ───────────────────────────────
│
└── server/
    ├── app.py                       # Aplicación Flask principal (1.068 líneas)
    ├── Dockerfile                   # Imagen backend v3.1.3 (python:3.11-slim-bookworm)
    ├── entrypoint.sh                # Script de inicialización pre-Gunicorn
    ├── requirements.txt             # Dependencias Python del backend
    ├── wordlist-common.txt          # Wordlist fallback para Gobuster/ffuf
    │
    ├── modules/                     # Módulos de herramientas de seguridad (13 archivos)
    │   ├── __init__.py
    │   ├── orchestrator.py          # Pipeline central de 11 pasos (1.234 líneas)
    │   ├── injection_scanner.py     # Motor propio — 10 técnicas (1.720 líneas)
    │   ├── zap_scanner.py           # DAST con OWASP ZAP (1.354 líneas)
    │   ├── sqlmap.py                # Detección SQL Injection (1.265 líneas)
    │   ├── gobuster.py              # Enumeración de directorios (769 líneas)
    │   ├── patator.py               # Fuerza bruta HTTP (693 líneas)
    │   ├── nuclei.py                # Escaneo por plantillas (562 líneas)
    │   ├── scoring.py               # [ver utils/] — importado aquí
    │   ├── nmap_scanner.py          # Escaneo de puertos (359 líneas)
    │   ├── metasploit.py            # Módulos Metasploit via RPC (306 líneas)
    │   ├── ffuf.py                  # Fuzzing de endpoints (305 líneas)
    │   ├── searchsploit.py          # Búsqueda en ExploitDB (262 líneas)
    │   └── wappalyzer.py            # Fingerprinting tecnológico (228 líneas)
    │
    └── utils/
        ├── __init__.py              # Inicializador del paquete (13 líneas)
        ├── reporter.py              # Generación HTML/PDF/JSON/CSV (1.382 líneas)
        ├── scoring.py               # Puntuación de seguridad 0-100 (565 líneas)
        └── i18n_backend.py          # Internacionalización del backend (72 líneas)
```

---

## 3. RAÍZ DEL PROYECTO — ARCHIVOS DE CONFIGURACIÓN GLOBAL

### docker-compose.yml

**Responsabilidad:** Orquestación completa de los 10 servicios de la plataforma.

**Servicios definidos:**

| Nombre | Container | Función | Puerto |
|---|---|---|---|
| `frontend` | `securescan-frontend` | UI Next.js | 3000 |
| `api` | `securescan-api` | Backend Flask | 5000 |
| `redis` | `securescan-redis` | Cache y estado | 6379 (solo localhost) |
| `zap` | `securescan-zap` | OWASP ZAP DAST | 8080 |
| `sqlmapapi` | `securescan-sqlmapapi` | SQLMap REST API | 8775 (solo localhost) |
| `msfrpcd` | `securescan-msfrpcd` | Metasploit RPC daemon | 55553 |
| `juice-shop` | `juice-shop` | OWASP Juice Shop | 3001 |
| `dvwa` | `dvwa` | DVWA (PHP) | 3002 |
| `dvwa-db` | `dvwa-db` | MariaDB 10.11 | — (interno) |
| `webgoat` | `webgoat` | WebGoat (Java) | 3003 |

**Redes definidas:**
- `securescan-net` — subnet `172.20.0.0/16` — servicios principales
- `lab-net` — subnet `172.21.0.0/16` — laboratorio aislado (sin internet)

**Volúmenes persistentes:**
- `redis-data` — resultados de escaneos
- `scan-reports` — reportes generados (montado en `/app/reports`)
- `dvwa-db-data` — base de datos MariaDB de DVWA
- `msf-data` — configuración Metasploit
- `nuclei-templates` — 13.000+ plantillas de vulnerabilidades
- `juice-shop-data` — datos de Juice Shop
- `webgoat-data` — datos de WebGoat

### Dockerfile.frontend

Build multi-stage del frontend Next.js. Implementa tres stages:

```
Stage 1 "deps":
  Base: node:20-alpine
  Activa pnpm@8.15.0 con corepack
  Instala dependencias con --frozen-lockfile

Stage 2 "builder":
  Copia node_modules desde "deps"
  Copia fuentes: app/, components/, lib/, public/, i18n/, messages/, configs
  BACKEND_URL=http://api:5000       (rewrites server-side y SSR)
  NEXT_PUBLIC_API_URL=http://localhost:5000  (llamadas del browser)
  Ejecuta pnpm build → genera .next/standalone

Stage 3 "runner":
  Base: node:20-alpine
  Crea usuario nextjs:nodejs (no-root)
  Copia solo .next/standalone y .next/static
  Arranca con: node server.js en puerto 3000
```

### start.sh

Script bash de arranque completo en el orden correcto. Pasos:

1. Verifica `docker` y `docker compose v2` disponibles
2. Crea `.env` desde `.env.example` si no existe
3. Construye imágenes `api`, `sqlmapapi` y `frontend`
4. Arranca Redis y espera PONG
5. Arranca ZAP en background (~60s para estar listo)
6. Arranca `dvwa-db` → espera 5s → arranca DVWA, WebGoat, Juice Shop
7. Arranca Metasploit en background (~2-5 min)
8. Arranca API + sqlmapapi → espera 10s → arranca frontend
9. Polling a `/api/health` (máximo 60 intentos)
10. Muestra resumen con URLs y comandos útiles

### verify.sh / verify_securescan.sh

Scripts de verificación del estado completo. Comprueban: containers Docker, endpoints del backend, frontend, labs, ZAP y herramientas dentro del container API. Muestran conteo final de comprobaciones pasadas/fallidas.

### patch_i18n.py

Script de parche para el sistema de internacionalización. Corrige inconsistencias en los archivos de traducción `es.json` y `en.json` cuando se añaden nuevas keys al proyecto.

---

## 4. server/ — BACKEND PYTHON/FLASK

### server/app.py — Aplicación Flask Principal

**Líneas:** 1.068
**Responsabilidad:** Punto de entrada de la API REST. Inicialización de Flask, Redis, CORS, rate limiting, autenticación por token, validación de targets, circuit breaker y gestión del ciclo de vida de los escaneos.

**Endpoints expuestos:**

| Método | Path | Autenticación | Rate limit |
|---|---|---|---|
| GET | `/api/health` | No | Exento |
| POST | `/api/scan` | Token | 20/hora |
| GET | `/api/scan/<id>/status` | Token | Exento |
| GET | `/api/scan/<id>/report` | Token | Exento |
| DELETE | `/api/scan/<id>` | Token | Default |
| GET | `/api/history` | Token | Default |
| GET | `/api/config` | No | Default |
| GET | `/api/lab/status` | Token | Exento |
| POST | `/api/lab/<id>/start` | Token | Default |
| POST | `/api/lab/<id>/stop` | Token | Default |

**Componentes internos clave:**

| Componente | Descripción |
|---|---|
| `require_token()` | Decorador de autenticación `X-API-Token` |
| `get_scan_storage()` | Detección de disponibilidad Redis (cache 10s) |
| `save_scan()` / `get_scan()` | Almacenamiento dual Redis/memoria |
| `scans_fallback` | Dict en memoria protegido con `threading.Lock` |
| `_cb_is_open()` | Circuit Breaker — 3 fallos → abre por 60s |
| `run_scan()` | Función ejecutada en thread separado |
| `_persist_step_result()` | Guarda resultado parcial sin sobreescribir |
| `is_allowed_target()` | Validación multi-capa de targets |

**Constantes relevantes:**
```python
_FALLBACK_MAX_SCANS = 200    # Límite anti-OOM en memoria
_REDIS_CACHE_TTL    = 10     # Segundos entre pings a Redis
FORBIDDEN_PATTERNS  = [      # Bloquea localhost, 0.0.0.0, ::1
    r'^localhost', r'^0\.0\.0\.0', r'^::1'
]
ALLOWED_LAB_TARGETS = [      # juice-shop:3000, dvwa:80, webgoat:8080
    'juice-shop:3000', 'dvwa:80', 'webgoat:8080'
]
```

### server/Dockerfile — Imagen Docker del Backend

**Versión:** 3.1.3 | **Base:** `python:3.11-slim-bookworm` | **Tamaño:** ~4 GB

Secuencia de construcción:
1. Paquetes APT: `nmap`, `patator`, `curl`, `git`, `wkhtmltopdf`, `xvfb`, `libcap2-bin`
2. Go 1.22.5 (manual — Debian bookworm trae 1.19, incompatible con las herramientas)
3. SQLMap desde GitHub → enlace simbólico en `/usr/local/bin/`
4. Herramientas Go: `gobuster v3.6.0`, `ffuf v2.1.0`, `nuclei v3.2.4`
5. `python-Wappalyzer`, `requests`, `beautifulsoup4`
6. SecLists (~1.5 GB) clonado en `/opt/SecLists`
7. ExploitDB clonado en `/opt/exploitdb` + enlace `searchsploit`
8. Usuario no-root `scanner` + `setcap` para nmap
9. Dependencias Python desde `requirements.txt` + gunicorn
10. Nuclei-templates (~13.000 yamls) en `/home/scanner/nuclei-templates`
11. Directorio de reportes `/app/reports`

**Comando final:**
```bash
gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 4
         --worker-class sync --worker-tmp-dir /dev/shm
         --timeout ${GUNICORN_TIMEOUT:-3600} --graceful-timeout 30
         app:app
```

### server/requirements.txt

```
flask>=3.0.0,<4.0.0          # Framework web
flask-cors>=4.0.0,<5.0.0     # CORS middleware
flask-limiter>=3.5.0,<4.0.0  # Rate limiting (20 req/h en POST /api/scan)
requests>=2.31.0,<3.0.0      # HTTP client (ZAP API, auto-login)
redis>=5.0.0,<6.0.0          # Cliente Redis
pdfkit>=1.0.0,<2.0.0         # Generación PDFs (requiere wkhtmltopdf)
pymetasploit3>=1.0.3         # RPC client Metasploit
python-Wappalyzer>=0.3.1     # Fingerprinting tecnológico
python-dotenv>=1.0.0,<2.0.0  # Carga de .env
pydantic>=2.0.0,<3.0.0       # Validación de modelos
jinja2>=3.1.0,<4.0.0         # Templates HTML para reportes
docker>=7.1.0                 # Docker SDK (endpoints /api/lab/*)
beautifulsoup4>=4.12.0       # Parser HTML (auto-login DVWA/WebGoat)
gunicorn>=21.2.0              # Servidor WSGI de producción
```

---

## 5. server/modules/ — MÓDULOS DE SEGURIDAD

Cada módulo es un archivo Python independiente con una clase que sigue el patrón:
**inicialización → `scan()` → lista de dicts estandarizados**.

Todos implementan `_simulate_scan()` como fallback cuando la herramienta no está disponible. Los resultados simulados siempre incluyen `"simulated": True`.

### orchestrator.py — Director del Pipeline

**Líneas:** 1.234 | **Clase:** `SecurityOrchestrator`

Coordina la ejecución secuencial de los 11 módulos, gestiona timeouts con `threading.Event`, retries con backoff exponencial, circuit breaker interno y auto-login por laboratorio.

**Auto-login por laboratorio:**

| Lab | Método | Peticiones | Cookie obtenida |
|---|---|---|---|
| DVWA | Formulario PHP + CSRF token | 4 | `PHPSESSID; security=low` |
| Juice Shop | API REST JSON | 1 | JWT Bearer token |
| WebGoat | Spring Security form | 2 | `JSESSIONID` |

**Pipeline de 11 pasos:**

| Paso | Módulo | Output |
|---|---|---|
| Pre | Auto-login | Cookie de sesión |
| 1 | `wappalyzer.py` | `technologies[]` |
| 2 | `nmap_scanner.py` | `ports[]` |
| 3 | `patator.py` | `brute_force_results[]` |
| 4 | `metasploit.py` | `metasploit[]` |
| 5 | `ffuf.py` | `ffuf_endpoints[]` |
| 6 | `gobuster.py` | `directories[]` |
| 7 | `zap_scanner.py` | `vulnerabilities[]` |
| 8 | `nuclei.py` | `nuclei_findings[]` |
| 9 | `injection_scanner.py` | `sqli_results[]` |
| 10 | `searchsploit.py` | `exploits[]` |
| 11 | `scoring.py` | `score{}` |

### injection_scanner.py — Módulo Propio

**Líneas:** 1.720 — el más extenso del proyecto | **Clase:** `InjectionScanner`

Motor desarrollado desde cero para SecureScan Pro. Detecta activamente 10 técnicas de inyección:

| # | Técnica | Subtipos |
|---|---|---|
| 1 | SQL Injection | Error-based, UNION, Boolean-Blind, Time-Blind, Auth-Bypass, Stacked, Second-Order |
| 2 | NoSQL Injection | MongoDB `$gt`, `$ne`, regex bypass |
| 3 | XPath Injection | Auth bypass, error-based |
| 4 | XXE (XML) | File read, OOB, Blind |
| 5 | XSS | Reflected, Stored, DOM |
| 6 | Command Injection | `;`, `\|`, backticks, `&&` |
| 7 | Path Traversal | LFI, `../../../etc/passwd`, Windows paths |
| 8 | SSRF | Acceso a hosts internos, bypass CORS |
| 9 | SSTI | Jinja2 `{{7*7}}`, Twig, Freemarker, Velocity |
| 10 | LDAP Injection | Filter bypass, wildcard injection |

### zap_scanner.py — OWASP ZAP DAST

**Líneas:** 1.354 | **Clase:** `ZAPScanner`

Función unificada `run_zap_full()` que combina spider y escaneo activo en un solo paso. Recibe las URLs de ffuf y Gobuster para ampliar cobertura.

**Políticas de escaneo por laboratorio:**

| Target | Política ZAP |
|---|---|
| DVWA | `Dev Standard` |
| WebGoat | `Dev Standard` |
| Juice Shop | `Dev CICD` |
| Genérico | `Default Policy` |

### sqlmap.py — SQL Injection

**Líneas:** 1.265 | **Clase:** `SQLMapEnterpriseScanner`

Usa la SQLMap REST API (`sqlmapapi` container, puerto 8775) en lugar de CLI directa. Procesa el campo `value` de la API con `ast.literal_eval()`.

### gobuster.py — Enumeración de Directorios

**Líneas:** 769 | **Clase:** `GobusterEnterpriseScanner`

Cadena de fallback de wordlists:
1. `/usr/share/wordlists/seclists/Discovery/Web-Content/common.txt`
2. `/app/wordlist-common.txt`
3. `/usr/share/wordlists/dirb/common.txt`

### patator.py — Fuerza Bruta

**Líneas:** 693 | **Clase:** `PatatorScanner`

Estrategia en cascada: requests con CSRF → binario patator → simulación.

### nuclei.py — Plantillas de Vulnerabilidades

**Líneas:** 562 | **Clase:** `NucleiScanner`

Usa flag `-jsonl` (una línea JSON por hallazgo). Filtra protocolos innecesarios con `-ept dns,ssl,tcp,whois,javascript` reduciendo 13.000 a ~5.000 templates activos.

### nmap_scanner.py — Escaneo de Puertos

**Líneas:** 359 | **Clase:** `NmapScanner`

```bash
nmap -sV -sC -O --script=banner,version -T4 -p 1-1000[,<extra>] --open -oX - <host>
```

Añade el puerto del target al rango si está fuera de 1-1000.

### metasploit.py — Módulos Auxiliares

**Líneas:** 306 | **Clase:** `MetasploitScanner`

Solo ejecuta módulos `auxiliary/scanner/` — nunca `exploits/`, `post/` ni `payloads/`. Si `msfrpcd` no responde, activa simulación automática.

### ffuf.py — Fuzzing

**Líneas:** 305 | **Clase:** `FfufScanner`

```bash
ffuf -u <target>/FUZZ -w <wordlist> -o output.json -of json
     -H "Cookie: <cookie>" -mc 200,204,301,302,307,401,403 -ac -t 10
```

### searchsploit.py — Exploits Públicos

**Líneas:** 262 | **Clase:** `SearchsploitScanner`

Busca en ExploitDB local con `searchsploit --json <término>`.

### wappalyzer.py — Fingerprinting

**Líneas:** 228 | **Clase:** `WappalyzerScanner`

Cascada: librería Python → CLI wappalyzer → simulación por lab.

---

## 6. server/utils/ — UTILIDADES DEL BACKEND

### reporter.py — Generación de Reportes

**Líneas:** 1.382 | **Clase:** `ReportGenerator`

| Función | Formato | Descripción |
|---|---|---|
| `generate_html_report()` | `.html` | CSS embebido, sanitización XSS con `html.escape()` |
| `generate_pdf_report()` | `.pdf` | HTML → PDF con `pdfkit` + `wkhtmltopdf` |
| `generate_json_report()` | `.json` | Datos completos estructurados |
| `generate_csv_report()` | `.csv` | Solo vulnerabilidades en tabla plana |

Almacenamiento: `/app/reports/report-<scan_id>.<formato>` (volumen `scan-reports`).

### scoring.py — Puntuación de Seguridad

**Líneas:** 565 | **Función principal:** `calculate_security_score(results)`

```python
@dataclass
class SecurityWeights:
    critical: float = 20.0   # -20 pts por vulnerabilidad crítica
    high:     float = 10.0   # -10 pts
    medium:   float = 5.0    #  -5 pts
    low:      float = 2.0    #  -2 pts
    info:     float = 0.5    # -0.5 pts
    exploit_with_vuln:    float = 8.0  # -8 pts adicionales si hay exploit
    exploit_without_vuln: float = 3.0  # -3 pts
    brute_force_success:  float = 10.0 # -10 pts si hay credenciales débiles
```

**Escala de calificación (13 niveles):**

| Score | Grade | Riesgo |
|---|---|---|
| 95-100 | A+ | BAJO |
| 90-94 | A | BAJO |
| 85-89 | A- | BAJO |
| 80-84 | B+ | BAJO |
| 75-79 | B | MEDIO |
| 70-74 | B- | MEDIO |
| 65-69 | C+ | MEDIO |
| 60-64 | C | ALTO |
| 55-59 | C- | ALTO |
| 50-54 | D+ | ALTO |
| 40-49 | D | CRÍTICO |
| 0-39 | F | CRÍTICO |

### i18n_backend.py — Internacionalización del Backend

**Líneas:** 72

Detecta el idioma del usuario desde el header `Accept-Language` y devuelve textos del backend en español o inglés. Lee desde `server/locales/es.json` y `server/locales/en.json`.

---

## 7. app/ — NEXT.JS APP ROUTER (FRONTEND)

### layout.tsx — Layout Raíz

**Responsabilidad:** Estructura base de la aplicación. Define:
- `NextIntlClientProvider` — expone traducciones a todos los Client Components
- `ThemeProvider` — tema claro/oscuro con `next-themes`
- `ParticlesProvider` — partículas de fondo cyber
- `PageTransition` — animaciones entre páginas con Framer Motion
- `Toaster` — notificaciones toast globales (Sonner)
- Skip to content link para accesibilidad (WCAG 2.4.1)

### globals.css — Estilos Globales

Variables CSS HSL para el sistema de diseño completo en modo claro y oscuro. Incluye tokens cyber personalizados (`--cyber-accent`, `--cyber-purple`, `--cyber-glow`), estilos de accesibilidad WCAG, tooltips CSS, animaciones de carga y estilos para impresión.

### page.tsx — Landing Page (645 líneas)

Hero section, grid de herramientas, estadísticas del proyecto, Quick Start y preview del dashboard de resultados. Usa datos mock de `lib/home-mock-data.ts`.

### scanner/page.tsx — Escáner Principal (598 líneas)

Página más usada del sistema. Contiene `ScanForm`, `ScanProgress` y `ResultsDashboard` con el contexto de escaneo. Incluye grid de Quick Labs (DVWA, Juice Shop, WebGoat con un clic).

### history/page.tsx — Historial (465 líneas)

Lista de los últimos 100 escaneos. Columnas: target, estado, puntuación, fecha, duración. Permite eliminar y descargar reportes de escaneos anteriores.

### lab/page.tsx — Laboratorio (532 líneas)

Panel de control de los tres laboratorios. Polling cada 5 segundos al estado de los containers. Botones Start/Stop, URLs directas y credenciales visibles para uso educativo.

### docs/page.tsx — Documentación (689 líneas)

Cuatro pestañas: Herramientas, API, Arquitectura y Proyecto de Grado. La pestaña de Proyecto de Grado incluye un visor Markdown completo que hace `fetch` de los archivos `.md` desde `/public/docs/` y los renderiza con un parser propio sin dependencias externas.

---

## 8. components/ — COMPONENTES REACT

### scan-form.tsx (464 líneas)

Formulario de configuración e inicio de escaneos. Secciones:
- Input de URL con validación en tiempo real y `aria-describedby` (accesibilidad)
- Botones Quick Lab para los 3 laboratorios
- 10 checkboxes de herramientas con `aria-label` descriptivo por herramienta
- Sección colapsable de opciones avanzadas (dry-run, circuit breaker)
- Botón de inicio con `aria-busy` durante carga

### scan-progress.tsx (365 líneas)

Progreso en tiempo real. Elementos:
- Lista de 12 pasos con icono real de cada herramienta (`tool-icons.tsx`)
- Spinner superpuesto sobre el icono de la herramienta activa
- Barra de progreso global con porcentaje
- Timer `MM:SS` desde inicio
- Polling automático cada 2 segundos a `/api/scan/<id>/status`

### results-dashboard.tsx (1.134 líneas)

Dashboard completo de resultados. 10 pestañas:

| Pestaña | Contenido |
|---|---|
| Resumen | Score, grade, riskLevel, métricas, gráfico de distribución de severidad |
| Wappalyzer | Tecnologías detectadas con versiones |
| Nmap | Puertos abiertos con servicios |
| ffuf | Endpoints descubiertos |
| Gobuster | Directorios y archivos |
| ZAP | Vulnerabilidades DAST filtradas por severidad |
| Nuclei | Hallazgos por plantilla y CVE |
| Patator | Credenciales débiles encontradas |
| Searchsploit | Exploits correlacionados |
| Metasploit | Resultados de módulos auxiliares |

### tool-icons.tsx (261 líneas)

SVG custom para cada herramienta del pipeline: Wappalyzer, Nmap, Gobuster, ZAP, Nuclei, SQLMap, Searchsploit, Metasploit, Patator, ffuf, Juice Shop, DVWA, WebGoat. Usados en `scan-progress.tsx` y `scan-form.tsx`.

### report-download-modal.tsx (305 líneas)

Modal para descarga de reportes en 4 formatos (HTML, PDF, JSON, CSV) mediante `URL.createObjectURL()`.

### header.tsx (203 líneas)

Navegación global: logo, links (Scanner, Historial, Lab, Docs), selector de idioma ES/EN, toggle de tema, indicador de estado de la API.

---

## 9. components/cyber/ — SISTEMA DE DISEÑO CYBER

17 archivos que forman el sistema de diseño visual del proyecto. Todos usan variables CSS `--cyber-accent`, `--cyber-purple`, `--cyber-glow` definidas en `globals.css`.

| Componente | Líneas | Propósito |
|---|---|---|
| `ThreatMap.tsx` | 215 | Mapa animado de amenazas globales (decorativo) |
| `CyberParticles.tsx` | 127 | Partículas de fondo animadas con canvas |
| `CyberTable.tsx` | 113 | Tabla con hover y bordes en color acento |
| `CyberButton.tsx` | 104 | Botón con 5 variantes, tooltip, aria-busy, min 44px táctil |
| `SecurityMetrics.tsx` | 131 | Panel de métricas de seguridad con iconos |
| `RecentActivity.tsx` | 94 | Feed de actividad con timestamps |
| `ResultsDashboardPreview.tsx` | 98 | Preview del dashboard en la landing |
| `CyberStat.tsx` | 90 | Estadística con valor, label e icono |
| `RiskGauge.tsx` | 84 | Gauge SVG circular de nivel de riesgo |
| `CyberCard.tsx` | 80 | Tarjeta con glow opcional y borde animado |
| `SecurityToolkit.tsx` | 68 | Grid de herramientas disponibles |
| `SecurityOverview.tsx` | 67 | Resumen de seguridad en cards |
| `CyberBadge.tsx` | 59 | Badge de severidad (`critical/high/medium/low/info`) |
| `HeroParticles.tsx` | 55 | Partículas del hero de la landing |
| `CyberPanel.tsx` | 54 | Panel con título, subtítulo y slot de contenido |
| `EmptyState.tsx` | 41 | Estado vacío con icono y CTA |
| `index.ts` | 23 | Re-exportaciones del sistema cyber |

---

## 10. components/ui/ — LIBRERÍA SHADCN/UI

55 archivos (53 `.tsx` + 2 `.ts`) construidos sobre Radix UI y estilizados con Tailwind CSS + CVA (class-variance-authority).

**Componentes más relevantes:**

| Archivo | Líneas | Descripción |
|---|---|---|
| `sidebar.tsx` | 726 | Sidebar colapsable con submenús |
| `chart.tsx` | 353 | Wrapper recharts con estilos temáticos |
| `menubar.tsx` | 276 | Barra de menú accesible |
| `dropdown-menu.tsx` | 257 | Menú desplegable (Radix DropdownMenu) |
| `context-menu.tsx` | 252 | Menú de contexto (Radix ContextMenu) |
| `field.tsx` | 244 | Campo de formulario compuesto |
| `carousel.tsx` | 241 | Carrusel (embla-carousel-react) |
| `use-toast.ts` | 191 | Hook de gestión de toasts |
| `select.tsx` | 185 | Select accesible (Radix Select) |
| `command.tsx` | 184 | Paleta de comandos (cmdk) |
| `form.tsx` | 167 | React Hook Form + Radix |
| `dialog.tsx` | 143 | Modal dialog (Radix Dialog) |
| `calendar.tsx` | — | DayPicker v8.10.1 (downgrade intencional — v9 tiene API incompatible) |

---

## 11. lib/ — LÓGICA CLIENTE COMPARTIDA

### api-client.ts (523 líneas)

Cliente HTTP tipado. Centraliza todas las llamadas al backend.

**Interfaces TypeScript principales:**
```typescript
type Grade      = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'F'
type RiskLevel  = 'COMPROMETIDO' | 'EXPUESTO' | 'VULNERABLE' | 'PROTEGIDO'
                | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL' // compatibilidad

interface SecurityScore {
  total:           number
  grade:           Grade
  breakdown:       { critical: number; high: number; medium: number; low: number; info: number }
  riskLevel:       RiskLevel
  recommendations: string[]
  metrics:         { total_vulns: number; max_cvss: number; exploitable: number }
}
```

**Funciones exportadas:**

| Función | Método | Endpoint |
|---|---|---|
| `startScan(target, options)` | POST | `/api/scan` |
| `getScanResults(jobId)` | GET | `/api/scan/<id>/status` |
| `getScanHistory()` | GET | `/api/history` |
| `deleteScan(scanId)` | DELETE | `/api/scan/<id>` |
| `downloadReport(scanId, format)` | GET | `/api/scan/<id>/report?format=<fmt>` |
| `getLabStatus()` | GET | `/api/lab/status` |
| `startLab(labId)` | POST | `/api/lab/<id>/start` |
| `stopLab(labId)` | POST | `/api/lab/<id>/stop` |
| `getConfig()` | GET | `/api/config` |
| `healthCheck()` | GET | `/api/health` |

### scan-context.tsx (414 líneas)

React Context del estado global de escaneo.

```typescript
interface ScanContextValue {
  currentScan: ScanResults | null
  isScanning:  boolean
  error:       string | null
  startScan:   (target: string, options: ScanOptions) => Promise<void>
  cancelScan:  () => void
  clearResults: () => void
  clearError:  () => void
}
```

Polling cada 2 segundos con `setInterval`. Se detiene automáticamente cuando `status === 'completed' | 'error'`.

### motion.ts (193 líneas)

Variantes de animación Framer Motion reutilizables:
- `fadeIn`, `slideInUp`, `slideInLeft`, `scaleIn` — para elementos individuales
- `staggerContainer`, `staggerItem` — para listas animadas
- `getVariants(variant, prefersReduced)` — respeta `prefers-reduced-motion`

### home-mock-data.ts (208 líneas)

Datos mock para la landing page: escaneos de ejemplo, métricas simuladas, hallazgos de muestra. Permite que la landing se vea completa sin necesitar datos reales del backend.

### validators.ts (137 líneas)

Validaciones del formulario: `validateTarget()`, `validateLabTarget()`, `isValidURL()`, `sanitizeTarget()`.

### utils.ts (6 líneas)

```typescript
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

---

## 12. i18n/ — INTERNACIONALIZACIÓN

### i18n/request.ts (16 líneas)

Configura `next-intl` para detectar el locale de cada petición desde las cookies del usuario.

### i18n/routing.ts (7 líneas)

Define las rutas localizadas: `locales: ['es', 'en']`, `defaultLocale: 'es'`.

---

## 13. messages/ — TRADUCCIONES

### es.json / en.json (~1.100 keys cada uno)

Contienen todos los textos visibles de la interfaz organizados por sección:

| Sección | Keys principales |
|---|---|
| `scanner` | Formulario, herramientas, estados del escaneo, tooltips, mensajes de error |
| `history` | Historial, filtros, acciones |
| `lab` | Panel de laboratorio, estados de containers |
| `docs` | Documentación, herramientas, API, arquitectura |
| `results` | Dashboard de resultados, tabs, métricas |
| `header` | Navegación, estado de API |
| `common` | Mensajes globales, acciones comunes |

---

## 14. public/ — ASSETS ESTÁTICOS Y DOCUMENTACIÓN

### public/docs/

6 archivos Markdown servidos por `app/api/docs/[slug]/route.ts` y renderizados en la pestaña "Herramientas/API/Arquitectura" de `app/docs/page.tsx`.

Los **4 documentos del proyecto de grado** se añaden también a esta carpeta:
- `DOCUMENTACION_TECNICA_COMPLETA.md`
- `ETICA_Y_LEGALIDAD.md`
- `GUIA_DESPLIEGUE_SECURESCAN_PRO_v5.md`
- `PRESENTACION_PROYECTO_GRADO.md`

Y son servidos por el mismo mecanismo y visualizados en la pestaña **"Proyecto de Grado"** del visor Markdown integrado.

### Imágenes OG (Open Graph)

`scanner.png`, `history.png`, `lab.png`, `docs.png` — imágenes de preview para redes sociales y pestañas del navegador.

---

## 15. ARCHIVOS DE INFRAESTRUCTURA Y AUTOMATIZACIÓN

| Script | Propósito | Cuándo usar |
|---|---|---|
| `start.sh` | Arranque completo en orden correcto | Primera instalación o reinicio |
| `verify.sh` | Verificación principal de servicios | Diagnóstico post-arranque |
| `verify_securescan.sh` | Verificación extendida con más checks | Validación completa del sistema |
| `fix_frontend_dvwa.sh` | Reparación de DVWA y Frontend | Cuando alguno no responde |
| `patch_i18n.py` | Corrección del sistema de traducciones | Tras añadir nuevas keys de traducción |

---

## 16. ARCHIVOS DE CONFIGURACIÓN DE HERRAMIENTAS

### next.config.mjs

- `reactStrictMode: true`
- `poweredByHeader: false`
- `output: 'standalone'` (Docker)
- `rewrites()` — proxy `/api/*` → `${BACKEND_URL}`
- `headers()` — CSP completo, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
- `compiler.removeConsole` en producción

### tsconfig.json

- `"strict": true`
- `"target": "ES6"`
- `"moduleResolution": "bundler"`
- `"paths": { "@/*": ["./*"] }`

### tailwind.config.ts

- `darkMode: ["class"]`
- `theme.extend.colors` — tokens HSL del sistema de diseño
- Tokens cyber custom: `cyber-accent`, `cyber-purple`, `cyber-green`, `cyber-red`
- `plugins: [tailwindcss-animate]`

---

## 17. MÉTRICAS REALES DEL PROYECTO

### Backend Python — Líneas por archivo (verificadas del ZIP)

| Archivo | Líneas | Rol |
|---|---|---|
| `injection_scanner.py` | 1.720 | Motor de inyección propio (el más extenso) |
| `reporter.py` | 1.382 | Generación de reportes 4 formatos |
| `zap_scanner.py` | 1.354 | Integración OWASP ZAP |
| `sqlmap.py` | 1.265 | Integración SQLMap Enterprise |
| `orchestrator.py` | 1.234 | Pipeline central |
| `app.py` | 1.068 | API Flask principal |
| `gobuster.py` | 769 | Integración Gobuster |
| `patator.py` | 693 | Integración Patator |
| `nuclei.py` | 562 | Integración Nuclei |
| `scoring.py` | 565 | Sistema de puntuación |
| `nmap_scanner.py` | 359 | Integración Nmap |
| `metasploit.py` | 306 | Integración Metasploit |
| `ffuf.py` | 305 | Integración ffuf |
| `searchsploit.py` | 262 | Integración Searchsploit |
| `wappalyzer.py` | 228 | Integración Wappalyzer |
| `i18n_backend.py` | 72 | Backend i18n |
| `__init__.py` (x2) | 14 | Inicializadores |
| **TOTAL BACKEND** | **12.158** | |

### Frontend TypeScript — Archivos principales

| Archivo | Líneas | Rol |
|---|---|---|
| `results-dashboard.tsx` | 1.134 | Dashboard de resultados (el más extenso del frontend) |
| `app/docs/page.tsx` | 689 | Documentación + visor Markdown |
| `app/page.tsx` | 645 | Landing page |
| `app/scanner/page.tsx` | 598 | Página principal del escáner |
| `app/lab/page.tsx` | 532 | Panel del laboratorio |
| `lib/api-client.ts` | 523 | Cliente HTTP tipado |
| `app/history/page.tsx` | 465 | Historial |
| `components/scan-form.tsx` | 464 | Formulario de escaneo |
| `lib/scan-context.tsx` | 414 | Context global |
| `components/scan-progress.tsx` | 365 | Progreso en tiempo real |
| `components/report-download-modal.tsx` | 305 | Modal de descarga |
| `components/tool-icons.tsx` | 261 | Iconos SVG de herramientas |
| `lib/home-mock-data.ts` | 208 | Datos mock landing |
| `components/header.tsx` | 203 | Navegación global |
| `lib/motion.ts` | 193 | Variantes Framer Motion |
| `lib/validators.ts` | 137 | Validación de inputs |
| `components/cyber/` (17 archivos) | ~1.508 | Sistema de diseño cyber |
| `components/ui/` (55 archivos) | ~6.281 | Librería Shadcn/ui |
| `i18n/`, `messages/`, configs | ~800 | i18n, traducciones, config |
| **TOTAL FRONTEND** | **~15.294** | |

### Resumen global

| Categoría | Archivos | Líneas |
|---|---|---|
| Backend Python | 17 archivos | 12.158 |
| Frontend (sin ui/) | ~35 archivos | ~9.013 |
| Frontend ui/ (Shadcn/ui) | 55 archivos | ~6.281 |
| Configuración, scripts, i18n | ~15 archivos | ~800 |
| **TOTAL DEL PROYECTO** | **~122 archivos** | **~28.252** |

---

## 18. CONVENCIONES DE NOMBRADO

### Backend Python

| Elemento | Convención | Ejemplo |
|---|---|---|
| Clases | PascalCase | `SecurityOrchestrator`, `NucleiScanner` |
| Funciones/métodos | snake_case | `run_full_scan()`, `calculate_security_score()` |
| Métodos privados | `_snake_case` | `_simulate_scan()`, `_cb_is_open()` |
| Constantes de módulo | `_SCREAMING_SNAKE_CASE` | `_SKIP_EXPLOIT_TERMS`, `_DEFAULT_USERS` |
| Constantes globales | `SCREAMING_SNAKE_CASE` | `FORBIDDEN_PATTERNS`, `ALLOWED_LAB_TARGETS` |
| Variables de entorno | `SCREAMING_SNAKE_CASE` | `SCAN_TIMEOUT_ZAP`, `RESTRICT_TO_LAB_TARGETS` |
| Archivos de módulos | `snake_case.py` | `nmap_scanner.py`, `injection_scanner.py` |

### Frontend TypeScript

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes React | PascalCase | `ScanForm`, `CyberButton`, `ThreatMap` |
| Componentes Cyber | `Cyber` + PascalCase | `CyberCard`, `CyberBadge` |
| Hooks | `use` + camelCase | `useScan`, `useIsMobile`, `useReducedMotion` |
| Interfaces | PascalCase | `ScanResults`, `SecurityScore` |
| Types simples | PascalCase | `Grade`, `RiskLevel`, `ToolId` |
| Variantes de animación | camelCase | `fadeIn`, `staggerContainer`, `slideInUp` |
| Archivos de componentes | `kebab-case.tsx` | `scan-form.tsx`, `tool-icons.tsx` |
| Archivos de páginas | `page.tsx` en directorio | `app/scanner/page.tsx` |
| Variables de entorno públicas | `NEXT_PUBLIC_*` | `NEXT_PUBLIC_API_URL` |

---

## 19. FLUJO DE DATOS ENTRE CAPAS

```
USUARIO
  │
  │ 1. Escribe URL + activa herramientas
  ▼
[scan-form.tsx] ─── valida con lib/validators.ts
  │
  │ 2. startScan(target, options)
  ▼
[lib/scan-context.tsx]
  │
  │ 3. POST /api/scan  { target, options }
  ▼
[lib/api-client.ts → fetch() con X-API-Token]
  │
  │ 4. next.config.mjs rewrite → http://api:5000
  ▼
[server/app.py → POST /api/scan]
  │
  ├── Valida target con is_allowed_target()
  ├── Verifica circuit breaker con _cb_is_open()
  ├── Guarda estado inicial en Redis
  ├── Lanza thread daemon=False con run_scan()
  └── Responde { jobId: "<uuid>", status: "running" }
  │
  ├── [scan-context.tsx: polling setInterval cada 2s]
  │     └── GET /api/scan/<id>/status
  │           └── app.py → get_scan(id) → Redis
  │                └── ScanResults parciales → scan-progress.tsx
  │
  └── [Thread → run_scan()]
        │
        ▼
        [server/modules/orchestrator.py → run_full_scan()]
          │
          ├── Pre:    Auto-login → cookie de sesión por lab
          ├── Paso 1: wappalyzer.py   → technologies[]
          ├── Paso 2: nmap_scanner.py → ports[]
          ├── Paso 3: patator.py      → brute_force_results[]
          ├── Paso 4: metasploit.py   → metasploit[]
          ├── Paso 5: ffuf.py         → ffuf_endpoints[]
          ├── Paso 6: gobuster.py     → directories[]
          ├── Paso 7: zap_scanner.py  → vulnerabilities[]
          ├── Paso 8: nuclei.py       → nuclei_findings[]
          ├── Paso 9: injection_scanner.py → sqli_results[]
          ├── Paso 10: searchsploit.py → exploits[]
          └── Paso 11: scoring.py     → score{ total, grade, riskLevel, ... }
                │
                ▼
                [app.py → _persist_step_result() → Redis]
                      │
                      ▼
                [scan-context.tsx: status "completed" → detiene polling]
                      │
                      ▼
                [results-dashboard.tsx → renderiza 10 pestañas de resultados]
                      │
                      ▼
                [report-download-modal.tsx → GET /api/scan/<id>/report?format=html]
                      │
                      ▼
                [server/utils/reporter.py → genera HTML/PDF/JSON/CSV]
                      │
                      ▼
                [Archivo descargado en el navegador del usuario]
```

---

*Documento actualizado a partir del código fuente real de SecureScan Pro v5.0.*
*Métricas verificadas directamente del repositorio: backend 12.158 líneas · frontend ~15.294 líneas · total ~28.252 líneas.*
*SENA — Programa Técnico en Seguridad de Aplicaciones Web — Colombia, Julio 2026*