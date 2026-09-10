# ESTRUCTURA DEL PROYECTO
## SecureScan Pro v3.0 — Árbol de Archivos y Responsabilidades

**Autor:** Tecnico en Seguridad de Aplicaciones Web  
**Institución:** SENA — Servicio Nacional de Aprendizaje (Colombia)  
**Programa:** Técnico en Seguridad de Aplicaciones Web  
**Fecha de actualización:** Junio 2026  

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
9. [components/ui/ — Librería de Componentes Shadcn/ui](#9-componentsui--librería-de-componentes-shadcnui)
10. [lib/ — Lógica Cliente Compartida](#10-lib--lógica-cliente-compartida)
11. [hooks/ — React Hooks Personalizados](#11-hooks--react-hooks-personalizados)
12. [public/ — Assets Estáticos y Documentación Embebida](#12-public--assets-estáticos-y-documentación-embebida)
13. [.vscode/ — Configuración del Entorno de Desarrollo](#13-vscode--configuración-del-entorno-de-desarrollo)
14. [Archivos de Infraestructura y Automatización](#14-archivos-de-infraestructura-y-automatización)
15. [Archivos de Configuración de Herramientas](#15-archivos-de-configuración-de-herramientas)
16. [Tamaños de Archivos y Métricas del Proyecto](#16-tamaños-de-archivos-y-métricas-del-proyecto)
17. [Convenciones de Nombrado](#17-convenciones-de-nombrado)
18. [Flujo de Datos entre Capas](#18-flujo-de-datos-entre-capas)

---

## 1. VISTA GENERAL DEL PROYECTO

SecureScan Pro es un monorepo que contiene el frontend Next.js y el backend Flask en un único repositorio. La raíz del repositorio aloja el proyecto Next.js, mientras que el backend reside completamente dentro del subdirectorio `server/`. Toda la infraestructura de contenedores se define desde la raíz mediante `docker-compose.yml`.

```
Tipo de proyecto:      Monorepo (frontend + backend en mismo repositorio)
Package manager:       pnpm 8.15.0 (frontend) / pip (backend)
Runtime frontend:      Node.js ≥ 20.0.0
Runtime backend:       Python 3.11
Contenedorización:     Docker Compose v2 — 10 servicios
Entorno de destino:    Kali Linux / Ubuntu 24 en VirtualBox
IDE recomendado:       VS Code (configuración incluida en .vscode/)
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
├── .env.example                     # Plantilla de variables de entorno
├── .gitignore                       # Exclusiones Git (incluye .env, node_modules)
├── .dockerignore                    # Exclusiones para build Docker
├── start.sh                         # Script de arranque completo en orden
├── verify.sh                        # Script de verificación de todos los servicios
├── fix_frontend_dvwa.sh             # Script de reparación DVWA + Frontend
│
├── ── FRONTEND (Next.js 14 App Router) ────────────────────────────
│
├── package.json                     # Dependencias Node.js (pnpm)
├── pnpm-lock.yaml                   # Lockfile de dependencias pnpm
├── package-lock.json                # Lockfile npm (referencia)
├── next.config.mjs                  # Config Next.js: rewrites, headers, CSP, output
├── tailwind.config.ts               # Config Tailwind CSS v3 + colores custom
├── tsconfig.json                    # Config TypeScript (strict, paths @/*)
├── postcss.config.js                # PostCSS: tailwindcss + autoprefixer
├── components.json                  # Config Shadcn/ui (estilo, paths, iconos)
├── global.d.ts                      # Declaraciones de tipos globales (.css, .scss)
├── next-env.d.ts                    # Tipos generados por Next.js (no editar)
├── requirements.txt                 # Dependencias Python — referencia para dev local
│
├── app/                             # App Router de Next.js (páginas y layouts)
│   ├── layout.tsx                   # Layout raíz: ThemeProvider, fuentes Geist
│   ├── globals.css                  # Variables CSS globales + estilos base
│   ├── page.tsx                     # Landing page / página de inicio (466 líneas)
│   ├── scanner/
│   │   └── page.tsx                 # Página principal del escáner (475 líneas)
│   ├── history/
│   │   └── page.tsx                 # Historial de escaneos (273 líneas)
│   ├── lab/
│   │   └── page.tsx                 # Panel de control del laboratorio (479 líneas)
│   ├── docs/
│   │   └── page.tsx                 # Documentación embebida con Markdown (605 líneas)
│   └── api/
│       └── docs/
│           └── [slug]/
│               └── route.ts         # API Route: sirve docs Markdown estáticos (57 líneas)
│
├── components/                      # Componentes React de la aplicación
│   ├── header.tsx                   # Header de navegación global (137 líneas)
│   ├── scan-form.tsx                # Formulario de inicio de escaneo (440 líneas)
│   ├── scan-progress.tsx            # Progreso en tiempo real del scan (313 líneas)
│   ├── results-dashboard.tsx        # Dashboard de resultados completo (1249 líneas)
│   ├── report-download-modal.tsx    # Modal para descarga de reportes (301 líneas)
│   ├── theme-provider.tsx           # Provider de tema claro/oscuro (11 líneas)
│   └── ui/                          # Librería de componentes Shadcn/ui (55 archivos)
│       ├── accordion.tsx
│       ├── alert-dialog.tsx
│       ├── alert.tsx
│       ├── aspect-ratio.tsx
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── breadcrumb.tsx
│       ├── button-group.tsx
│       ├── button.tsx
│       ├── calendar.tsx             # DayPicker v8.10.1 — API v8 (downgrade intencional)
│       ├── card.tsx
│       ├── carousel.tsx
│       ├── chart.tsx                # Wrapper recharts (353 líneas)
│       ├── checkbox.tsx
│       ├── collapsible.tsx
│       ├── command.tsx
│       ├── context-menu.tsx
│       ├── dialog.tsx
│       ├── drawer.tsx
│       ├── dropdown-menu.tsx
│       ├── empty.tsx
│       ├── field.tsx
│       ├── form.tsx
│       ├── hover-card.tsx
│       ├── input-group.tsx
│       ├── input-otp.tsx
│       ├── input.tsx
│       ├── item.tsx
│       ├── kbd.tsx
│       ├── label.tsx
│       ├── menubar.tsx
│       ├── navigation-menu.tsx
│       ├── pagination.tsx
│       ├── popover.tsx
│       ├── progress.tsx
│       ├── radio-group.tsx
│       ├── resizable.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx              # Sidebar (726 líneas — el más extenso de ui/)
│       ├── skeleton.tsx
│       ├── slider.tsx
│       ├── sonner.tsx
│       ├── spinner.tsx
│       ├── switch.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       ├── toggle-group.tsx
│       ├── toggle.tsx
│       ├── tooltip.tsx
│       ├── use-mobile.tsx           # Hook de detección de viewport móvil
│       └── use-toast.ts             # Hook de notificaciones toast (191 líneas)
│
├── lib/                             # Lógica cliente compartida
│   ├── api-client.ts                # Cliente HTTP tipado para la API (491 líneas)
│   ├── scan-context.tsx             # React Context del estado de escaneo (350 líneas)
│   ├── validators.ts                # Validación de inputs del formulario (121 líneas)
│   └── utils.ts                     # Utilidades generales: cn() (6 líneas)
│
├── hooks/                           # React Hooks personalizados
│   └── use-mobile.ts                # Hook de breakpoint para responsive design
│
├── public/                          # Assets estáticos servidos directamente
│   ├── apple-icon.png               # Icono para dispositivos Apple
│   ├── icon.svg                     # Icono SVG principal de la aplicación
│   ├── icon-dark-100x100.png          # Favicon modo oscuro 100x100
│   ├── icon-light-100x100.png         # Favicon modo claro 100x100
│   └── docs/                        # Documentación Markdown estática embebida
│       ├── api.md                   # Referencia de endpoints de la API REST
│       ├── architecture.md          # Diagrama y descripción de arquitectura
│       ├── contributing.md          # Guía para contribuidores
│       ├── deployment.md            # Guía de despliegue
│       ├── security.md              # Consideraciones de seguridad
│       └── tools.md                 # Documentación de las herramientas integradas
│
├── .vscode/                         # Configuración VS Code
│   ├── extensions.json              # Extensiones recomendadas
│   ├── launch.json                  # Configuraciones de debugging (Flask + Next.js)
│   ├── settings.json                # Configuración del editor (formato, linting)
│   └── tasks.json                   # Tareas automatizadas (dev, build, Docker)
│
└── ── BACKEND (Python 3.11 / Flask) ───────────────────────────────
│
└── server/
    ├── app.py                       # Aplicación Flask principal (1010 líneas)
    ├── Dockerfile                   # Imagen backend v3.1.3 (python:3.11-slim-bookworm)
    ├── entrypoint.sh                # Script de inicialización pre-Gunicorn
    ├── requirements.txt             # Dependencias Python del backend
    ├── wordlist-common.txt          # Wordlist incluida para Gobuster/ffuf (fallback)
    │
    ├── modules/                     # Módulos de herramientas de seguridad
    │   ├── __init__.py              # Inicializador del paquete (1 línea)
    │   ├── wappalyzer.py            # Fingerprinting tecnológico (228 líneas)
    │   ├── nmap_scanner.py          # Escaneo de puertos y servicios (359 líneas)
    │   ├── zap_scanner.py           # DAST con OWASP ZAP (1102 líneas)
    │   ├── nuclei.py                # Escaneo por plantillas (560 líneas)
    │   ├── sqlmap.py                # Detección SQL Injection (1265 líneas)
    │   ├── ffuf.py                  # Fuzzing de endpoints (305 líneas)
    │   ├── gobuster.py              # Enumeración de directorios (769 líneas)
    │   ├── metasploit.py            # Módulos Metasploit via RPC (288 líneas)
    │   ├── searchsploit.py          # Búsqueda en ExploitDB (262 líneas)
    │   ├── patator.py               # Fuerza bruta HTTP (666 líneas)
    │   ├── injection_scanner.py     # Motor propio — 10 técnicas de inyección (1689 líneas)
    │   └── orchestrator.py          # Pipeline central de 11 pasos (1107 líneas)
    │
    └── utils/
        ├── __init__.py              # Inicializador del paquete (13 líneas)
        ├── reporter.py              # Generación de reportes HTML/PDF/JSON/CSV (1136 líneas)
        └── scoring.py               # Cálculo de puntuación CVSS-like (530 líneas)
```

**Total de líneas de código del backend Python:** 11.290 líneas  
**Total de líneas de código del frontend TypeScript/TSX:** 5.831 líneas  
**Total de líneas de código del proyecto:** ~17.121 líneas  
**Número de servicios Docker:** 10  
**Número de módulos de seguridad:** 11 (incluyendo InjectionScanner propio)

---

## 3. RAÍZ DEL PROYECTO — ARCHIVOS DE CONFIGURACIÓN GLOBAL

### docker-compose.yml

**Responsabilidad:** Orquestación completa de los 10 servicios de la plataforma.

Define las redes, volúmenes, dependencias, health checks y variables de entorno de todos los servicios. Es el único archivo necesario para arrancar toda la plataforma con `docker compose up`.

**Servicios definidos:**

| Nombre | Container | Función |
|---|---|---|
| `frontend` | `securescan-frontend` | UI Next.js en puerto 3000 |
| `api` | `securescan-api` | Backend Flask en puerto 5000 |
| `redis` | `securescan-redis` | Cache y almacenamiento de estado en puerto 6379 |
| `zap` | `securescan-zap` | OWASP ZAP DAST en puerto 8080 |
| `sqlmapapi` | `securescan-sqlmapapi` | SQLMap REST API en puerto 8775 |
| `msfrpcd` | `securescan-msfrpcd` | Metasploit RPC daemon en puerto 55553 |
| `juice-shop` | `juice-shop` | OWASP Juice Shop en puerto 3001 |
| `dvwa` | `dvwa` | DVWA (PHP) en puerto 3002 |
| `dvwa-db` | `dvwa-db` | MariaDB 10.11 para DVWA (sin puerto expuesto) |
| `webgoat` | `webgoat` | WebGoat (Java) en puerto 3003 |

**Redes definidas:**
- `securescan-net` — subnet `172.20.0.0/16` — servicios principales
- `lab-net` — subnet `172.21.0.0/16` — laboratorio aislado

**Volúmenes persistentes:**
- `redis-data` — datos Redis
- `scan-reports` — reportes generados (montado en `/app/reports`)
- `dvwa-db-data` — base de datos MariaDB de DVWA
- `msf-data` — configuración Metasploit
- `nuclei-templates` — plantillas de Nuclei
- `juice-shop-data` — datos de Juice Shop
- `webgoat-data` — datos de WebGoat

**Correcciones críticas aplicadas en el docker-compose.yml actual:**
- La dependencia `api → msfrpcd` usa `service_started` (no `service_healthy`) porque Metasploit puede tardar más de 5 minutos en arrancar y no debe bloquear la API.
- `sqlmapapi` reutiliza la imagen construida para `api` en lugar de hacer un build separado, ahorrando tiempo y espacio.
- `ALLOWED_ORIGINS` incluye `http://frontend:3000` para que el container frontend pueda comunicarse con la API.
- El health check de `dvwa-db` usa variables de entorno (`${MYSQL_USER}`, `${MYSQL_PASSWORD}`) en lugar de credenciales hardcodeadas.
- El volumen `nuclei-templates` apunta a `/home/scanner/nuclei-templates` (coincide con el path del Dockerfile).

### Dockerfile.frontend

**Responsabilidad:** Build multi-stage del frontend Next.js para producción.

Implementa tres stages:

```
Stage 1 "deps":
  - Base: node:20-alpine
  - Activa pnpm 8.15.0 con corepack
  - Instala dependencias con --frozen-lockfile

Stage 2 "builder":
  - Copia node_modules desde "deps"
  - Copia todas las fuentes (app/, components/, lib/, public/, hooks/, configs)
  - Define BACKEND_URL=http://api:5000 (para rewrites Server-Side y SSR)
  - Define NEXT_PUBLIC_API_URL=http://localhost:5000 (para llamadas del browser)
  - Ejecuta pnpm build (genera .next/standalone)

Stage 3 "runner":
  - Base: node:20-alpine
  - Crea usuario nextjs:nodejs (no-root)
  - Copia solo .next/standalone y .next/static
  - Arranca con: node server.js
  - Puerto 3000, hostname 0.0.0.0
```

**Distinción BACKEND_URL vs NEXT_PUBLIC_API_URL:** Esta dualidad es fundamental. `BACKEND_URL` es usada por los rewrites de `next.config.mjs` y los Server Components para comunicarse con la API dentro de la red Docker (`http://api:5000`). `NEXT_PUBLIC_API_URL` es usada por el código JavaScript del navegador, que solo puede acceder al puerto expuesto del host (`http://localhost:5000`).

### .env.example

**Responsabilidad:** Plantilla de referencia para todas las variables de entorno del sistema.

Contiene 40 variables organizadas en 9 secciones: Backend, Redis, ZAP, DVWA/MariaDB, Labs, Metasploit, API Token, Frontend (Next.js), CORS y Timeouts. Este archivo sí se commitea al repositorio; `.env` (con los valores reales) está en `.gitignore`.

### start.sh

**Responsabilidad:** Script bash de arranque completo de la plataforma en el orden correcto.

Pasos que ejecuta:

1. Verifica que `docker` y `docker compose` (v2) estén disponibles.
2. Crea `.env` desde `.env.example` si no existe.
3. Construye las imágenes `api`, `sqlmapapi` y `frontend` (en ese orden).
4. Arranca Redis y espera confirmación de PONG mediante polling.
5. Arranca ZAP en background (puede tardar ~60 segundos).
6. Arranca `dvwa-db`, espera 5 segundos, luego arranca DVWA, WebGoat y Juice Shop.
7. Arranca Metasploit en background (puede tardar ~2 minutos).
8. Arranca la API y `sqlmapapi`, espera 10 segundos, luego arranca el frontend.
9. Realiza polling a `/api/health` (máximo 60 segundos) hasta recibir respuesta.
10. Muestra resumen con todas las URLs y comandos útiles.

**Uso:**
```bash
chmod +x start.sh
bash start.sh
```

### verify.sh

**Responsabilidad:** Script de verificación del estado completo de la plataforma post-arranque.

Comprueba 9 categorías:
- Estado de los 9 containers Docker (healthy / Up).
- 3 endpoints del backend (`/api/health`, `/api/config`, `/api/history`).
- Frontend accesible en `:3000`.
- 3 labs accesibles en `:3001`, `:3002`, `:3003`.
- ZAP API respondiendo en `:8080`.
- 8 herramientas disponibles dentro del container API (nmap, searchsploit, nuclei, sqlmap, patator, ffuf, gobuster, wkhtmltopdf).

Muestra un conteo final de comprobaciones pasadas/fallidas.

**Uso:**
```bash
bash verify.sh
```

### fix_frontend_dvwa.sh

**Responsabilidad:** Script de diagnóstico y reparación para los dos problemas más frecuentes del laboratorio.

Problema 1 — DVWA: Detecta errores en los logs del container DVWA y reinicia `dvwa-db` seguido de `dvwa` si los encuentra.

Problema 2 — Frontend: Reconstruye y reinicia el container frontend cuando no responde en `:3000`.

**Uso:**
```bash
bash fix_frontend_dvwa.sh
```

### .gitignore

**Responsabilidad:** Control de versiones — define qué no se commitea.

Exclusiones clave:
- `.env` y todas sus variantes (`.env.*`) — se preserva solo `.env.example`.
- `node_modules/`, `.next/` — se regeneran.
- `__pycache__/`, `*.pyc`, `.venv/` — artefactos Python.
- `server/reports/` — reportes generados.
- Archivos v0 del sandbox (`__v0_runtime_loader.js`, `.snowflake/`, `.v0-trash/`).

### .dockerignore

**Responsabilidad:** Excluye archivos del contexto de build de Docker para reducir el tamaño de la imagen y el tiempo de construcción.

Exclusiones clave:
- `node_modules/`, `.next/`, `.pnpm-store/` — no van en la imagen.
- `.env`, `.env.*` — nunca incluir credenciales en imágenes Docker.
- `.git/`, `.vscode/`, `.idea/` — herramientas de desarrollo.
- `docs/`, `tests/`, `*.md` — documentación no necesaria en runtime.
- `fix_app.py`, `fix_custom_url.py`, `patch_scan_form.py` — scripts de parche de desarrollo.

---

## 4. server/ — BACKEND PYTHON/FLASK

### server/app.py — Aplicación Flask Principal

**Tamaño:** 1.010 líneas  
**Responsabilidad:** Punto de entrada de la API REST. Inicialización de Flask, Redis, CORS, rate limiting, autenticación, validación de targets y gestión del ciclo de vida de los escaneos.

**Componentes internos principales:**

| Componente | Descripción |
|---|---|
| `app = Flask(__name__)` | Instancia principal de Flask |
| `redis_client` | Conexión a Redis con autenticación |
| `limiter` | Flask-Limiter — 20 req/h en POST /api/scan |
| `orchestrator` | Instancia única de SecurityOrchestrator |
| `require_token()` | Decorador de autenticación X-API-Token |
| `get_scan_storage()` | Detección de disponibilidad Redis (cache 10s) |
| `save_scan()` / `get_scan()` | Almacenamiento dual Redis/memoria |
| `scans_fallback` | Diccionario en memoria protegido con threading.Lock |
| `_cb_is_open()` | Circuit Breaker — verifica si el circuito está abierto |
| `run_scan()` | Función ejecutada en thread separado — llama al orquestador |
| `_persist_step_result()` | Persiste un resultado parcial en Redis sin sobreescribir |

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

**Constantes relevantes:**

```python
_FALLBACK_MAX_SCANS = 200    # Límite anti-OOM del almacenamiento en memoria
_REDIS_CACHE_TTL    = 10     # Segundos entre pings a Redis (cache de estado)
FORBIDDEN_PATTERNS  = [...]  # 10 patrones regex de IPs privadas/loopback
ALLOWED_LAB_TARGETS = [...]  # Targets del laboratorio siempre permitidos
```

### server/entrypoint.sh — Script de Inicialización

**Tamaño:** ~50 líneas  
**Responsabilidad:** Ejecutado por Docker antes de arrancar Gunicorn. Verifica que todas las herramientas esperadas estén disponibles y emite warnings para las que no están (sin detener el arranque — las herramientas faltantes activan simulación).

**Comprobaciones que realiza:**
1. Disponibilidad de: `nmap`, `nuclei`, `gobuster`, `ffuf`, `sqlmap`, `searchsploit`.
2. Existencia de `/app/reports/` (lo crea si no existe).
3. Número de templates Nuclei en `/home/scanner/nuclei-templates/*.yaml`.
4. Disponibilidad de `wkhtmltopdf` para reportes PDF.

Tras las comprobaciones, ejecuta el CMD de Docker (`exec "$@"`), que es el comando Gunicorn definido en el Dockerfile.

### server/requirements.txt — Dependencias Python

**Responsabilidad:** Lista exacta de dependencias Python del backend con rangos de versión compatibles.

```
flask>=3.0.0,<4.0.0          # Framework web
flask-cors>=4.0.0,<5.0.0     # CORS middleware
flask-limiter>=3.5.0,<4.0.0  # Rate limiting
requests>=2.31.0,<3.0.0      # HTTP client (ZAP API, auto-login)
redis>=5.0.0,<6.0.0          # Cliente Redis
pdfkit>=1.0.0,<2.0.0         # Generación de PDFs (requiere wkhtmltopdf en sistema)
pymetasploit3>=1.0.3         # RPC client Metasploit (opcional)
python-Wappalyzer>=0.3.1     # Fingerprinting tecnológico
python-dotenv>=1.0.0,<2.0.0  # Carga de .env
pydantic>=2.0.0,<3.0.0       # Validación de modelos de datos
jinja2>=3.1.0,<4.0.0         # Templates HTML para reportes
docker>=7.1.0                 # Docker SDK (endpoints /api/lab/*)
beautifulsoup4>=4.12.0       # Parser HTML (Wappalyzer, auto-login)
gunicorn>=21.2.0              # Servidor WSGI de producción
```

Adicional instalado en Dockerfile (no en requirements.txt): `gevent` (workers async opcionales).

### server/wordlist-common.txt — Wordlist Integrada

**Responsabilidad:** Lista de rutas/directorios comunes usada por Gobuster y ffuf como fallback cuando SecLists no está disponible en el sistema.

Se incluye directamente en el repositorio para garantizar que la herramienta de fuzzing siempre tenga una lista de palabras disponible, independientemente del estado del sistema de archivos del container.

### server/Dockerfile — Imagen Docker del Backend

**Versión:** 3.1.3  
**Base:** `python:3.11-slim-bookworm` (Debian 12)  
**Tamaño estimado de imagen construida:** ~4 GB (principalmente por Go toolchain, SecLists y nuclei-templates)

**Secuencia de construcción:**

```
1. Paquetes APT:
   nmap, patator, curl, wget, ca-certificates, git, unzip,
   nodejs, npm, python3, python3-pip, wkhtmltopdf, xvfb, libcap2-bin

2. Go 1.22.5:
   curl https://go.dev/dl/go1.22.5.linux-amd64.tar.gz | tar -C /usr/local -xz
   PATH="/usr/local/go/bin:${GOPATH}/bin:..."

3. SQLMap:
   git clone https://github.com/sqlmapproject/sqlmap /opt/sqlmap
   ln -s /opt/sqlmap/sqlmap.py /usr/local/bin/sqlmap
   ln -s /opt/sqlmap/sqlmapapi.py /usr/local/bin/sqlmapapi.py

4. Herramientas Go (versiones exactas):
   go install github.com/OJ/gobuster/v3@v3.6.0
   go install github.com/ffuf/ffuf/v2@v2.1.0
   go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@v3.2.4
   cp binarios a /usr/local/bin/

5. Wappalyzer Python:
   pip install python-Wappalyzer requests beautifulsoup4

6. SecLists:
   git clone https://github.com/danielmiessler/SecLists /opt/SecLists
   ln -s /opt/SecLists /usr/share/wordlists/seclists
   ln -s /opt/SecLists/Discovery/Web-Content/common.txt
        /usr/share/wordlists/dirb/common.txt

7. ExploitDB + Searchsploit:
   git clone https://gitlab.com/exploit-database/exploitdb /opt/exploitdb
   ln -sf /opt/exploitdb/searchsploit /usr/local/bin/searchsploit

8. Usuario no-root:
   groupadd -r scanner && useradd -r -g scanner scanner
   setcap cap_net_raw,cap_net_admin+eip /usr/bin/nmap

9. Dependencias Python:
   pip install -r requirements.txt
   pip install gunicorn gevent

10. Copia del código fuente:
    COPY --chown=scanner:scanner . .

11. Templates Nuclei:
    git clone https://github.com/projectdiscovery/nuclei-templates
             /home/scanner/nuclei-templates
    mkdir -p /home/scanner/.config/nuclei
    echo "nuclei-templates-directory: /home/scanner/nuclei-templates"
         > /home/scanner/.config/nuclei/config.yaml
    chown -R scanner:scanner /home/scanner/{.config,nuclei-templates}
    chmod -R 755 /home/scanner/.config

12. Directorio de reportes:
    mkdir -p /app/reports && chown -R scanner:scanner /app/reports

13. Entrypoint:
    COPY entrypoint.sh /app/entrypoint.sh
    chmod +x /app/entrypoint.sh

14. Gunicorn (CMD final):
    gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 4
             --worker-class sync --worker-tmp-dir /dev/shm
             --timeout ${GUNICORN_TIMEOUT:-3600} --graceful-timeout 30
             app:app
```

**Razones de las versiones específicas:**
- **Go 1.22.5 manual:** El paquete `golang-go` de Debian Bookworm es la versión 1.19, incompatible con los módulos Go de gobuster v3.6.0, ffuf v2.1.0 y nuclei v3.2.4.
- **gobuster v3.6.0:** La versión v3.8.2 requiere la directiva `tool` de Go 1.24, no disponible en Go 1.22.5.
- **nuclei v3.2.4:** Versión estable probada. El flag `-jsonl` (una línea JSON por hallazgo) funciona correctamente en esta versión.

---

## 5. server/modules/ — MÓDULOS DE SEGURIDAD

Cada módulo es un archivo Python independiente con una clase principal que sigue el patrón: **inicialización → método `scan()` → retorno de lista de dicts estandarizados**.

Todos los módulos implementan `_simulate_scan()` como último fallback cuando la herramienta correspondiente no está disponible. Los dicts de simulación siempre incluyen `"simulated": True`.

### server/modules/orchestrator.py

**Tamaño:** 1.107 líneas  
**Clase principal:** `SecurityOrchestrator`  
**Responsabilidad:** Coordinar la ejecución secuencial de los 11 módulos de seguridad, gestionar timeouts, retries, circuit breaker interno y auto-login por laboratorio.

**Métodos públicos principales:**

| Método | Descripción |
|---|---|
| `__init__()` | Instancia todos los módulos, configura timeouts desde env |
| `run_full_scan(target, options)` | Ejecuta el pipeline completo de 11 pasos |
| `_get_session_for_target(target)` | Auto-login específico por laboratorio |
| `run_with_timeout(func, seconds)` | Timeout seguro con `threading.Event` |
| `_run_with_retry(func, tool_name)` | Reintentos con backoff exponencial |
| `_run_wappalyzer(target)` | Paso 1 — llama a WappalyzerScanner |
| `_run_nmap(target)` | Paso 2 — llama a NmapScanner |
| `_run_patator(target, cookie)` | Paso 3 — llama a PatatorScanner |
| `_run_metasploit(target, technologies)` | Paso 4 — llama a MetasploitScanner |
| `_run_ffuf(target, cookie)` | Paso 5 — llama a FfufScanner |
| `_run_gobuster(target, cookie)` | Paso 6 — llama a GobusterScanner |
| `_run_zap_full(target, cookie, urls)` | Paso 7 — spider + active scan ZAP unificado |
| `_run_nuclei(target, technologies, cookie)` | Paso 8 — llama a NucleiScanner |
| `_run_injection(target, technologies, cookie)` | Paso 9 — llama a InjectionScanner |
| `_run_searchsploit(technologies, ports)` | Paso 10 — llama a SearchsploitScanner |
| `_calculate_score(results)` | Paso 11 — llama a scoring.py |

### server/modules/injection_scanner.py

**Tamaño:** 1.689 líneas — el módulo más extenso del proyecto  
**Clase principal:** `InjectionScanner`  
**Responsabilidad:** Motor interno de detección activa de 10 técnicas de inyección web, desarrollado específicamente para SecureScan Pro.

**Técnicas implementadas:**

| # | Técnica | Subtipos cubiertos |
|---|---|---|
| 1 | SQL Injection | Error-based, UNION, Boolean-Blind, Time-Blind, Auth-Bypass, Stacked, Second-Order |
| 2 | NoSQL Injection | MongoDB `$gt`, `$ne`, regex bypass |
| 3 | XPath Injection | Auth bypass, error-based |
| 4 | XML / XXE | File read, OOB, blind |
| 5 | XSS | Reflected, Stored, DOM |
| 6 | Command Injection | `;`, `|`, backticks, `&&` |
| 7 | Path Traversal | LFI, `../../../etc/passwd`, Windows paths |
| 8 | SSRF | Acceso a hosts internos, bypass CORS |
| 9 | SSTI | Jinja2, Twig, Freemarker, Velocity |
| 10 | LDAP Injection | Filter bypass, wildcard injection |

**Compatibilidad por laboratorio:**
- Juice Shop: REST API / JSON / JWT Bearer token.
- DVWA: Formularios PHP / cookies de sesión (`security=low`).
- WebGoat: Java Spring / JSON / JWT.
- Genérico: Formularios HTML estándar.

### server/modules/sqlmap.py

**Tamaño:** 1.265 líneas  
**Clase principal:** `SQLMapEnterpriseScanner`  
**Responsabilidad:** Detección y explotación controlada de SQL Injection usando la SQLMap REST API.

**Modo de operación:** Usa `sqlmapapi.py` (servicio `sqlmapapi` en el docker-compose) en lugar de CLI directa. La instancia es usada como context manager (`with SQLMapEnterpriseScanner(...) as scanner:`).

**Corrección crítica en el código:** El campo `value` retornado por la API SQLMap es un string Python (no JSON), debe procesarse con `ast.literal_eval()`. Además, el método `wait_for_completion()` necesita un `sleep(2)` adicional tras recibir el estado `"terminated"`.

### server/modules/zap_scanner.py

**Tamaño:** 1.102 líneas  
**Clase principal:** `ZAPScanner`  
**Responsabilidad:** Integración con OWASP ZAP para spider y escaneo activo DAST.

**Función unificada `run_zap_full()`:** Combina el spider y el escaneo activo en un solo paso, eliminando el bug histórico donde ZAP era invocado dos veces con IDs de spider inválidos.

**Selección automática de política de escaneo:**

| Target detectado | Política ZAP |
|---|---|
| DVWA | `Dev Standard` |
| WebGoat | `Dev Standard` |
| Juice Shop | `Dev CICD` |
| Testfire | `Dev Full` |
| Cualquier otro | `Default Policy` |

**Inyección de URLs:** El método `inject_urls()` inyecta en ZAP las URLs descubiertas por ffuf y Gobuster antes del escaneo activo, ampliando la cobertura.

### server/modules/gobuster.py

**Tamaño:** 769 líneas  
**Clase principal:** `GobusterEnterpriseScanner`  
**Responsabilidad:** Enumeración avanzada de directorios y archivos.

**Corrección crítica:** Los parámetros `threads`, `initial_delay_ms` y `timeout` deben pasarse en `__init__()`, no en `scan()`. El método `scan()` no acepta estos parámetros.

**Cadena de fallback de wordlists:**
1. `/usr/share/wordlists/seclists/Discovery/Web-Content/common.txt` (SecLists)
2. `/app/wordlist-common.txt` (wordlist incluida en el repo)
3. `/usr/share/wordlists/dirb/common.txt` (enlace simbólico)

**Enum de tecnologías para wordlist especializada:**
```python
class TechFingerprint(Enum):
    WORDPRESS = "wordpress"
    APACHE    = "apache"
    NODEJS    = "nodejs"
    PHP       = "php"
    JAVA      = "java"
    GENERIC   = "generic"
```

### server/modules/nuclei.py

**Tamaño:** 560 líneas  
**Clase principal:** `NucleiScanner`  
**Responsabilidad:** Escaneo basado en plantillas de vulnerabilidades conocidas (nuclei v3.2.4).

**Flag de salida:** `-jsonl` (una línea JSON por hallazgo). En versiones anteriores se usaba incorrectamente `-json`.

**Filtro de protocolos:** `-ept dns,ssl,tcp,whois,javascript` — reduce ~12.841 templates a ~5.000 activos, consiguiendo una reducción del 60% en tiempo.

**Tags por laboratorio:**

| Lab | Tags nuclei |
|---|---|
| Juice Shop | `cve,sqli,xss,jwt,cors,ssrf,owasp,exposure,swagger,token,oauth,misconfig,header,redirect,api,nodejs` |
| DVWA | `cve,sqli,xss,lfi,rce,rfi,default-login,misconfig,header,php,exposure` |
| WebGoat | `cve,sqli,xss,jwt,xxe,ssrf,cors,misconfig,header,java,spring,exposure` |
| Genérico | `cve,exposure,misconfig,default-login,header,cors,ssrf,token,redirect` |

### server/modules/patator.py

**Tamaño:** 666 líneas  
**Clase principal:** `PatatorScanner`  
**Responsabilidad:** Ataques de fuerza bruta y diccionario contra formularios de login HTTP.

**Estrategia en cascada:**
1. `requests` con manejo automático de CSRF token — compatible con los 3 labs.
2. Binario `patator` como fallback.
3. `_simulate_scan()` si ninguno está disponible.

**Wordlists integradas:**
```python
_DEFAULT_USERS = ['admin', 'guest', 'marlon', 'securescan',
                  'admin@juice-sh.op', 'jsmith', 'administrator',
                  'user', 'test', 'root', 'demo', 'operator', 'manager', 'support']

_DEFAULT_PASSES = ['password', 'admin123', 'Password', 'demo1234',
                   'admin', '123456', 'root', 'pass', 'guest', 'test']
```

**Deduplicación:** `seen_creds` set para evitar reportar la misma combinación múltiples veces.

### server/modules/nmap_scanner.py

**Tamaño:** 359 líneas  
**Clase principal:** `NmapScanner`  
**Responsabilidad:** Escaneo de puertos y detección de servicios/versiones/OS.

**Comando base:**
```bash
nmap -sV -sC -O --script=banner,version -T4 -p <ports> --open -oX - <hostname>
```

**Configuración dinámica de puertos:** Si el puerto está fuera del rango 1-1000 (e.g., 3001 para Juice Shop), se añade al rango: `1-1000,3001`.

**Corrección de validación:** Usa regex `\d+-\d+` para detectar rangos de IPs sin rechazar hostnames que contienen guiones (como `juice-shop`).

### server/modules/wappalyzer.py

**Tamaño:** 228 líneas  
**Clase principal:** `WappalyzerScanner`  
**Responsabilidad:** Identificación de tecnologías web (fingerprinting) usando python-Wappalyzer.

**Estrategia de detección en cascada:**
1. `python-Wappalyzer` (librería Python, sin proceso externo).
2. `wappalyzer-cli` (Node.js CLI, opcional).
3. `_simulate_scan()` (datos predefinidos por laboratorio).

### server/modules/metasploit.py

**Tamaño:** 288 líneas  
**Clase principal:** `MetasploitScanner`  
**Responsabilidad:** Selección inteligente y ejecución de módulos Metasploit via Console RPC.

**Librería:** `pymetasploit3`. Si no está disponible, activa simulación automáticamente.

**Módulos base siempre ejecutados:** `auxiliary/scanner/http/http_version`, `auxiliary/scanner/http/options`, `auxiliary/scanner/http/dir_listing`, `auxiliary/scanner/http/robots_txt`.

**Módulos adicionales por tecnología detectada:** Apache Tomcat, WordPress, Drupal, Joomla, Jenkins, entre otros.

### server/modules/searchsploit.py

**Tamaño:** 262 líneas  
**Clase principal:** `SearchsploitScanner`  
**Responsabilidad:** Búsqueda de exploits en la base de datos ExploitDB local.

**Comando:** `searchsploit --json <término>` — salida estructurada.

**Instalación:** ExploitDB clonado en `/opt/exploitdb`, enlace simbólico en `/usr/local/bin/searchsploit`.

**Términos excluidos** (`_SKIP_EXPLOIT_TERMS`): Términos genéricos de bajo valor como `country`, `html5`, `bootstrap`, `jquery` y similares que producirían ruido. Nota: `php`, `apache`, `nginx` y `sql` fueron eliminados de esta lista (eran exclusiones incorrectas que impedían encontrar exploits relevantes).

### server/modules/ffuf.py

**Tamaño:** 305 líneas  
**Clase principal:** `FfufScanner`  
**Responsabilidad:** Fuzzing de endpoints y descubrimiento de rutas/archivos (ffuf v2.1.0).

**Comando base:**
```bash
ffuf -u <target>/FUZZ -w <wordlist> -o <output.json> -of json
     -H "Cookie: <cookie>" -mc 200,204,301,302,307,401,403
     -ac -t 10 -timeout 10
```

**Nota:** La flag `-se` fue eliminada porque abortaba al primer error de red antes de encontrar resultados.

**Ruta de fuzzing para WebGoat:** `/WebGoat/FUZZ` en lugar de `/FUZZ`.

---

## 6. server/utils/ — UTILIDADES DEL BACKEND

### server/utils/scoring.py

**Tamaño:** 530 líneas  
**Función principal:** `calculate_security_score(results)`  
**Responsabilidad:** Calcular la puntuación de seguridad global del objetivo analizado.

**Dataclass de pesos:**
```python
@dataclass
class SecurityWeights:
    critical: float = 20.0   # Vulnerabilidad crítica
    high:     float = 10.0   # Vulnerabilidad alta
    medium:   float = 5.0    # Vulnerabilidad media
    low:      float = 2.0    # Vulnerabilidad baja
    info:     float = 0.5    # Solo informativa
    exploit_with_vuln:    float = 8.0   # Exploit + vuln correlacionada
    exploit_without_vuln: float = 3.0   # Exploit sin vuln directa
```

**Escala de calificación (A+ a F):** 13 niveles desde 95-100 (A+, LOW) hasta 0-39 (F, CRITICAL).

### server/utils/reporter.py

**Tamaño:** 1.136 líneas  
**Clase principal:** `ReportGenerator`  
**Responsabilidad:** Generar reportes exportables en 4 formatos: HTML, PDF, JSON, CSV.

**Funciones principales:**

| Función | Formato | Librería |
|---|---|---|
| `generate_html_report(scan_data)` | `.html` | `html.escape()` (stdlib) |
| `generate_pdf_report(scan_data)` | `.pdf` | `pdfkit` + `wkhtmltopdf` |
| `generate_json_report(scan_data)` | `.json` | `json` (stdlib) |
| `generate_csv_report(scan_data)` | `.csv` | `csv` (stdlib) |

**Almacenamiento:** `/app/reports/report-<scan_id>.<format>` (mapeado al volumen Docker `scan-reports`).

**Sanitización XSS:** Todo el contenido insertado en el HTML es sanitizado con `html.escape(text, quote=True)`.

---

## 7. app/ — NEXT.JS APP ROUTER (FRONTEND)

### app/layout.tsx

**Tamaño:** 57 líneas  
**Responsabilidad:** Layout raíz de la aplicación. Define:
- Fuente tipográfica Geist (importada desde el paquete `geist`).
- `ThemeProvider` (tema claro/oscuro con `next-themes`).
- Metadatos globales (`title`, `description`, favicon).
- Clase CSS de fondo y color de texto base.

### app/globals.css

**Responsabilidad:** Variables CSS globales del sistema de diseño (custom properties HSL de Shadcn/ui), clases de animación base y estilos de reset.

Define las variables CSS para todos los tokens de color en modo claro y oscuro: `--background`, `--foreground`, `--primary`, `--secondary`, `--destructive`, `--muted`, `--accent`, `--border`, `--input`, `--ring`, y sus variantes `*-foreground`.

### app/page.tsx

**Tamaño:** 466 líneas  
**Responsabilidad:** Landing page. Contiene:
- Hero section con descripción del sistema y botón de inicio.
- Grid de features/herramientas con iconos.
- Sección de estadísticas (número de herramientas, targets, etc.).
- Sección de "Quick Start" con pasos de uso.
- Footer con links a documentación.

### app/scanner/page.tsx

**Tamaño:** 475 líneas  
**Responsabilidad:** Página principal del escáner — la más usada del sistema.

**Contenido:**
- `ScanProvider` wrapping para el Context de estado.
- Panel de estadísticas por herramienta con `TOOL_META` (nombre, icono, descripción de cada módulo).
- Grid de "Quick Labs" con botones para seleccionar DVWA, Juice Shop, WebGoat con un clic.
- Componente `ScanForm` para configurar e iniciar escaneos.
- Componente `ScanProgress` para visualizar el avance en tiempo real.
- Componente `ResultsDashboard` para visualizar resultados una vez completado.

### app/lab/page.tsx

**Tamaño:** 479 líneas  
**Responsabilidad:** Panel de control del laboratorio.

**Funcionalidades:**
- Estado de cada container (running/stopped/starting/error) con polling cada 5 segundos.
- Botones de Start/Stop para cada lab (Juice Shop, DVWA, WebGoat).
- URLs directas a cada laboratorio con botones de apertura.
- Credenciales de acceso por lab (visibles en la UI para facilitar el uso educativo).
- Logs de operaciones recientes.

### app/history/page.tsx

**Tamaño:** 273 líneas  
**Responsabilidad:** Historial de escaneos.

**Funcionalidades:**
- Lista de los últimos 100 escaneos ordenados por fecha descendente.
- Columnas: target, estado, puntuación (grade), fecha, duración.
- Botón de eliminación por escaneo.
- Botón de descarga de reporte por escaneo.
- Filtros por estado (completed, running, error).

### app/docs/page.tsx

**Tamaño:** 605 líneas  
**Responsabilidad:** Documentación embebida en la aplicación.

**Funcionalidades:**
- Sidebar con índice de documentos (api, architecture, deployment, security, tools, contributing).
- Renderizado de Markdown a HTML con estilos aplicados.
- Sintaxis de código con resaltado.
- Navegación entre documentos sin recarga de página.

### app/api/docs/[slug]/route.ts

**Tamaño:** 57 líneas  
**Responsabilidad:** API Route de Next.js que sirve los archivos Markdown de `/public/docs/` como respuesta HTTP.

**Funcionamiento:**
1. Recibe `slug` como parámetro de ruta (e.g., `api`, `architecture`).
2. Lee el archivo `/public/docs/<slug>.md` desde el filesystem.
3. Responde con `Content-Type: text/plain; charset=utf-8`.
4. Retorna 404 si el archivo no existe.

---

## 8. components/ — COMPONENTES REACT

### components/scan-form.tsx

**Tamaño:** 440 líneas  
**Responsabilidad:** Formulario principal de configuración e inicio de escaneos.

**Secciones del formulario:**
- Input de URL del target con validación en tiempo real (usa `lib/validators.ts`).
- Botones de "Quick Lab" para seleccionar DVWA, Juice Shop y WebGoat directamente.
- Checkboxes para activar/desactivar cada herramienta del pipeline.
- Sección colapsable "Opciones avanzadas": dry-run, circuit breaker, validación de target.
- Botón de inicio que llama a `startScan()` del Context.

**Herramientas configurables en el formulario:**
```
□ Wappalyzer    □ Nmap         □ Gobuster
□ ZAP           □ Searchsploit □ Metasploit
□ Nuclei        □ SQLMap       □ Patator
□ ffuf
```

### components/scan-progress.tsx

**Tamaño:** 313 líneas  
**Responsabilidad:** Visualización del progreso del escaneo en tiempo real.

**Elementos visuales:**
- Lista vertical de pasos del pipeline con icono de estado para cada uno:
  - `pending` — círculo gris
  - `running` — spinner animado
  - `completed` — check verde
  - `error` — X roja
- Barra de progreso global (porcentaje calculado de pasos completados).
- Timer con formato `HH:MM:SS` contando desde el inicio del scan.
- Mensaje de estado textual (e.g., "Ejecutando Nuclei...").
- Polling automático cada 2 segundos al endpoint `/api/scan/<id>/status`.

### components/results-dashboard.tsx

**Tamaño:** 1.249 líneas — el componente más extenso del frontend  
**Responsabilidad:** Dashboard completo de visualización de resultados.

**Tabs principales:**

| Tab | Contenido |
|---|---|
| Resumen | Score, grade, risk level, métricas globales, gráfico de distribución |
| Vulnerabilidades | Tabla filtreable por severidad con descripción, solución y CVSS |
| Tecnologías | Lista de tecnologías detectadas por Wappalyzer con versiones |
| Puertos | Tabla de puertos abiertos detectados por Nmap |
| Directorios | URLs/paths descubiertos por Gobuster y ffuf |
| SQLi | Resultados del InjectionScanner y SQLMap |
| Nuclei | Hallazgos de Nuclei por plantilla y severidad |
| Brute Force | Credenciales encontradas por Patator |
| Exploits | Exploits correlacionados por Searchsploit |
| Metasploit | Resultados de módulos Metasploit |

**Acciones disponibles:** Descarga de reporte (abre `ReportDownloadModal`).

### components/report-download-modal.tsx

**Tamaño:** 301 líneas  
**Responsabilidad:** Modal para selección y descarga de reportes.

**Formatos disponibles:** HTML, PDF, JSON, CSV.

**Mecanismo de descarga:**
```typescript
const response = await fetch(`/api/scan/${scanId}/report?format=${format}`)
const blob = await response.blob()
const url  = URL.createObjectURL(blob)
const a    = document.createElement('a')
a.href     = url
a.download = `security-report-${scanId}.${format}`
a.click()
URL.revokeObjectURL(url)
```

### components/header.tsx

**Tamaño:** 137 líneas  
**Responsabilidad:** Header de navegación global de la aplicación.

**Contenido:**
- Logo e ícono SVG de SecureScan Pro.
- Links de navegación: Scanner, Historial, Laboratorio, Documentación.
- Toggle de tema claro/oscuro (usando `next-themes`).
- Indicador de estado de la API (badge verde/rojo basado en `/api/health`).

### components/theme-provider.tsx

**Tamaño:** 11 líneas  
**Responsabilidad:** Wrapper mínimo de `ThemeProvider` de `next-themes`.

Expone la propiedad `attribute="class"` para que Tailwind CSS aplique el tema usando la clase `dark` en el elemento `<html>`.

---

## 9. components/ui/ — LIBRERÍA DE COMPONENTES SHADCN/UI

El directorio `components/ui/` contiene **55 archivos** (53 `.tsx` + 2 `.ts`) generados y personalizados desde Shadcn/ui. Todos los componentes están construidos sobre primitivos de Radix UI y estilizados con Tailwind CSS + class-variance-authority (CVA).

**Componentes más relevantes para el proyecto:**

| Archivo | Tamaño | Descripción |
|---|---|---|
| `sidebar.tsx` | 726 líneas | Sidebar colapsable con submenús y navegación anidada |
| `chart.tsx` | 353 líneas | Wrapper recharts con estilos temáticos integrados |
| `menubar.tsx` | 276 líneas | Barra de menú accesible (Radix UI MenuBar) |
| `dropdown-menu.tsx` | 257 líneas | Menú desplegable (Radix UI DropdownMenu) |
| `context-menu.tsx` | 252 líneas | Menú de contexto (Radix UI ContextMenu) |
| `field.tsx` | 244 líneas | Campo de formulario compuesto con label y error |
| `carousel.tsx` | 241 líneas | Carrusel (embla-carousel-react) |
| `select.tsx` | 185 líneas | Select nativo accesible (Radix UI Select) |
| `command.tsx` | 184 líneas | Paleta de comandos (cmdk) |
| `use-toast.ts` | 191 líneas | Hook de gestión de toasts |
| `calendar.tsx` | — | DayPicker v8 — downgrade intencional de v9 |
| `form.tsx` | 167 líneas | Integración React Hook Form + Radix |
| `dialog.tsx` | 143 líneas | Modal dialog (Radix UI Dialog) |

**Nota sobre `calendar.tsx`:** Fue reescrito para usar la API de `react-day-picker` v8.10.1. La versión v9 tiene una API completamente diferente e incompatible. La dependencia está fijada en `"react-day-picker": "^8.10.1"` en `package.json` para evitar actualizaciones accidentales.

---

## 10. lib/ — LÓGICA CLIENTE COMPARTIDA

### lib/api-client.ts

**Tamaño:** 491 líneas  
**Responsabilidad:** Cliente HTTP tipado que centraliza toda la comunicación con el backend Flask.

**Configuración:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
const API_TOKEN   = process.env.NEXT_PUBLIC_API_TOKEN || ''
```

**Interfaces TypeScript principales:**

```typescript
interface ScanStartRequest {
  target: string
  options?: {
    tools?: { wappalyzer?: boolean; nmap?: boolean; zap?: boolean; ... }
    dry_run?: boolean
    circuit_breaker?: { enabled?: boolean; failure_threshold?: number; recovery_timeout?: number }
    target_validation?: { check_dns?: boolean; check_reachability?: boolean; timeout?: number }
    retry_config?: { max_retries?: number; backoff_factor?: number; retry_on?: string[] }
  }
}

interface ScanStep {
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  startTime?: string
  endTime?: string
  error?: string
}

type Grade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' |
             'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'F'
type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

interface SecurityScore {
  total: number
  grade: Grade
  breakdown: { critical: number; high: number; medium: number; low: number; info: number }
  riskLevel: RiskLevel
  recommendations: string[]
  metrics: { total_vulns: number; max_cvss: number; exploitable: number }
}

interface ScanResults {
  id: string
  target: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startTime: string
  endTime?: string
  steps: ScanStep[]
  technologies: Technology[]
  ports: Port[]
  vulnerabilities: Vulnerability[]
  directories: Directory[]
  exploits: Exploit[]
  nuclei_findings: NucleiFinding[]
  sqli_results: SQLiResult[]
  brute_force_results: BruteForceResult[]
  ffuf_endpoints: FfufEndpoint[]
  metasploit: MetasploitResult[]
  score?: SecurityScore
}
```

**Funciones exportadas:**

| Función | Método HTTP | Endpoint |
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

### lib/scan-context.tsx

**Tamaño:** 350 líneas  
**Responsabilidad:** React Context que mantiene el estado global del escaneo activo y expone las acciones para iniciar, cancelar y limpiar escaneos.

**Context value expuesto:**
```typescript
interface ScanContextValue {
  currentScan: ScanResults | null    // Resultado actual (parcial o final)
  isScanning: boolean                // true mientras el scan corre
  error: string | null               // Mensaje de error si falló
  startScan: (target: string, options: ScanOptions) => Promise<void>
  cancelScan: () => void             // Detiene el polling (no cancela el scan en servidor)
  clearResults: () => void           // Limpia el estado para un nuevo scan
}
```

**Ciclo de vida del polling:** Se inicia con `setInterval(pollScan, 2000)` tras el POST a `/api/scan`. El polling se detiene automáticamente cuando el status es `completed` o `error`.

**Hook de consumo:**
```typescript
export const useScan = () => useContext(ScanContext)
```

### lib/validators.ts

**Tamaño:** 121 líneas  
**Responsabilidad:** Funciones de validación de inputs del formulario de escaneo.

**Validaciones implementadas:**

| Función | Qué valida |
|---|---|
| `validateTarget(url)` | URL válida, esquema http/https, sin localhost |
| `validateLabTarget(url)` | URL de laboratorio reconocida |
| `isValidURL(str)` | Validación básica de URL bien formada |
| `sanitizeTarget(url)` | Limpieza de espacios y caracteres peligrosos |

### lib/utils.ts

**Tamaño:** 6 líneas  
**Responsabilidad:** Re-exporta la función `cn()` de `tailwind-merge` + `clsx` para composición condicional de clases CSS.

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

---

## 11. hooks/ — REACT HOOKS PERSONALIZADOS

### hooks/use-mobile.ts

**Responsabilidad:** Hook para detectar si el viewport actual es móvil (≤768px).

```typescript
export function useIsMobile(): boolean
```

Usa `window.matchMedia('(max-width: 768px)')` con un listener para cambios de tamaño de ventana. Tiene el mismo contenido que `components/ui/use-mobile.tsx` — ambos existen por compatibilidad con imports de distintas partes del código.

---

## 12. public/ — ASSETS ESTÁTICOS Y DOCUMENTACIÓN EMBEBIDA

### public/docs/

Directorio con 6 archivos Markdown que son servidos por la API Route `app/api/docs/[slug]/route.ts` y renderizados en `app/docs/page.tsx`.

| Archivo | Contenido |
|---|---|
| `api.md` | Referencia completa de la API REST |
| `architecture.md` | Diagrama de arquitectura del sistema |
| `deployment.md` | Guía de despliegue con Docker Compose |
| `security.md` | Consideraciones de seguridad y uso ético |
| `tools.md` | Documentación de cada herramienta integrada |
| `contributing.md` | Guía para contribuidores al proyecto |

### public/icon.svg — Icono Principal

SVG vectorial del logo de SecureScan Pro. Usado como favicon y en el header de la aplicación.

---

## 13. .vscode/ — CONFIGURACIÓN DEL ENTORNO DE DESARROLLO

### .vscode/tasks.json — Tareas Automatizadas

Define 10 tareas ejecutables desde VS Code (Ctrl+Shift+B o Terminal → Run Task):

| Tarea | Comando |
|---|---|
| Frontend: Iniciar Desarrollo | `pnpm dev` |
| Backend: Iniciar Servidor | `python app.py` (en `server/`) |
| Docker: Iniciar Laboratorio | `docker-compose up -d` |
| Docker: Detener Laboratorio | `docker-compose down` |
| Docker: Ver Logs | `docker-compose logs -f` |
| Backend: Instalar Dependencias | `python3 -m venv venv && pip install -r requirements.txt` |
| Frontend: Instalar Dependencias | `pnpm install` |
| Full Stack: Iniciar Todo | Secuencia: Docker → Backend → Frontend |
| Frontend: Build Producción | `pnpm build` |
| Frontend: Lint | `pnpm lint` |

### .vscode/launch.json — Configuraciones de Debugging

Define 3 configuraciones de debug y 1 compound:

| Configuración | Descripción |
|---|---|
| `Backend: Flask` | Debugpy — lanza `server/app.py` con `FLASK_DEBUG=1` |
| `Frontend: Next.js` | Node.js — lanza `pnpm dev` con apertura automática de browser |
| `Frontend: Chrome Debug` | Chrome — conecta al browser en `http://localhost:3000` |
| `Full Stack Debug` | Compound — lanza Flask + Next.js simultáneamente |

### .vscode/extensions.json — Extensiones Recomendadas

Define las extensiones VS Code recomendadas para el proyecto (mostradas automáticamente al abrir el workspace).

### .vscode/settings.json — Configuración del Editor

Configuración local del editor: tab size, formato al guardar, linting automático, y configuraciones específicas para Python y TypeScript.

---

## 14. ARCHIVOS DE INFRAESTRUCTURA Y AUTOMATIZACIÓN

### Resumen de scripts bash

| Script | Propósito | Cuándo usar |
|---|---|---|
| `start.sh` | Arranque completo en orden correcto | Primera vez o reinicio completo |
| `verify.sh` | Verificación de estado de todos los servicios | Diagnóstico post-arranque |
| `fix_frontend_dvwa.sh` | Reparación de DVWA y Frontend | Cuando alguno de los dos no responde |

### Jerarquía de Dockerfiles

| Dockerfile | Contexto de build | Usa cache de |
|---|---|---|
| `Dockerfile.frontend` | Raíz del proyecto (`.`) | pnpm install (stage deps) |
| `server/Dockerfile` | Subdirectorio `server/` | pip install (capa Python) |

El `docker-compose.yml` usa `server/Dockerfile` tanto para el servicio `api` como para `sqlmapapi` (con un CMD diferente para sqlmapapi).

---

## 15. ARCHIVOS DE CONFIGURACIÓN DE HERRAMIENTAS

### next.config.mjs

**Características clave configuradas:**
- `reactStrictMode: true` — detecta problemas en desarrollo.
- `poweredByHeader: false` — elimina el header `X-Powered-By: Next.js` por seguridad.
- `output: 'standalone'` — genera un bundle standalone para Docker.
- `images.unoptimized: true` — compatible con Docker/static export.
- `rewrites()` — proxy de `/api/*` al backend Flask en `${BACKEND_URL}`.
- `headers()` — cabeceras de seguridad globales: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy` completo.
- `compiler.removeConsole` — elimina `console.log` (mantiene `error`/`warn`/`info`) en producción.
- `experimental.optimizePackageImports: ['lucide-react', '@radix-ui/react-icons']`.

### tsconfig.json

**Opciones clave:**
- `"strict": true` — tipado estricto completo.
- `"target": "ES6"` — compilación a ES6.
- `"moduleResolution": "bundler"` — resolución moderna de módulos.
- `"paths": { "@/*": ["./*"] }` — alias `@/` para imports relativos a la raíz.
- `"jsx": "preserve"` — Next.js maneja la transformación JSX.

### tailwind.config.ts

**Características configuradas:**
- `darkMode: ["class"]` — tema oscuro via clase `.dark` en `<html>`.
- `content` — rutas de escaneo para purging: `pages/`, `components/`, `app/`, `src/`.
- `theme.extend.colors` — sistema de colores completo usando variables CSS HSL (border, input, ring, background, foreground, primary, secondary, destructive, muted, accent, success, warning).
- `theme.extend.keyframes` — animaciones: `accordion-down`, `accordion-up`, `spin`.
- `plugins: [tailwindcss-animate]`.

### components.json

**Configuración de Shadcn/ui:**
```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "tailwind.config.ts", "css": "app/globals.css" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils" }
}
```

---

## 16. TAMAÑOS DE ARCHIVOS Y MÉTRICAS DEL PROYECTO

### Backend Python — Líneas de código por archivo

| Archivo | Líneas | Rol |
|---|---|---|
| `injection_scanner.py` | 1.689 | Motor de inyección (módulo más extenso) |
| `orchestrator.py` | 1.107 | Pipeline central |
| `sqlmap.py` | 1.265 | Integración SQLMap Enterprise |
| `reporter.py` | 1.136 | Generación de reportes |
| `app.py` | 1.010 | API Flask principal |
| `zap_scanner.py` | 1.102 | Integración OWASP ZAP |
| `scoring.py` | 530 | Sistema de puntuación |
| `nuclei.py` | 560 | Integración Nuclei |
| `gobuster.py` | 769 | Integración Gobuster |
| `patator.py` | 666 | Integración Patator |
| `nmap_scanner.py` | 359 | Integración Nmap |
| `ffuf.py` | 305 | Integración ffuf |
| `metasploit.py` | 288 | Integración Metasploit |
| `searchsploit.py` | 262 | Integración Searchsploit |
| `wappalyzer.py` | 228 | Integración Wappalyzer |
| **TOTAL** | **11.290** | |

### Frontend TypeScript — Líneas de código por archivo

| Archivo | Líneas | Rol |
|---|---|---|
| `results-dashboard.tsx` | 1.249 | Dashboard de resultados (componente más extenso) |
| `app/docs/page.tsx` | 605 | Documentación embebida |
| `lib/api-client.ts` | 491 | Cliente HTTP tipado |
| `app/scanner/page.tsx` | 475 | Página principal del escáner |
| `app/lab/page.tsx` | 479 | Panel de laboratorio |
| `lib/scan-context.tsx` | 350 | Context global de escaneo |
| `components/scan-form.tsx` | 440 | Formulario de escaneo |
| `components/scan-progress.tsx` | 313 | Progreso en tiempo real |
| `components/report-download-modal.tsx` | 301 | Modal de descarga |
| `app/history/page.tsx` | 273 | Historial de escaneos |
| `components/header.tsx` | 137 | Header de navegación |
| `lib/validators.ts` | 121 | Validación de inputs |
| `app/layout.tsx` | 57 | Layout raíz |
| `app/api/docs/[slug]/route.ts` | 57 | API Route de docs |
| `app/page.tsx` | 466 | Landing page |
| `lib/utils.ts` | 6 | Utilidad cn() |
| `components/ui/` (55 archivos) | 6.281 | Librería de componentes Shadcn/ui |
| **TOTAL** | **~12.112** | |

### Resumen de tamaños

| Categoría | Archivos | Líneas |
|---|---|---|
| Backend Python | 15 módulos + app.py + entrypoint | 11.290 |
| Frontend TS/TSX (sin ui/) | 16 archivos | ~5.831 |
| Frontend TS/TSX (ui/) | 55 archivos | 6.281 |
| Configuración y scripts | 12 archivos | ~500 |
| **TOTAL DEL PROYECTO** | **~100 archivos** | **~23.902** |

---

## 17. CONVENCIONES DE NOMBRADO

### Backend Python

| Elemento | Convención | Ejemplo |
|---|---|---|
| Clases | PascalCase | `SecurityOrchestrator`, `NucleiScanner` |
| Funciones/métodos | snake_case | `run_full_scan()`, `_get_session_for_target()` |
| Métodos privados | `_snake_case` | `_simulate_scan()`, `_cb_is_open()` |
| Constantes de módulo | `_SCREAMING_SNAKE_CASE` | `_SKIP_EXPLOIT_TERMS`, `_DEFAULT_USERS` |
| Constantes globales | `SCREAMING_SNAKE_CASE` | `FORBIDDEN_PATTERNS`, `ALLOWED_LAB_TARGETS` |
| Variables de entorno | `SCREAMING_SNAKE_CASE` | `SCAN_TIMEOUT_ZAP`, `RESTRICT_TO_LAB_TARGETS` |
| Archivos de módulos | `snake_case.py` | `nmap_scanner.py`, `injection_scanner.py` |

### Frontend TypeScript

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes React | PascalCase | `ScanForm`, `ResultsDashboard` |
| Hooks | `use` + camelCase | `useScan`, `useIsMobile` |
| Interfaces | PascalCase | `ScanResults`, `SecurityScore` |
| Types simples | PascalCase | `Grade`, `RiskLevel` |
| Funciones de utilidad | camelCase | `startScan()`, `validateTarget()` |
| Archivos de componentes | `kebab-case.tsx` | `scan-form.tsx`, `results-dashboard.tsx` |
| Archivos de páginas | `page.tsx` dentro de directorio | `app/scanner/page.tsx` |
| Variables de entorno | `NEXT_PUBLIC_*` (públicas) | `NEXT_PUBLIC_API_URL` |

---

## 18. FLUJO DE DATOS ENTRE CAPAS

```
USUARIO
  │
  │ 1. Escribe URL target + activa herramientas
  ▼
[scan-form.tsx]
  │ 2. Llama a startScan(target, options)
  ▼
[lib/scan-context.tsx]
  │ 3. POST /api/scan — { target, options }
  ▼
[lib/api-client.ts → fetch()]
  │ 4. Petición HTTP con X-API-Token
  ▼
[next.config.mjs rewrite → http://api:5000]
  │ 5. Flask recibe la petición
  ▼
[server/app.py → POST /api/scan]
  │ 6. Valida target, UUID, circuit breaker
  │ 7. Guarda estado inicial en Redis
  │ 8. Lanza thread de escaneo (daemon=False)
  │ 9. Responde { jobId: "uuid", status: "running" }
  │
  ├── [scan-context.tsx inicia polling cada 2s]
  │     │
  │     └── GET /api/scan/<id>/status
  │           └── [app.py → get_scan(id) → Redis]
  │                └── ScanResults parciales → scan-progress.tsx
  │
  └── [Thread de escaneo — run_scan()]
        │
        ▼
        [server/modules/orchestrator.py → run_full_scan()]
          │
          ├── Paso 1: wappalyzer.py → technologies[]
          ├── Paso 2: nmap_scanner.py → ports[]
          ├── Paso 3: patator.py → brute_force_results[]
          ├── Paso 4: metasploit.py → metasploit[]
          ├── Paso 5: ffuf.py → ffuf_endpoints[]
          ├── Paso 6: gobuster.py → directories[]
          ├── Paso 7: zap_scanner.py → vulnerabilities[]
          ├── Paso 8: nuclei.py → nuclei_findings[]
          ├── Paso 9: injection_scanner.py → sqli_results[]
          ├── Paso 10: searchsploit.py → exploits[]
          └── Paso 11: scoring.py → score{}
                │
                ▼
                [app.py → _persist_step_result() → Redis]
                      │
                      ▼
                [scan-context.tsx → polling recibe status "completed"]
                      │
                      ▼
                [results-dashboard.tsx renderiza resultados completos]
                      │
                      ▼
                [report-download-modal.tsx → GET /api/scan/<id>/report]
                      │
                      ▼
                [server/utils/reporter.py → genera HTML/PDF/JSON/CSV]
                      │
                      ▼
                [Archivo descargado en el browser del usuario]
```

---

*Documento generado a partir de la inspección directa del código fuente de SecureScan Pro v3.0.*  
*Árbol de archivos verificado contra el contenido real de SecureScan-main/.*  
*SENA — Programa Técnico en Seguridad de Aplicaciones Web — Colombia, 2026*
