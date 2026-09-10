# DOCUMENTACIÓN TÉCNICA COMPLETA
## SecureScan Pro v5.0 — Plataforma Automatizada de Análisis de Seguridad Web

**Autor:** Técnico en Seguridad de Aplicaciones Web
**Institución:** SENA — Servicio Nacional de Aprendizaje (Colombia)
**Programa:** Técnico en Seguridad de Aplicaciones Web
**Versión del sistema:** 5.0.0
**Fecha de actualización:** Julio 2026

---

## TABLA DE CONTENIDOS

1. [¿Qué es SecureScan Pro?](#1-qué-es-securescan-pro)
2. [Cómo funciona — Arquitectura del Sistema](#2-cómo-funciona--arquitectura-del-sistema)
3. [Estructura de Carpetas y Archivos](#3-estructura-de-carpetas-y-archivos)
4. [Backend — El Motor de Seguridad](#4-backend--el-motor-de-seguridad)
5. [El Orquestador — Director del Pipeline](#5-el-orquestador--director-del-pipeline)
6. [Las 11 Herramientas de Seguridad](#6-las-11-herramientas-de-seguridad)
7. [Utilidades del Backend](#7-utilidades-del-backend)
8. [Frontend — La Interfaz de Usuario](#8-frontend--la-interfaz-de-usuario)
9. [Infraestructura Docker](#9-infraestructura-docker)
10. [Pipeline de Escaneo — Los 11 Pasos](#10-pipeline-de-escaneo--los-11-pasos)
11. [API REST — Cómo Habla el Sistema](#11-api-rest--cómo-habla-el-sistema)
12. [Variables de Configuración](#12-variables-de-configuración)
13. [Laboratorio de Seguridad](#13-laboratorio-de-seguridad)
14. [Sistema de Puntuación de Seguridad](#14-sistema-de-puntuación-de-seguridad)
15. [Generación de Reportes](#15-generación-de-reportes)
16. [Mecanismos de Protección y Resiliencia](#16-mecanismos-de-protección-y-resiliencia)
17. [Scripts de Automatización](#17-scripts-de-automatización)
18. [Tecnologías y Dependencias Completas](#18-tecnologías-y-dependencias-completas)

---

## 1. ¿Qué es SecureScan Pro?

**SecureScan Pro v5.0** es una plataforma web de análisis de seguridad automatizado, desarrollada como proyecto de grado del programa **Técnico en Seguridad de Aplicaciones Web del SENA**. Su propósito es realizar evaluaciones de seguridad completas sobre aplicaciones web de forma automática, integrando once herramientas profesionales de la industria dentro de un único sistema.

### ¿Para qué sirve?

Cuando un analista de seguridad necesita evaluar qué tan vulnerable es una aplicación web, normalmente tendría que ejecutar docenas de herramientas manualmente, una por una, interpretar los resultados de cada una y luego consolidar todo en un reporte. **SecureScan Pro automatiza todo ese proceso**: el analista solo ingresa la URL del objetivo y el sistema hace el resto.

### ¿Qué hace exactamente?

- Identifica qué tecnologías usa el sitio web (PHP, Node.js, Apache, etc.)
- Descubre qué puertos y servicios están abiertos
- Encuentra rutas y directorios ocultos
- Detecta vulnerabilidades conocidas (SQL Injection, XSS, etc.)
- Prueba si las contraseñas son débiles
- Busca exploits públicos aplicables
- Genera un reporte completo con puntuación de seguridad

### Características clave de la versión 5.0

| Característica | Descripción |
|---|---|
| **Pipeline de 11 pasos** | Cada herramienta alimenta a la siguiente con sus resultados |
| **Auto-login** | Se autentica automáticamente en DVWA, Juice Shop y WebGoat |
| **InjectionScanner propio** | Módulo desarrollado desde cero con 10 técnicas de inyección |
| **Circuit Breaker** | Si algo falla, el sistema continúa sin caerse |
| **4 formatos de reporte** | HTML, PDF, JSON y CSV |
| **10 servicios Docker** | Todo contenedorizado, arranca con un solo comando |
| **23.902 líneas de código** | 11.290 Python + ~12.612 TypeScript/TSX |

---

## 2. Cómo funciona — Arquitectura del Sistema

La arquitectura se puede entender en tres capas, como un edificio de tres pisos:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    🖥️  USUARIO (Navegador)                          │
│           Ingresa la URL y ve los resultados en tiempo real         │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP puerto 3000
┌────────────────────────────▼────────────────────────────────────────┐
│           PISO 1 — FRONTEND (Next.js / React / TypeScript)          │
│                                                                     │
│  📋 Formulario     ⏳ Progreso en         📊 Dashboard de           │
│  de escaneo        tiempo real            resultados               │
│  scan-form.tsx     scan-progress.tsx      results-dashboard.tsx    │
└────────────────────────────┬────────────────────────────────────────┘
                             │ HTTP puerto 5000 (API REST / JSON)
┌────────────────────────────▼────────────────────────────────────────┐
│           PISO 2 — BACKEND (Flask / Python / Gunicorn)              │
│                        server/app.py                                │
│                                                                     │
│  🔐 Autenticación   🚦 Rate Limiting   ✅ Validación de targets    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │          🎯 ORQUESTADOR — SecurityOrchestrator              │   │
│  │              server/modules/orchestrator.py                  │   │
│  │                                                             │   │
│  │  Paso 1  Wappalyzer → Paso 2  Nmap    → Paso 3  Patator   │   │
│  │  Paso 4  Metasploit → Paso 5  ffuf    → Paso 6  Gobuster  │   │
│  │  Paso 7  ZAP        → Paso 8  Nuclei  → Paso 9  Injection │   │
│  │  Paso 10 Searchsploit → Paso 11 Puntuación final           │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────┬────────────────────────┬──────────────────────────┬──────────┘
       │                        │                          │
┌──────▼──────┐  ┌─────────────▼────────────┐  ┌──────────▼──────────┐
│  💾 Redis 7  │  │  🕷️ OWASP ZAP :8080     │  │  💉 SQLMap API      │
│  :6379       │  │  Spider + Escaneo activo │  │  :8775              │
│  (memoria    │  │                          │  │  (container:        │
│  de sesiones)│  └──────────────────────────┘  │   sqlmapapi)        │
└─────────────┘                                 └─────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│              PISO 3 — LABORATORIO (Red aislada lab-net)             │
│                                                                     │
│  🍊 Juice Shop    💀 DVWA           🐐 WebGoat    🔫 Metasploit    │
│  :3001→:3000      :3002→:80         :3003→:8080   :55553           │
│  (Node.js)        (PHP+MariaDB)     (Java Spring) (RPC daemon)     │
└─────────────────────────────────────────────────────────────────────┘
```

### Las dos redes Docker

El sistema usa dos redes internas separadas para mayor seguridad:

| Red | Subred | ¿Qué contiene? |
|---|---|---|
| `securescan-net` | `172.20.0.0/16` | API, Redis, ZAP, Metasploit (infraestructura principal) |
| `lab-net` | `172.21.0.0/16` | DVWA, Juice Shop, WebGoat (laboratorios vulnerables aislados) |

> **¿Por qué dos redes?** Los laboratorios vulnerables están separados para que no puedan comunicarse con servicios externos. Solo la API tiene acceso a ambas redes para poder escanearlos.

---

## 3. Estructura de Carpetas y Archivos

```
SecureScan-main/
│
├── 📁 server/                        ← Todo el backend en Python
│   ├── app.py                        → Punto de entrada de la API REST (1.068 líneas)
│   ├── Dockerfile                    → Cómo construir la imagen Docker del backend
│   ├── entrypoint.sh                 → Script de arranque del contenedor
│   ├── requirements.txt              → Lista de librerías Python necesarias
│   ├── wordlist-common.txt           → Diccionario de rutas para Gobuster/ffuf
│   │
│   ├── 📁 modules/                   ← Un archivo por herramienta de seguridad
│   │   ├── orchestrator.py           → Director del pipeline (1.234 líneas)
│   │   ├── wappalyzer.py             → Detecta tecnologías del sitio web
│   │   ├── nmap_scanner.py           → Escanea puertos abiertos
│   │   ├── patator.py                → Prueba contraseñas débiles (brute force)
│   │   ├── metasploit.py             → Ejecuta módulos de Metasploit vía RPC
│   │   ├── ffuf.py                   → Descubre rutas y endpoints ocultos (fuzzing)
│   │   ├── gobuster.py               → Enumera directorios y archivos
│   │   ├── zap_scanner.py            → Escaneo dinámico DAST con OWASP ZAP
│   │   ├── nuclei.py                 → Escaneo por plantillas de vulnerabilidades
│   │   ├── sqlmap.py                 → Detecta inyecciones SQL
│   │   ├── searchsploit.py           → Busca exploits en base de datos ExploitDB
│   │   └── injection_scanner.py     → Módulo propio: 10 técnicas de inyección (1.720 líneas)
│   │
│   └── 📁 utils/                     ← Herramientas de soporte
│       ├── reporter.py               → Genera reportes HTML/PDF/JSON/CSV (1.382 líneas)
│       ├── scoring.py                → Calcula la puntuación de seguridad (565 líneas)
│       └── i18n_backend.py           → Soporte de idiomas (español/inglés)
│
├── 📁 app/                           ← Frontend Next.js (App Router)
│   ├── layout.tsx                    → Estructura base de todas las páginas
│   ├── globals.css                   → Estilos globales y variables de color
│   ├── page.tsx                      → Página de inicio / Landing
│   ├── scanner/page.tsx              → 🎯 Página principal del escáner
│   ├── history/page.tsx              → Historial de escaneos anteriores
│   ├── lab/page.tsx                  → Panel de control del laboratorio
│   └── docs/page.tsx                 → Documentación integrada
│
├── 📁 components/                    ← Componentes React reutilizables
│   ├── scan-form.tsx                 → Formulario para iniciar un escaneo
│   ├── scan-progress.tsx             → Barra de progreso en tiempo real
│   ├── results-dashboard.tsx         → Dashboard completo de resultados
│   ├── report-download-modal.tsx     → Modal para descargar el reporte
│   ├── header.tsx                    → Navegación principal
│   ├── 📁 cyber/                     → Componentes visuales del tema cyber
│   └── 📁 ui/                        → Componentes base (Shadcn/ui + Radix UI)
│
├── 📁 lib/                           ← Lógica compartida del cliente
│   ├── api-client.ts                 → Todas las llamadas a la API (tipadas)
│   ├── scan-context.tsx              → Estado global del escaneo (React Context)
│   ├── validators.ts                 → Validación de formularios
│   └── utils.ts                      → Funciones de utilidad general
│
├── 📁 messages/                      ← Traducciones
│   ├── es.json                       → Textos en español
│   └── en.json                       → Textos en inglés
│
├── 📁 public/docs/                   ← Documentación estática en Markdown
│   ├── api.md
│   ├── architecture.md
│   ├── deployment.md
│   ├── security.md
│   └── tools.md
│
├── 📁 Documentacion/                 ← Documentos del proyecto de grado
│   ├── DOCUMENTACION_TECNICA_COMPLETA.md
│   ├── ESTRUCTURA_PROYECTO.md
│   ├── ETICA_Y_LEGALIDAD.md
│   ├── GUIA_DESPLIEGUE_SECURESCAN_PRO_v3.md
│   └── PRESENTACION_SENA.md
│
├── docker-compose.yml                → Define y conecta los 10 servicios Docker
├── Dockerfile.frontend               → Cómo construir la imagen del frontend
├── .env                              → Variables de configuración (contraseñas, puertos)
├── start.sh                          → Script para arrancar todo con un comando
├── verify.sh                         → Verifica que todos los servicios estén bien
├── package.json                      → Dependencias Node.js del frontend
├── next.config.mjs                   → Configuración de Next.js
├── tailwind.config.ts                → Configuración de estilos Tailwind
└── tsconfig.json                     → Configuración de TypeScript
```

---

## 4. Backend — El Motor de Seguridad

El backend es el cerebro del sistema. Está construido en **Python con Flask** y es responsable de recibir las solicitudes del frontend, coordinar todos los módulos de seguridad y devolver los resultados.

### ¿Qué tecnologías usa?

| Tecnología | Versión | ¿Para qué sirve? |
|---|---|---|
| **Python** | 3.11 | Lenguaje principal del backend |
| **Flask** | 3.x | Framework web para la API REST |
| **Gunicorn** | 21.x | Servidor de producción (2 workers, 4 threads cada uno) |
| **Redis** | 7 | Base de datos en memoria para guardar resultados de escaneos |
| **Flask-CORS** | 4.x | Permite que el frontend se comunique con la API |
| **Flask-Limiter** | 3.x | Limita cuántas peticiones puede hacer un usuario por hora |

### ¿Cómo arranca?

```
Usuario → Frontend (puerto 3000) → API Flask (puerto 5000) → Herramientas de seguridad
```

El backend corre con **Gunicorn**, que es el servidor de producción. Usa 2 procesos paralelos, cada uno con 4 hilos, y un timeout de **3600 segundos** (1 hora) para que los escaneos largos no se corten.

### Sistema de almacenamiento dual

El sistema guarda los resultados de dos formas, de manera automática:

```
1º Opción → Redis (base de datos rápida en memoria)
         → Si Redis no está disponible...
2º Opción → Memoria del proceso Python (máximo 200 escaneos guardados)
```

Esto garantiza que aunque Redis falle, el sistema sigue funcionando y los resultados no se pierden.

### Seguridad de la API

El backend implementa varias capas de seguridad:

**Autenticación por token:**
```
Header: X-API-Token: <tu-token>
```
Si el token no coincide → error 401. Si no hay token configurado, acepta todas las peticiones (útil para desarrollo).

**Límites de peticiones (Rate Limiting):**

| Endpoint | Límite |
|---|---|
| `POST /api/scan` (iniciar escaneo) | 20 por hora |
| `GET /api/health` (verificar estado) | Sin límite |
| `GET /api/scan/<id>/status` | Sin límite |
| Resto de endpoints | 500/día, 100/hora |

**Validación de targets (¿Adónde se puede escanear?):**

El sistema valida cada URL antes de aceptarla para evitar usos maliciosos:
- ✅ Permite: dominios públicos (`https://mi-sitio.com`), IPs de red local propia
- ✅ Permite siempre: los laboratorios internos (DVWA, Juice Shop, WebGoat)
- ❌ Bloquea: `localhost`, `127.0.0.1`, `0.0.0.0` (apuntan al contenedor mismo)

**Validación de IDs de escaneo:**
Cada escaneo recibe un identificador único en formato UUID v4 (ejemplo: `550e8400-e29b-41d4-a716-446655440000`). Cualquier petición con un ID malformado recibe error 400.

### Threads de escaneo (proceso en segundo plano)

Cuando se inicia un escaneo, el backend lanza un **hilo de ejecución** separado para que el proceso no bloquee la API:

```python
thread = threading.Thread(
    target=run_scan,
    daemon=False  # No-daemon: el thread sobrevive aunque Gunicorn recicle el worker
)
thread.start()
```

El frontend hace consultas cada 2 segundos al endpoint de estado para ver cómo avanza el escaneo.

### Persistencia parcial de resultados

Después de cada herramienta que termina, el resultado se guarda inmediatamente en Redis:

```
Wappalyzer termina → guarda en Redis
Nmap termina       → guarda en Redis
Patator termina    → guarda en Redis
...
```

Esto garantiza que si el proceso falla a mitad del escaneo, los resultados parciales no se pierden.

---

## 5. El Orquestador — Director del Pipeline

El archivo `server/modules/orchestrator.py` (1.234 líneas) es la pieza más importante del sistema. Es el **director de orquesta** que coordina las 11 herramientas en el orden correcto, pasando los resultados de una a otra.

### La clase SecurityOrchestrator

```python
class SecurityOrchestrator:
    # Timeouts configurables por herramienta (en segundos)
    TIMEOUTS = {
        'wappalyzer':   60,
        'nmap':         300,
        'ffuf':         300,
        'gobuster':     300,
        'zap':          1200,
        'nuclei':       1200,
        'searchsploit': 120,
        'metasploit':   900,
        'sqlmap':       600,
        'patator':      180,
        'injection':    600,
    }
```

Todos los timeouts son ajustables desde el archivo `.env` sin modificar código.

### Timeouts seguros con hilos

El orquestador usa un sistema de timeout con `threading.Event` (en lugar de señales del sistema operativo que no funcionan en hilos):

```
Herramienta ejecutándose → Si no termina en X segundos → Se cancela automáticamente
                                                        → El pipeline continúa con la siguiente
```

### Auto-login automático por laboratorio

Antes de empezar el escaneo, el orquestador se autentica en el laboratorio objetivo:

| Laboratorio | Método de login | Credenciales | Cookie obtenida |
|---|---|---|---|
| **DVWA** | Formulario HTML + CSRF token (3 peticiones) | `admin / password` | `PHPSESSID; security=low` |
| **Juice Shop** | API REST JSON | `admin@juice-sh.op / admin123` | Token JWT |
| **WebGoat** | Formulario Spring Security | `securescan / Password` | `JSESSIONID` |

> **Corrección importante (DVWA):** DVWA requiere un token CSRF especial para cambiar el nivel de seguridad a `low`. Sin este token, DVWA mantiene el nivel `impossible` y bloquea SQLMap y Nuclei silenciosamente. El sistema realiza 3 peticiones: GET login → POST login → GET security.php → POST security.php con token correcto.

### Propagación de cookies entre herramientas

Una vez autenticado, la cookie de sesión se comparte con todas las herramientas del pipeline:

```
Auto-login obtiene cookie de sesión
          │
          ├──→ Paso 5: ffuf       (usa la cookie)
          ├──→ Paso 6: Gobuster   (usa la cookie)
          ├──→ Paso 7: ZAP        (usa la cookie)
          ├──→ Paso 8: Nuclei     (usa la cookie)
          └──→ Paso 9: InjectionScanner / SQLMap (usa la cookie)
```

Esto es crucial porque sin la cookie de sesión, herramientas como Nuclei solo verían las páginas públicas del sitio, perdiendo el 80% de la superficie de ataque.

---

## 6. Las 11 Herramientas de Seguridad

### 6.1 🔍 Wappalyzer — Detector de Tecnologías

**¿Qué hace?** Analiza la respuesta HTTP del sitio web e identifica qué tecnologías usa: frameworks, servidores, bases de datos, sistemas de gestión de contenido, etc.

**¿Por qué es importante?** Si sabemos que el sitio usa PHP 7.2 o Apache 2.4.49, podemos buscar vulnerabilidades conocidas para esas versiones exactas.

**Estrategia de detección en cascada:**
1. Librería Python `python-Wappalyzer` (sin proceso externo, más rápido)
2. Herramienta CLI `wappalyzer-cli` (si está disponible)
3. Datos simulados por laboratorio (como último recurso)

**Ejemplo de salida:**
```json
[
  {"name": "Node.js", "version": "18.x", "category": "javascript-frameworks"},
  {"name": "Express", "version": "4.x", "category": "web-frameworks"}
]
```

---

### 6.2 🗺️ Nmap — Escáner de Puertos

**¿Qué hace?** Descubre qué servicios y puertos están abiertos en el servidor objetivo. También detecta versiones de los servicios.

**Comando ejecutado:**
```bash
nmap -sV -sC -O --script=banner,version -T4 -p <puertos> --open -oX - <hostname>
```

**Detección dinámica de puertos:** Si la URL usa un puerto fuera del rango 1-1000 (como `3001` de Juice Shop), lo agrega automáticamente a la lista de puertos a escanear.

---

### 6.3 🔑 Patator — Prueba de Contraseñas

**¿Qué hace?** Prueba combinaciones de usuario/contraseña comunes para detectar credenciales débiles.

**Credenciales probadas (selección):**
- Usuarios: `admin`, `administrator`, `guest`, `root`, `user`, `test`, `demo`
- Contraseñas: `password`, `admin123`, `123456`, `admin`, `root`, `pass`, `test`

**Resultado:** Si encuentra credenciales válidas, las reporta como vulnerabilidad de tipo "brute force" y usa la cookie de sesión obtenida para las herramientas siguientes.

---

### 6.4 💣 Metasploit — Módulos de Explotación

**¿Qué hace?** Ejecuta módulos auxiliares de Metasploit contra el objetivo a través de una conexión RPC al contenedor `msfrpcd`.

**Módulos ejecutados siempre:**
- `auxiliary/scanner/http/http_version` — Detecta versión del servidor HTTP
- `auxiliary/scanner/http/options` — Verifica métodos HTTP peligrosos
- `auxiliary/scanner/http/dir_listing` — Busca listados de directorios
- `auxiliary/scanner/http/robots_txt` — Lee el archivo robots.txt

**Módulos adicionales según tecnología detectada:** Si Wappalyzer identifica Apache Tomcat, por ejemplo, se ejecutan módulos específicos de Tomcat.

> **Nota:** Si Metasploit no está disponible, el módulo activa automáticamente un modo de simulación sin interrumpir el pipeline.

---

### 6.5 🔎 ffuf — Fuzzing de Endpoints

**¿Qué hace?** Prueba miles de rutas y nombres de archivo buscando recursos ocultos del sitio.

**Versión:** ffuf v2.1.0 (compilado en Go)

**Ejemplo:** Si el sitio tiene `/admin`, `/backup`, `/api/v1/users`, ffuf los descubrirá aunque no estén enlazados en el sitio.

**Resultado:** Lista de URLs descubiertas con su código HTTP. Estas URLs se inyectan en ZAP para que las escanee.

---

### 6.6 📂 Gobuster — Enumeración de Directorios

**¿Qué hace?** Similar a ffuf pero especializado en directorios y archivos, usando listas de palabras más extensas (SecLists, más de 200.000 entradas).

**Versión:** gobuster v3.6.0 (compilado en Go)

**Wordlist automática:**
```
1º → /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt
2º → /app/wordlist-common.txt (incluida en el repositorio)
3º → /usr/share/wordlists/dirb/common.txt
```

---

### 6.7 🕷️ OWASP ZAP — Escaneo Dinámico (DAST)

**¿Qué hace?** Es el escáner más completo. Primero recorre automáticamente el sitio (spider) descubriendo todas las páginas, y luego realiza un ataque activo probando cientos de vulnerabilidades en cada formulario y parámetro encontrado.

**Modo unificado:** ZAP ejecuta Spider + Escaneo Activo en un solo paso unificado. Antes de escanear, recibe las URLs que encontraron ffuf y Gobuster, ampliando su cobertura.

**Políticas de escaneo por laboratorio:**
| Objetivo | Política ZAP |
|---|---|
| DVWA | `Dev Standard` |
| WebGoat | `Dev Standard` |
| Juice Shop | `Dev CICD` |
| Genérico | `Default Policy` |

---

### 6.8 🎯 Nuclei — Escaneo por Plantillas

**¿Qué hace?** Ejecuta más de 13.000 plantillas de detección de vulnerabilidades conocidas (CVEs, misconfigurations, exposures, etc.).

**Versión:** nuclei v3.2.4 (compilado en Go)

**Plantillas usadas por laboratorio:**
| Objetivo | Tags de plantillas |
|---|---|
| Juice Shop | `cve, sqli, xss, jwt, cors, ssrf, owasp, swagger, api, nodejs` |
| DVWA | `cve, sqli, xss, lfi, rce, rfi, default-login, misconfig, php` |
| WebGoat | `cve, sqli, xss, jwt, xxe, ssrf, cors, java, spring` |

---

### 6.9 💉 InjectionScanner — Módulo Propio

**¿Qué hace?** Es el módulo desarrollado desde cero para este proyecto (1.720 líneas de Python). Detecta activamente 10 tipos de inyección:

| # | Técnica | ¿Qué detecta? |
|---|---|---|
| 1 | **SQL Injection** | Error-based, UNION, Boolean-Blind, Time-Blind, Auth-Bypass |
| 2 | **NoSQL Injection** | Operadores MongoDB (`$gt`, `$ne`, regex bypass) |
| 3 | **XPath Injection** | Auth bypass, error-based |
| 4 | **XXE (XML Injection)** | Lectura de archivos del servidor, OOB, blind |
| 5 | **XSS** | Reflected, Stored, DOM-based |
| 6 | **Command Injection** | Ejecución de comandos OS con `;`, `\|`, backticks |
| 7 | **Path Traversal** | LFI, escape de directorios (`../../../etc/passwd`) |
| 8 | **SSRF** | Acceso a hosts internos, bypass de CORS |
| 9 | **SSTI** | Evaluación de templates (Jinja2, Twig, Freemarker) |
| 10 | **LDAP Injection** | Filter bypass en directorios LDAP |

> **Fallback:** Si el módulo no está disponible, el sistema usa SQLMap automáticamente.

---

### 6.10 🔍 Searchsploit — Buscador de Exploits

**¿Qué hace?** Toma las tecnologías detectadas por Wappalyzer y los CVEs encontrados por Nuclei, y busca en la base de datos local de ExploitDB si existen exploits públicos para esas vulnerabilidades.

**Comando ejecutado:**
```bash
searchsploit --json <término>
```

La opción `--json` produce salida estructurada. La base de datos ExploitDB está instalada localmente en el contenedor (no requiere internet).

---

### 6.11 📊 Scoring — Puntuación Final

No es una herramienta externa, sino el módulo `server/utils/scoring.py` que calcula la puntuación de seguridad basándose en todos los resultados recopilados.

---

## 7. Utilidades del Backend

### 7.1 Sistema de Puntuación (`server/utils/scoring.py`)

Calcula una puntuación de 0 a 100 usando un sistema de penalizaciones ponderado:

```
Puntuación inicial: 100 puntos

Por cada vulnerabilidad encontrada, se resta:
  - Crítica:  -20 puntos
  - Alta:     -10 puntos
  - Media:     -5 puntos
  - Baja:      -2 puntos
  - Info:     -0.5 puntos

Si hay un exploit público para una vulnerabilidad encontrada:
  - Penalización adicional: -8 puntos

Si hay exploits sin vulnerabilidad correlacionada:
  - Penalización: -3 puntos por exploit

Si se encontraron credenciales débiles (brute force exitoso):
  - Penalización adicional: -10 puntos

Resultado final: máximo 100, mínimo 0
```

**Escala de calificación:**

| Puntuación | Letra | Nivel de Riesgo |
|---|---|---|
| 95 - 100 | A+ | BAJO |
| 90 - 94 | A | BAJO |
| 85 - 89 | A- | BAJO |
| 80 - 84 | B+ | BAJO |
| 75 - 79 | B | BAJO |
| 70 - 74 | B- | MEDIO |
| 65 - 69 | C+ | MEDIO |
| 60 - 64 | C | MEDIO |
| 55 - 59 | C- | MEDIO |
| 50 - 54 | D+ | ALTO |
| 45 - 49 | D | ALTO |
| 40 - 44 | D- | ALTO |
| 0 - 39 | F | CRÍTICO |

### 7.2 Generador de Reportes (`server/utils/reporter.py`)

Genera reportes exportables en 4 formatos (1.382 líneas):

| Formato | ¿Cómo se genera? | ¿Para qué sirve? |
|---|---|---|
| **HTML** | Estilos CSS embebidos, sanitización XSS | Reporte visual completo para presentar |
| **PDF** | HTML convertido con `pdfkit` + `wkhtmltopdf` | Documento imprimible y enviable |
| **JSON** | Datos completos en formato estructurado | Integración con otras herramientas |
| **CSV** | Solo vulnerabilidades en tabla | Importar en Excel o sistemas de tickets |

**Secciones del reporte HTML:**
- Encabezado con metadata (ID de escaneo, target, duración)
- Panel de puntuación visual con grade y nivel de riesgo
- Recomendaciones priorizadas (URGENTE / ALTO / MEDIO)
- Tabla de vulnerabilidades ordenada por severidad
- Tecnologías detectadas, puertos abiertos, directorios descubiertos
- Hallazgos de Metasploit y exploits correlacionados

### 7.3 Internacionalización (`server/utils/i18n_backend.py`)

El backend detecta el idioma preferido del usuario desde el header `Accept-Language` de la petición HTTP y responde en español o inglés automáticamente. Los textos están en `server/locales/es.json` y `server/locales/en.json`.

---

## 8. Frontend — La Interfaz de Usuario

### 8.1 Stack tecnológico

| Tecnología | Versión | ¿Para qué sirve? |
|---|---|---|
| **Next.js** | 16.2.9 | Framework React con App Router |
| **React** | 19.2.7 | Librería de interfaz de usuario |
| **TypeScript** | 5.4 | Tipado estático (evita errores en tiempo de desarrollo) |
| **Tailwind CSS** | 3.4 | Sistema de estilos por clases utilitarias |
| **Shadcn/ui** | (componentes) | Componentes accesibles sobre Radix UI |
| **TanStack Query** | 5.28 | Manejo de peticiones HTTP y caché |
| **React Hook Form** | 7.51 | Formularios con validación |
| **Zod** | 3.22 | Validación de esquemas de datos |
| **Recharts** | 2.12 | Gráficos y visualizaciones |
| **Lucide React** | 0.400 | Iconos SVG |
| **Sonner** | 1.4 | Notificaciones toast |
| **pnpm** | 8.15 | Gestor de paquetes (reemplaza npm) |
| **Node.js** | ≥20 | Entorno de ejecución |

### 8.2 Páginas principales

**`app/scanner/page.tsx` — El escáner:**
- Formulario para ingresar la URL objetivo
- Selector rápido de laboratorios (1 clic para escanear DVWA, Juice Shop o WebGoat)
- Checkboxes para seleccionar qué herramientas activar
- Panel de progreso en tiempo real (polling cada 2 segundos)
- Dashboard de resultados al finalizar

**`app/history/page.tsx` — El historial:**
- Lista de los últimos 100 escaneos realizados
- Filtros por estado, target y fecha
- Acceso rápido a reportes anteriores

**`app/lab/page.tsx` — El laboratorio:**
- Estado en tiempo real de los contenedores DVWA, Juice Shop y WebGoat
- Botones para iniciar/detener cada laboratorio
- URLs de acceso directo a cada laboratorio

**`app/docs/page.tsx` — La documentación:**
- Documentación integrada en la interfaz
- Renderiza los archivos Markdown de `/public/docs/`

### 8.3 Componentes principales

**`components/scan-form.tsx`**
El formulario de inicio. Permite ingresar cualquier URL, seleccionar un laboratorio con un clic, elegir herramientas y configurar opciones avanzadas (dry-run, circuit breaker).

**`components/scan-progress.tsx`**
Muestra el progreso del escaneo en tiempo real:
- Lista de pasos con íconos de estado (pendiente / ejecutando / completado / error)
- Barra de progreso global con porcentaje
- Timer con duración del escaneo
- Polling automático cada 2 segundos

**`components/results-dashboard.tsx`** (el más grande, ~62 KB)
Muestra todos los resultados organizados en pestañas:
- 🛡️ Vulnerabilidades (filtradas por severidad)
- 🔧 Tecnologías detectadas
- 🔌 Puertos abiertos
- 📂 Directorios encontrados
- 💉 Inyecciones SQL
- 🎯 Hallazgos de Nuclei
- 🔑 Credenciales encontradas
- 💣 Exploits correlacionados
- 🔫 Resultados de Metasploit

### 8.4 Cliente de API (`lib/api-client.ts`)

Centraliza todas las llamadas HTTP al backend con tipos TypeScript:

```typescript
// Funciones principales
startScan(target, options)        → POST /api/scan
getScanResults(jobId)             → GET  /api/scan/<id>/status
getScanHistory()                  → GET  /api/history
deleteScan(scanId)                → DELETE /api/scan/<id>
downloadReport(scanId, format)    → GET  /api/scan/<id>/report?format=html|pdf|json|csv
getLabStatus()                    → GET  /api/lab/status
startLab(labId)                   → POST /api/lab/<id>/start
stopLab(labId)                    → POST /api/lab/<id>/stop
```

### 8.5 Estado global (`lib/scan-context.tsx`)

Usa React Context para compartir el estado del escaneo entre todos los componentes:

```typescript
{
  currentScan: ScanResults | null  // Resultados del escaneo actual
  isScanning: boolean               // ¿Hay un escaneo en curso?
  error: string | null              // Mensaje de error si algo falla
  startScan(target, options)        // Función para iniciar
  cancelScan()                      // Función para cancelar
  clearResults()                    // Limpiar resultados
}
```

---

## 9. Infraestructura Docker

### 9.1 Los 10 servicios

| Servicio | Container | Imagen | Puerto local | ¿En qué red? |
|---|---|---|---|---|
| `frontend` | `securescan-frontend` | Imagen propia (Node.js) | `3000` | securescan-net |
| `api` | `securescan-api` | Imagen propia (Python) | `5000` | securescan-net + lab-net |
| `redis` | `securescan-redis` | `redis:7-alpine` | `6379` (solo local) | securescan-net |
| `zap` | `securescan-zap` | `zaproxy:stable` | `8080` | securescan-net + lab-net |
| `sqlmapapi` | `securescan-sqlmapapi` | Imagen propia (Python) | `8775` (solo local) | securescan-net + lab-net |
| `msfrpcd` | `securescan-msfrpcd` | `metasploit-framework` | `55553` | securescan-net + lab-net |
| `juice-shop` | `juice-shop` | `juice-shop:v17.0.0` | `3001` | lab-net |
| `dvwa` | `dvwa` | `dvwa:latest` | `3002` | lab-net |
| `dvwa-db` | `dvwa-db` | `mariadb:10.11` | — (interno) | lab-net |
| `webgoat` | `webgoat` | `webgoat:latest` | `3003` | lab-net |

### 9.2 ¿Cómo se construye el backend?

La imagen Docker del backend (`server/Dockerfile`) instala todo lo necesario partiendo de `python:3.11-slim-bookworm`:

1. **Paquetes del sistema:** `nmap`, `patator`, `curl`, `git`, `wkhtmltopdf`
2. **Go 1.22.5** — instalado manualmente (la versión de Debian es demasiado antigua)
3. **SQLMap** — clonado desde GitHub en `/opt/sqlmap`
4. **Herramientas Go:** `gobuster v3.6.0`, `ffuf v2.1.0`, `nuclei v3.2.4`
5. **SecLists** — clonado en `/opt/SecLists` (~1.5 GB de wordlists)
6. **ExploitDB** — clonado en `/opt/exploitdb`
7. **Usuario no-root** `scanner` — el backend no corre como root
8. **Templates de Nuclei** — ~13.000 plantillas de vulnerabilidades
9. **Gunicorn** — servidor de producción con timeout de 1 hora

### 9.3 ¿Cómo se construye el frontend?

La imagen del frontend (`Dockerfile.frontend`) usa **multi-stage build**:
- **Stage 1 (deps):** Instala dependencias con pnpm
- **Stage 2 (builder):** Construye Next.js con `pnpm build`
- **Stage 3 (runner):** Solo el output compilado (más pequeño y seguro)

### 9.4 Volúmenes persistentes

Los datos que deben sobrevivir a reinicios del contenedor se guardan en volúmenes:

| Volumen | ¿Qué guarda? |
|---|---|
| `redis-data` | Historial de escaneos |
| `scan-reports` | Reportes generados (HTML, PDF, JSON, CSV) |
| `dvwa-db-data` | Base de datos de DVWA |
| `msf-data` | Configuración de Metasploit |
| `nuclei-templates` | Templates de Nuclei (se actualizan automáticamente) |
| `juice-shop-data` | Datos de Juice Shop |
| `webgoat-data` | Datos de WebGoat |

### 9.5 Health Checks (verificación de salud)

Todos los servicios tienen un sistema de verificación automática que Docker revisa periódicamente:

| Servicio | Verificación | Intervalo |
|---|---|---|
| `redis` | `redis-cli ping` | Cada 10 segundos |
| `api` | `curl /api/health` | Cada 30 segundos |
| `zap` | `curl /JSON/core/view/version/` | Cada 30 segundos |
| `dvwa` | `curl localhost:80` | Cada 30 segundos |
| `msfrpcd` | `echo > /dev/tcp/localhost/55553` | Cada 30 segundos |

---

## 10. Pipeline de Escaneo — Los 11 Pasos

Cuando el usuario inicia un escaneo, el orquestador ejecuta las herramientas en este orden preciso:

```
🚀 INICIO DEL ESCANEO
       │
       ▼
🔐 [Pre-paso] Auto-login → obtiene cookie de sesión
       │
       ├─ Paso 1 ─ 🔍 Wappalyzer
       │            Detecta tecnologías del sitio
       │            → Resultado: lista de tecnologías con versiones
       │
       ├─ Paso 2 ─ 🗺️ Nmap
       │            Escanea puertos 1-1000 (+ puerto del target si está fuera del rango)
       │            → Resultado: lista de puertos abiertos con servicios
       │
       ├─ Paso 3 ─ 🔑 Patator ← COOKIE DISPONIBLE A PARTIR DE AQUÍ
       │            Prueba credenciales comunes
       │            → Resultado: credenciales válidas (si encuentra alguna)
       │
       ├─ Paso 4 ─ 💣 Metasploit
       │            Ejecuta módulos auxiliares según tecnologías detectadas
       │            → Resultado: hallazgos específicos de MSF
       │
       ├─ Paso 5 ─ 🔎 ffuf
       │            Fuzzea rutas y endpoints del sitio
       │            → Resultado: lista de URLs descubiertas
       │
       ├─ Paso 6 ─ 📂 Gobuster
       │            Enumera directorios con wordlist de SecLists
       │            → Resultado: directorios y archivos encontrados
       │
       ├─ Paso 7 ─ 🕷️ ZAP Full Scan (Spider + Escaneo Activo)
       │            Inyecta URLs de ffuf y Gobuster, luego escanea todo
       │            → Resultado: vulnerabilidades web (XSS, SQLi, CSRF, etc.)
       │
       ├─ Paso 8 ─ 🎯 Nuclei
       │            Corre ~13.000 plantillas de vulnerabilidades
       │            → Resultado: CVEs y misconfigurations detectadas
       │
       ├─ Paso 9 ─ 💉 InjectionScanner / SQLMap (fallback)
       │            10 técnicas de inyección activa
       │            → Resultado: vulnerabilidades de inyección detalladas
       │
       ├─ Paso 10 ─ 🔍 Searchsploit
       │             Busca exploits para tecnologías y CVEs detectados
       │             → Resultado: exploits públicos aplicables
       │
       └─ Paso 11 ─ 📊 Scoring
                    Calcula puntuación y genera recomendaciones
                    → Resultado: score 0-100, grade A-F, nivel de riesgo, recomendaciones

✅ FIN DEL ESCANEO → Resultados disponibles para descarga en 4 formatos
```

**Resultado completo guardado en Redis:**
```json
{
  "id": "uuid-del-escaneo",
  "target": "http://dvwa:80",
  "status": "completed",
  "startTime": "2026-07-01T10:00:00Z",
  "endTime": "2026-07-01T10:35:00Z",
  "technologies": [...],
  "ports": [...],
  "directories": [...],
  "vulnerabilities": [...],
  "exploits": [...],
  "metasploit": [...],
  "nuclei_findings": [...],
  "sqli_results": [...],
  "brute_force_results": [...],
  "ffuf_endpoints": [...],
  "score": {
    "total": 45,
    "grade": "D",
    "breakdown": {"critical": 1, "high": 2, "medium": 5, "low": 8, "info": 12},
    "riskLevel": "HIGH",
    "recommendations": [...]
  }
}
```

---

## 11. API REST — Cómo Habla el Sistema

La API usa el formato REST con JSON. Todos los endpoints usan el prefijo `/api/`.

### 11.1 Verificar que todo funciona

```
GET /api/health
```

**Respuesta esperada:**
```json
{
  "status": "healthy",
  "version": "5.0.0",
  "storage": "connected",
  "zap_configured": true,
  "tools": ["wappalyzer", "nmap", "gobuster", "zap", "searchsploit",
            "metasploit", "nuclei", "sqlmap", "injection_scanner", "patator", "ffuf"]
}
```

### 11.2 Iniciar un escaneo

```
POST /api/scan
Content-Type: application/json
```

**Cuerpo de la petición:**
```json
{
  "target": "http://dvwa:80",
  "options": {
    "tools": {
      "wappalyzer": true,
      "nmap": true,
      "gobuster": true,
      "zap": true,
      "nuclei": true,
      "sqlmap": true,
      "patator": true,
      "ffuf": true,
      "metasploit": false,
      "searchsploit": true
    },
    "dry_run": false
  }
}
```

**Respuesta:**
```json
{"jobId": "550e8400-e29b-41d4-a716-446655440000", "status": "running"}
```

**Posibles errores:**
| Código | Significado |
|---|---|
| `400` | JSON inválido o URL vacía |
| `401` | Token de autenticación incorrecto |
| `403` | Target no permitido (modo laboratorio estricto) |
| `422` | URL no accesible (DNS o TCP fallido) |
| `429` | Límite de peticiones excedido o circuit breaker abierto |

### 11.3 Consultar el estado de un escaneo

```
GET /api/scan/<jobId>/status
```

El frontend llama a este endpoint cada 2 segundos para actualizar la barra de progreso. Devuelve el objeto completo con todos los resultados parciales disponibles hasta ese momento.

### 11.4 Descargar el reporte

```
GET /api/scan/<jobId>/report?format=html
GET /api/scan/<jobId>/report?format=pdf
GET /api/scan/<jobId>/report?format=json
GET /api/scan/<jobId>/report?format=csv
```

El archivo se descarga con el nombre `security-report-<jobId>.<formato>`.

### 11.5 Ver historial de escaneos

```
GET /api/history
```

Devuelve los últimos 100 escaneos ordenados por fecha descendente.

### 11.6 Eliminar un escaneo

```
DELETE /api/scan/<jobId>
```

### 11.7 Control del laboratorio

```
GET  /api/lab/status           → Estado de los contenedores del lab
POST /api/lab/juice-shop/start → Iniciar Juice Shop
POST /api/lab/dvwa/stop        → Detener DVWA
```

---

## 12. Variables de Configuración

Todas las variables se definen en el archivo `.env` en la raíz del proyecto.

### Variables principales

| Variable | Valor por defecto | ¿Para qué sirve? |
|---|---|---|
| `SECRET_KEY` | *(sin valor)* | Clave secreta de Flask. Generar con: `openssl rand -hex 32` |
| `FLASK_ENV` | `development` | Modo de Flask (`development` o `production`) |
| `REDIS_PASSWORD` | `changeme-redis-password` | Contraseña de Redis |
| `ZAP_API_KEY` | `securescan-dev-key-2024` | Clave de acceso a la API de ZAP |
| `MSF_PASSWORD` | `msf` | Contraseña del daemon de Metasploit |
| `API_TOKEN` | *(vacío)* | Token de autenticación de la API. Si está vacío, no requiere autenticación |
| `RESTRICT_TO_LAB_TARGETS` | `false` | Si `true`, solo permite escanear los laboratorios internos |
| `GUNICORN_TIMEOUT` | `3600` | Máximo de segundos que puede durar un escaneo |

### Timeouts por herramienta (en segundos)

| Variable | Valor predeterminado | Herramienta |
|---|---|---|
| `SCAN_TIMEOUT_WAPPALYZER` | 60 | Detector de tecnologías |
| `SCAN_TIMEOUT_NMAP` | 300 | Escáner de puertos |
| `SCAN_TIMEOUT_FFUF` | 300 | Fuzzing de endpoints |
| `SCAN_TIMEOUT_GOBUSTER` | 300 | Enumeración de directorios |
| `SCAN_TIMEOUT_ZAP` | 1200 | Escaneo DAST (el más lento) |
| `SCAN_TIMEOUT_NUCLEI` | 1200 | Escaneo por plantillas |
| `SCAN_TIMEOUT_SQLMAP` | 600 | Detección de SQLi |
| `SCAN_TIMEOUT_PATATOR` | 180 | Brute force |
| `SCAN_TIMEOUT_METASPLOIT` | 900 | Módulos MSF |
| `SCAN_TIMEOUT_SEARCHSPLOIT` | 120 | Búsqueda de exploits |
| `SCAN_TIMEOUT_INJECTION` | 600 | InjectionScanner |

### Variables del frontend

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | URL de la API para el navegador |
| `NEXT_PUBLIC_API_TOKEN` | *(vacío)* | Token de autenticación para el navegador |

---

## 13. Laboratorio de Seguridad

El sistema incluye tres aplicaciones web vulnerables diseñadas específicamente para practicar seguridad. Están completamente aisladas en la red `lab-net` y no tienen acceso a internet.

### 13.1 🍊 OWASP Juice Shop v17.0.0

**URL local:** `http://localhost:3001`
**URL interna (Docker):** `http://juice-shop:3000`
**Tecnología:** Node.js / Koa / SQLite

Es una tienda en línea ficticia con vulnerabilidades OWASP Top 10 2021 deliberadamente introducidas. Es la aplicación de práctica más completa y moderna disponible.

**Credenciales:** `admin@juice-sh.op` / `admin123`

**Vulnerabilidades principales:**
- Acceso a rutas de administración sin autenticación
- Contraseñas débiles y tokens JWT predecibles
- SQL Injection en la búsqueda de productos
- XSS en comentarios y perfiles
- APIs REST desprotegidas

---

### 13.2 💀 DVWA (Damn Vulnerable Web Application)

**URL local:** `http://localhost:3002`
**URL interna (Docker):** `http://dvwa:80`
**Tecnología:** PHP / MariaDB 10.11

Aplicación PHP clásica de práctica con vulnerabilidades organizadas en 3 niveles de dificultad. Es el laboratorio más usado en la industria para aprender seguridad.

**Credenciales:** `admin` / `password`

**Nivel de seguridad:** SecureScan Pro fuerza el nivel a `low` automáticamente para que todas las herramientas puedan explotar las vulnerabilidades.

**Módulos vulnerables:**
- `/vulnerabilities/sqli/` — SQL Injection
- `/vulnerabilities/xss_r/` — XSS Reflejado
- `/vulnerabilities/xss_s/` — XSS Almacenado
- `/vulnerabilities/brute/` — Brute Force de login
- `/vulnerabilities/upload/` — Subida de archivos sin validación

---

### 13.3 🐐 WebGoat

**URL local:** `http://localhost:3003`
**URL interna (Docker):** `http://webgoat:8080`
**Tecnología:** Java Spring Boot

Aplicación Java con lecciones interactivas que explican cada vulnerabilidad antes de permitir que el usuario la explote.

**Credenciales:** `securescan` / `Password`

**Particularidades técnicas:**
- Toda la aplicación está bajo el path `/WebGoat/`
- ffuf hace fuzzing en `/WebGoat/FUZZ`
- Gobuster enumera desde `<target>/WebGoat`
- Requiere un GET antes del POST de login (Spring Security)

---

## 14. Sistema de Puntuación de Seguridad

### ¿Cómo se calcula?

El sistema parte de 100 puntos y va descontando según los hallazgos:

**Ejemplo real** — sitio con: 1 crítico, 2 altos, 5 medios, 8 bajos, 12 informativos:
```
100  (inicio)
- 20 (1 crítico × 20)
- 20 (2 altos × 10)
- 25 (5 medios × 5)
- 16 (8 bajos × 2)
-  6 (12 informativos × 0.5)
─────
 13  (puntuación final → Grado: F → Nivel: CRÍTICO)
```

### Penalizaciones adicionales

| Situación | Penalización extra |
|---|---|
| Vulnerabilidad con exploit público disponible | -8 puntos adicionales |
| Exploit sin vulnerabilidad correlacionada | -3 puntos |
| Credenciales débiles encontradas (brute force) | -10 puntos |

### Escala completa

| Puntuación | Grado | Nivel de riesgo | Significado |
|---|---|---|---|
| 95 - 100 | **A+** | BAJO | Excelente postura de seguridad |
| 90 - 94 | **A** | BAJO | Muy bueno, solo detalles menores |
| 85 - 89 | **A-** | BAJO | Bueno, pocos riesgos bajos |
| 80 - 84 | **B+** | BAJO | Bien, algunas áreas por mejorar |
| 75 - 79 | **B** | BAJO | Regular, problemas moderados |
| 70 - 74 | **B-** | MEDIO | Regular bajo, varios problemas |
| 65 - 69 | **C+** | MEDIO | Mejoras necesarias |
| 60 - 64 | **C** | MEDIO | Vulnerabilidades importantes |
| 55 - 59 | **C-** | MEDIO | Brechas de seguridad graves |
| 50 - 54 | **D+** | ALTO | Correcciones urgentes requeridas |
| 45 - 49 | **D** | ALTO | Acción inmediata requerida |
| 40 - 44 | **D-** | ALTO | Situación muy grave |
| 0 - 39 | **F** | CRÍTICO | Sistema altamente vulnerable |

---

## 15. Generación de Reportes

Los reportes se guardan en el volumen `scan-reports` y se descargan desde la interfaz o directamente desde la API.

### Formatos disponibles

**HTML** — Reporte visual completo
- Estilos CSS embebidos (no requiere conexión)
- Secciones colapsables por categoría
- Badges de color según severidad
- Todo el contenido sanitizado contra XSS

**PDF** — Documento imprimible
- Generado a partir del HTML con `pdfkit` + `wkhtmltopdf`
- Ideal para entregar como informe formal

**JSON** — Datos estructurados
- Todos los campos del escaneo sin transformaciones
- Ideal para integrar con otras herramientas (SIEM, ticketing, etc.)

**CSV** — Tabla de vulnerabilidades
- Columnas: nombre, severidad, URL, descripción, solución, herramienta, CVE
- Ideal para importar en Excel o Jira

### Ubicación de archivos
```
/app/reports/report-<scan_id>.html
/app/reports/report-<scan_id>.pdf
/app/reports/report-<scan_id>.json
/app/reports/report-<scan_id>.csv
```
(El directorio `/app/reports/` está mapeado al volumen Docker `scan-reports`)

---

## 16. Mecanismos de Protección y Resiliencia

### 16.1 Circuit Breaker (protección contra fallos en cascada)

Si un objetivo falla repetidamente, el sistema "abre el circuito" para no seguir enviando peticiones que van a fallar:

```
Estado CLOSED (normal)    → Todo funciona
      │ 3 fallos seguidos
      ▼
Estado OPEN (bloqueado)   → Rechaza peticiones con error 429
      │ Espera 60 segundos
      ▼
Estado HALF-OPEN (prueba) → Permite 1 intento
      │ Si funciona → vuelve a CLOSED
      │ Si falla   → vuelve a OPEN
```

Hay dos capas de circuit breaker: una en `app.py` (antes de iniciar el escaneo) y otra dentro del orquestador (durante el pipeline).

### 16.2 Retry con backoff exponencial

Si una herramienta falla temporalmente, el sistema lo intenta de nuevo:
- 1er reintento: espera 1.5 segundos
- 2do reintento: espera 2.25 segundos (1.5²)
- Si sigue fallando: continúa con la siguiente herramienta

### 16.3 Aislamiento de red

- Los laboratorios vulnerables solo están en `lab-net` y no pueden comunicarse con el exterior
- Redis solo acepta conexiones desde el propio servidor (`127.0.0.1:6379`)
- SQLMap API solo acepta conexiones locales (`127.0.0.1:8775`)

### 16.4 Seguridad del contenedor API

```yaml
cap_add:
  - NET_RAW    # Permite a nmap hacer escaneos de sockets crudos
  - NET_ADMIN  # Permite a nmap manipular interfaces de red
security_opt:
  - no-new-privileges:true  # El proceso no puede escalar privilegios
group_add:
  - "132"  # Grupo Docker (para acceder al socket y controlar labs)
```

### 16.5 Persistencia anti-OOM

El fallback en memoria tiene un límite de 200 escaneos. Cuando se supera, elimina el más antiguo automáticamente para no agotar la RAM.

---

## 17. Scripts de Automatización

### start.sh — Arranque completo en un comando

Automatiza todo el proceso de arranque en el orden correcto:

1. ✅ Verifica que Docker y Docker Compose estén instalados
2. ✅ Crea `.env` automáticamente si no existe
3. 🔨 Construye las imágenes `api`, `sqlmapapi` y `frontend`
4. 🚀 Arranca Redis y espera que responda (PING → PONG)
5. 🚀 Arranca ZAP en segundo plano
6. 🚀 Arranca los laboratorios (primero la BD de DVWA, luego DVWA, WebGoat y Juice Shop)
7. 🚀 Arranca Metasploit en segundo plano
8. 🚀 Arranca la API y SQLMap API, luego el frontend
9. 🔍 Verifica `/api/health` hasta que responde (máximo 60 segundos)
10. 📋 Muestra resumen con todas las URLs y comandos útiles

**Cómo usarlo:**
```bash
chmod +x start.sh
bash start.sh
```

### verify.sh — Diagnóstico completo

Verifica el estado de todos los servicios, endpoints y herramientas instaladas. Útil para diagnosticar problemas después del arranque.

### fix_frontend_dvwa.sh — Corrección específica de DVWA

Resuelve problemas de configuración de DVWA con el frontend en ciertos entornos de laboratorio.

---

## 18. Tecnologías y Dependencias Completas

### Backend Python (`server/requirements.txt`)

| Librería | Versión | ¿Para qué? |
|---|---|---|
| `flask` | ≥3.0,<4.0 | Framework web de la API |
| `flask-cors` | ≥4.0,<5.0 | Permite peticiones desde el frontend |
| `flask-limiter` | ≥3.5,<4.0 | Límite de peticiones por hora |
| `requests` | ≥2.31,<3.0 | Peticiones HTTP (ZAP API, auto-login) |
| `redis` | ≥5.0,<6.0 | Cliente de Redis |
| `pdfkit` | ≥1.0,<2.0 | Generación de PDFs |
| `pymetasploit3` | ≥1.0.3 | Cliente RPC de Metasploit |
| `python-Wappalyzer` | ≥0.3.1 | Detección de tecnologías web |
| `python-dotenv` | ≥1.0,<2.0 | Lectura de variables del `.env` |
| `pydantic` | ≥2.0,<3.0 | Validación de modelos de datos |
| `jinja2` | ≥3.1,<4.0 | Templates HTML para reportes |
| `docker` | ≥7.1.0 | Control de contenedores del laboratorio |
| `beautifulsoup4` | ≥4.12 | Parsing HTML (auto-login, Wappalyzer) |
| `gunicorn` | ≥21.2 | Servidor WSGI de producción |

### Herramientas instaladas en la imagen Docker

| Herramienta | Versión | Cómo se instala |
|---|---|---|
| Python | 3.11 | Imagen base |
| Go | 1.22.5 | Descargado manualmente desde `go.dev` |
| Nmap | sistema | `apt-get install nmap` |
| Patator | sistema | `apt-get install patator` |
| SQLMap | git | `git clone github.com/sqlmapproject/sqlmap` |
| Gobuster | go | `go install OJ/gobuster@v3.6.0` |
| ffuf | go | `go install ffuf/ffuf@v2.1.0` |
| Nuclei | go | `go install projectdiscovery/nuclei@v3.2.4` |
| Searchsploit | git | `git clone gitlab.com/exploit-database/exploitdb` |
| wkhtmltopdf | sistema | `apt-get install wkhtmltopdf xvfb` |
| SecLists | git | `git clone github.com/danielmiessler/SecLists` |
| Nuclei-templates | git | `git clone github.com/projectdiscovery/nuclei-templates` |

### Imágenes Docker de terceros

| Imagen | Versión | Servicio |
|---|---|---|
| `python:3.11-slim-bookworm` | 3.11 slim | Base del backend |
| `node:20-alpine` | 20 LTS | Base del frontend |
| `redis:7-alpine` | 7 | Base de datos de sesiones |
| `ghcr.io/zaproxy/zaproxy:stable` | stable | OWASP ZAP |
| `metasploitframework/metasploit-framework:latest` | latest | Metasploit |
| `bkimminich/juice-shop:v17.0.0` | 17.0.0 | Laboratorio Juice Shop |
| `ghcr.io/digininja/dvwa:latest` | latest | Laboratorio DVWA |
| `mariadb:10.11` | 10.11 | Base de datos de DVWA |
| `webgoat/webgoat:latest` | latest | Laboratorio WebGoat |

### Frontend Node.js (`package.json`)

| Paquete | Versión | ¿Para qué? |
|---|---|---|
| `next` | 16.2.9 | Framework React con enrutamiento |
| `react` | 19.2.7 | Librería de interfaz de usuario |
| `typescript` | 5.4 | Tipado estático |
| `tailwindcss` | 3.4 | Sistema de estilos |
| `@tanstack/react-query` | 5.28 | Peticiones HTTP y caché |
| `react-hook-form` | 7.51 | Manejo de formularios |
| `zod` | 3.22 | Validación de datos |
| `recharts` | 2.12 | Gráficos y visualizaciones |
| `lucide-react` | 0.400 | Iconos SVG |
| `sonner` | 1.4 | Notificaciones toast |
| `react-day-picker` | **8.10.1** | Selector de fechas (versión 8, API v9 es incompatible) |

---

*Documento actualizado a partir del código fuente real de SecureScan Pro v5.0.*
*Líneas de código verificadas: app.py (1.068) · orchestrator.py (1.234) · injection_scanner.py (1.720) · reporter.py (1.382) · scoring.py (565)*
*SENA — Programa Técnico en Seguridad de Aplicaciones Web — Colombia, Julio 2026*
