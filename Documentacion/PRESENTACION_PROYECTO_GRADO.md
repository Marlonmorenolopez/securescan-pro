# PRESENTACIÓN DEL PROYECTO DE GRADO
## SecureScan Pro v5.0 — Plataforma Automatizada de Análisis de Seguridad Web

**Aprendiz:** _(completar nombre)_
**Programa:** Técnico en Seguridad de Aplicaciones Web
**Institución:** SENA — Servicio Nacional de Aprendizaje (Colombia)
**Centro de Formación:** _(completar)_
**Ficha de Caracterización:** _(completar)_
**Instructor:** _(completar)_
**Fecha de Presentación:** Julio 2026

---

> 📋 **Instrucciones para el expositor:**
> Cada diapositiva incluye:
> - **Contenido de pantalla** → lo que verá el evaluador en la presentación
> - **🎤 Notas del orador** → lo que tú debes decir, en lenguaje natural y conversacional
>
> Tiempo total estimado: **25–30 minutos** + preguntas

---

## DIAPOSITIVA 1 — PORTADA

### Contenido de pantalla

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║           🛡️  SecureScan Pro v5.0                    ║
║                                                       ║
║   Plataforma Automatizada de Análisis de             ║
║         Seguridad Web                                 ║
║                                                       ║
║  ─────────────────────────────────────────────────   ║
║                                                       ║
║  Proyecto de Grado                                    ║
║  Técnico en Seguridad de Aplicaciones Web            ║
║  SENA — Colombia, 2026                                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

---

### 🎤 Notas del orador

> Buenos días / tardes a todos. Mi nombre es _(nombre)_ y hoy les voy a presentar mi proyecto de grado: **SecureScan Pro**, una plataforma que construí para automatizar el análisis de seguridad de aplicaciones web.
>
> En los próximos 25 minutos voy a explicarles el problema que resuelve, cómo funciona técnicamente y los resultados que obtuve. Al final hay tiempo para preguntas. Arranquemos.

---

## DIAPOSITIVA 2 — EL PROBLEMA

### Contenido de pantalla

**¿Cuánto tarda analizar la seguridad de una aplicación web manualmente?**

| Herramienta | Configurar | Ejecutar | Analizar resultados |
|---|---|---|---|
| Nmap | 5 min | 5 min | 10 min |
| OWASP ZAP | 15 min | 20 min | 30 min |
| Nuclei | 10 min | 15 min | 20 min |
| SQLMap | 10 min | 15 min | 15 min |
| Gobuster | 5 min | 10 min | 10 min |
| … (6 más) | … | … | … |
| **TOTAL** | **~1 hora** | **~2 horas** | **~3 horas** |

> ❌ **6 horas de trabajo manual, resultados dispersos, sin visión unificada**

---

### 🎤 Notas del orador

> Quiero empezar con una pregunta concreta. Cuando un analista de seguridad necesita evaluar una aplicación web, ¿cuánto tiempo le toma?
>
> Si miran esta tabla, solo para configurar y ejecutar las herramientas más comunes —Nmap, ZAP, Nuclei, SQLMap y algunas más— estamos hablando de 6 horas de trabajo manual. Y eso sin contar que los resultados llegan por separado: en un archivo XML, en otro JSON, en la interfaz de ZAP, en la terminal de SQLMap...
>
> Al final, el analista tiene que sentarse a unificar todo eso, compararlo, entender cuál vulnerabilidad es más grave y generar un reporte. Es un proceso lento, repetitivo y propenso a errores.
>
> Ese fue el problema que yo identifiqué en mi proceso de formación y que decidí resolver con este proyecto.

---

## DIAPOSITIVA 3 — LA BRECHA EDUCATIVA

### Contenido de pantalla

**En el programa del SENA aprendemos las herramientas de forma aislada:**

```
Semana 1:  Nmap          ──→ "Aprendo a escanear puertos"
Semana 3:  OWASP ZAP     ──→ "Aprendo DAST"
Semana 5:  SQLMap        ──→ "Aprendo SQL Injection"
Semana 7:  Nuclei        ──→ "Aprendo plantillas"
Semana 9:  Metasploit    ──→ "Aprendo exploits"
```

**Pero en el mundo real:**
```
Un pentest profesional usa TODAS a la vez,
en orden específico,
donde los resultados de una alimentan a la siguiente.
```

> 🎯 **Nadie enseña el flujo completo**

---

### 🎤 Notas del orador

> Hay un segundo problema, y este lo viví yo directamente como aprendiz del SENA.
>
> En el programa aprendemos las herramientas una por una, como si fueran materias separadas. Nmap en una semana, ZAP en otra, SQLMap después. Y cada una se enseña de forma independiente.
>
> Pero cuando uno ve cómo trabaja un profesional de seguridad real, se da cuenta de que el flujo es completamente diferente: primero identificas qué tecnologías usa el sitio, con esa información decides qué herramientas activar, los resultados de una herramienta le dan contexto a la siguiente, y al final todo se consolida en un reporte.
>
> Esa brecha —entre aprender herramientas aisladas y entender el flujo completo— es la segunda razón por la que construí SecureScan Pro.

---

## DIAPOSITIVA 4 — LA SOLUCIÓN

### Contenido de pantalla

**SecureScan Pro: un solo sistema, 11 herramientas, resultado completo**

```
     Ingresa una URL
          ↓
  ┌───────────────────────────────────────┐
  │   Pipeline automatizado de 11 pasos  │
  │                                       │
  │  🔍 Wappalyzer → 🗺️ Nmap            │
  │  → 🔑 Patator → 💣 Metasploit       │
  │  → 🔎 ffuf → 📂 Gobuster            │
  │  → 🕷️ ZAP → 🎯 Nuclei              │
  │  → 💉 InjectionScanner              │
  │  → 🔍 Searchsploit → 📊 Score       │
  └───────────────────────────────────────┘
          ↓
   Reporte en HTML, PDF, JSON o CSV
   con puntuación de seguridad
```

> ✅ **Un comando. Un resultado. Todo automatizado.**

---

### 🎤 Notas del orador

> La solución que propuse es SecureScan Pro: una plataforma que toma una URL, ejecuta 11 herramientas profesionales en el orden correcto de forma automática, y al final entrega un reporte completo con una puntuación de seguridad.
>
> El usuario no necesita saber cómo configurar cada herramienta por separado. Solo escribe la URL, selecciona qué herramientas activar, y el sistema hace todo el resto.
>
> En las siguientes diapositivas voy a explicar cómo funciona esto técnicamente.

---

## DIAPOSITIVA 5 — ARQUITECTURA EN 3 CAPAS

### Contenido de pantalla

```
┌─────────────────────────────────────────────────┐
│  🖥️  CAPA 3 — INTERFAZ                          │
│  Next.js 16 / React 19 / TypeScript             │
│  El usuario ve el progreso en tiempo real        │
└──────────────────────┬──────────────────────────┘
                       │ HTTP (puerto 5000)
┌──────────────────────▼──────────────────────────┐
│  ⚙️  CAPA 2 — BACKEND API                       │
│  Python 3.11 / Flask / Gunicorn                 │
│  Coordina todas las herramientas                │
│  Guarda resultados en Redis                     │
└──────────────────────┬──────────────────────────┘
                       │ Red Docker aislada
┌──────────────────────▼──────────────────────────┐
│  🧪  CAPA 1 — LABORATORIO                       │
│  DVWA · Juice Shop · WebGoat                    │
│  Completamente aislados de internet             │
└─────────────────────────────────────────────────┘
```

**10 contenedores Docker · 2 redes separadas · 7 volúmenes de datos**

---

### 🎤 Notas del orador

> El sistema está organizado en 3 capas. Déjenme explicar cada una brevemente.
>
> La capa de arriba es la interfaz web: la construí con Next.js y React, y es lo que el usuario ve en el navegador. Muestra el progreso del escaneo en tiempo real y los resultados cuando termina.
>
> La capa del medio es el backend, donde está toda la inteligencia. Está hecho en Python con Flask, y es el que coordina las 11 herramientas, guarda los resultados en Redis y expone la API que usa el frontend.
>
> Y la capa de abajo son los laboratorios: tres aplicaciones web deliberadamente vulnerables que uso como targets de práctica. Están completamente aisladas de internet por seguridad.
>
> Todo el sistema corre en 10 contenedores Docker que arrancan con un solo comando.

---

## DIAPOSITIVA 6 — EL PIPELINE DE 11 PASOS

### Contenido de pantalla

```
🔐 Auto-login → obtiene cookie de sesión

Paso 1  🔍 Wappalyzer    ← ¿Qué tecnologías usa el sitio?
Paso 2  🗺️ Nmap          ← ¿Qué puertos están abiertos?
Paso 3  🔑 Patator       ← ¿Hay contraseñas débiles?
Paso 4  💣 Metasploit    ← ¿Qué módulos aplican?
Paso 5  🔎 ffuf          ← ¿Hay rutas ocultas?
Paso 6  📂 Gobuster      ← ¿Qué directorios existen?
Paso 7  🕷️ ZAP           ← Escaneo DAST completo
Paso 8  🎯 Nuclei        ← ¿Hay CVEs conocidos?
Paso 9  💉 InjectionScan ← 10 técnicas de inyección
Paso 10 🔍 Searchsploit  ← ¿Hay exploits públicos?
Paso 11 📊 Scoring       ← Puntuación final (0-100)
```

> **Cada herramienta alimenta a la siguiente con sus resultados**

---

### 🎤 Notas del orador

> Este es el corazón del sistema: el pipeline de 11 pasos.
>
> Antes de empezar, el sistema se autentica automáticamente en el laboratorio objetivo, porque sin eso las herramientas solo verían las páginas públicas y se perderían el 80% de las vulnerabilidades.
>
> Luego los pasos van en orden específico por una razón: el Paso 1, Wappalyzer, detecta qué tecnologías usa el sitio. Con esa información, el Paso 4 —Metasploit— sabe qué módulos ejecutar, y el Paso 8 —Nuclei— sabe qué plantillas de vulnerabilidades aplicar. Si invirtieras el orden, esas herramientas trabajarían "a ciegas".
>
> El otro detalle importante es que la cookie de sesión que se obtiene al inicio se comparte con todas las herramientas de los pasos 5 al 9. Eso garantiza que ZAP, Nuclei y el InjectionScanner vean la aplicación como un usuario autenticado, no como un visitante anónimo.

---

## DIAPOSITIVA 7 — EL MÓDULO PROPIO: INJECTIONSCANNER

### Contenido de pantalla

**El módulo más extenso del proyecto: 1.720 líneas de Python, 0 dependencias externas**

| # | Técnica de inyección | Subtipos |
|---|---|---|
| 1 | SQL Injection | Error-based, UNION, Boolean-Blind, Time-Blind, Auth-Bypass |
| 2 | NoSQL Injection | MongoDB `$gt`, `$ne`, regex bypass |
| 3 | XPath Injection | Auth bypass, error-based |
| 4 | XXE (XML) | File read, OOB, Blind XXE |
| 5 | XSS | Reflected, Stored, DOM-based |
| 6 | Command Injection | `;`, `\|`, `` ` ``, `&&` |
| 7 | Path Traversal | LFI, `../../../etc/passwd` |
| 8 | SSRF | Hosts internos, bypass CORS |
| 9 | SSTI | Jinja2 `{{7*7}}`, Twig, Freemarker |
| 10 | LDAP Injection | Filter bypass |

> **27 subtipos de detección — 100% código original**

---

### 🎤 Notas del orador

> Este es el módulo que yo desarrollé desde cero: el InjectionScanner.
>
> La razón por la que lo desarrollé es que ninguna herramienta disponible cubría las 10 técnicas de inyección de forma integrada y compatible con el pipeline que yo había diseñado.
>
> Con 1.720 líneas de Python, es el módulo más extenso de todo el proyecto. Cubre desde las inyecciones clásicas como SQL y XSS, hasta técnicas más avanzadas como SSTI —Server-Side Template Injection— que afecta a motores de plantillas como Jinja2, o SSRF, que fuerza al servidor a hacer peticiones hacia recursos internos.
>
> Cada hallazgo que detecta incluye la URL afectada, el parámetro vulnerable, el payload exacto que demuestra la vulnerabilidad, la evidencia de la respuesta del servidor, la severidad y el código CWE correspondiente.

---

## DIAPOSITIVA 8 — LOS LABORATORIOS

### Contenido de pantalla

**3 aplicaciones vulnerables incluidas — sin necesidad de internet — 100% legales**

| Lab | URL | Stack | Vulnerabilidades |
|---|---|---|---|
| 🍊 **Juice Shop** | :3001 | Node.js / Angular | OWASP Top 10 2021 completo |
| 💀 **DVWA** | :3002 | PHP / MariaDB | SQLi, XSS, Brute Force, Upload |
| 🐐 **WebGoat** | :3003 | Java Spring Boot | Lecciones interactivas OWASP |

**Completamente aislados en red Docker `lab-net` (172.21.0.0/16)**
- ❌ Sin acceso a internet
- ❌ Sin comunicación con la infraestructura principal
- ✅ Diseñados específicamente para ser atacados

---

### 🎤 Notas del orador

> Una parte fundamental del proyecto son los laboratorios. Muchos aprendices de ciberseguridad enfrentan el problema de que no tienen sobre qué practicar de forma legal.
>
> SecureScan Pro incluye tres aplicaciones vulnerables que arrancan junto con el sistema. Las tres son proyectos de código abierto mantenidos por OWASP, con licencia MIT o GPL, y fueron creados exactamente para este propósito: ser atacados en un entorno controlado.
>
> Juice Shop es la más moderna y completa: simula una tienda en línea con más de 100 vulnerabilidades del OWASP Top 10 2021. DVWA es el clásico de PHP que se usa en universidades y programas de seguridad de todo el mundo. Y WebGoat es la plataforma Java de aprendizaje interactivo de OWASP.
>
> Los tres están aislados en una red Docker separada, sin acceso a internet, así que no representan ningún riesgo de seguridad para la máquina que los corre.

---

## DIAPOSITIVA 9 — EL AUTO-LOGIN: UN DESAFÍO TÉCNICO REAL

### Contenido de pantalla

**Problema:** sin sesión autenticada, las herramientas ven solo las páginas públicas

**Solución: auto-login específico por laboratorio**

```
DVWA (4 peticiones con CSRF):
  GET  /login.php              → extrae CSRF token
  POST /login.php + token      → obtiene PHPSESSID
  GET  /security.php           → extrae nuevo CSRF token
  POST /security.php + token   → fuerza security=low ✅

Juice Shop (1 petición REST):
  POST /rest/user/login        → obtiene JWT token ✅

WebGoat (2 peticiones Spring):
  GET  /WebGoat/login          → obtiene cookie inicial
  POST /WebGoat/login          → obtiene JSESSIONID ✅
```

> **Cookie propagada a todos los pasos del pipeline**

---

### 🎤 Notas del orador

> Quiero hablar de un desafío técnico concreto que resolví porque ilustra bien el tipo de problemas que aparecen cuando uno construye algo de verdad.
>
> Para que las herramientas del pipeline puedan analizar las partes autenticadas de cada laboratorio, necesitan una cookie de sesión válida. Obtenerla automáticamente suena simple, pero cada laboratorio tiene un mecanismo de login diferente.
>
> DVWA fue el más complejo: tiene un token CSRF que cambia en cada petición, y además hay que hacer un segundo login en la página de configuración de seguridad para forzar el nivel a "low". Sin ese segundo paso, DVWA mantiene el nivel "impossible" silenciosamente y SQLMap y Nuclei no pueden detectar nada.
>
> Juice Shop usa una API REST con JWT. WebGoat usa Spring Security de Java. Cada uno requiere su propio flujo de autenticación.
>
> Una vez obtenida, la cookie se pasa automáticamente a todas las herramientas de los pasos 3 al 9.

---

## DIAPOSITIVA 10 — EL SISTEMA DE PUNTUACIÓN

### Contenido de pantalla

**Puntuación de 0 a 100 basada en hallazgos reales**

```
Inicio: 100 puntos

Por cada hallazgo encontrado:
  Crítico  → -20 pts    Alto    → -10 pts
  Medio    →  -5 pts    Bajo    →  -2 pts
  Info     → -0.5 pts

Penalizaciones adicionales:
  Exploit público para un hallazgo  → -8 pts extra
  Credenciales débiles encontradas  → -10 pts extra
```

| Puntuación | Calificación | Riesgo |
|---|---|---|
| 90 - 100 | A / A+ | BAJO |
| 70 - 89 | B / B+ | MEDIO |
| 50 - 69 | C / D | ALTO |
| 0 - 49 | F | CRÍTICO |

> **+ Recomendaciones priorizadas automáticas**

---

### 🎤 Notas del orador

> Al terminar el escaneo, el sistema calcula automáticamente una puntuación de 0 a 100.
>
> El algoritmo parte de 100 puntos y va descontando según los hallazgos: cada vulnerabilidad crítica quita 20 puntos, una alta quita 10, y así. Si además existe un exploit público en ExploitDB para esa vulnerabilidad, le agrega una penalización extra de 8 puntos, porque significa que cualquiera puede descargar el exploit y usarlo.
>
> La escala va de A+ para sistemas bien configurados, hasta F para sistemas con vulnerabilidades graves sin remediar.
>
> Y junto con la puntuación, el sistema genera recomendaciones automáticas ordenadas por prioridad: qué hay que corregir urgentemente, qué se puede dejar para los próximos 30 días, y qué para los próximos 90. Esto simula exactamente el tipo de reporte ejecutivo que un analista entregaría a un cliente.

---

## DIAPOSITIVA 11 — MÉTRICAS DEL PROYECTO

### Contenido de pantalla

**Lo que se construyó — en números**

| Categoría | Cantidad |
|---|---|
| 📝 Líneas de código Python (backend) | **11.290** |
| 📝 Líneas de código TypeScript (frontend) | **~12.612** |
| 📝 **Total de líneas de código** | **~23.902** |
| 🔧 Herramientas de seguridad integradas | **11** |
| 🐳 Servicios Docker | **10** |
| 🧪 Laboratorios vulnerables incluidos | **3** |
| 💉 Técnicas de inyección (módulo propio) | **10 (27 subtipos)** |
| 📄 Formatos de reporte | **4 (HTML, PDF, JSON, CSV)** |
| 🐛 Bugs documentados y resueltos | **35+** |
| 📚 Documentos técnicos producidos | **5** |

---

### 🎤 Notas del orador

> Quiero mostrar algunas métricas concretas del proyecto, porque creo que hablan por sí solas.
>
> El sistema tiene casi 24.000 líneas de código en total: más de 11.000 en Python para el backend y sus módulos de seguridad, y más de 12.000 en TypeScript para toda la interfaz de usuario.
>
> Integra 11 herramientas de seguridad reales —las mismas que usan los profesionales en la industria— dentro de 10 contenedores Docker.
>
> El dato que a mí más me enorgullece es el de los bugs: más de 35 errores documentados y resueltos. Porque eso no es un número negativo, es la evidencia de que el sistema fue construido y probado de verdad, no solo diseñado en papel. Cada bug resuelto enseñó algo concreto sobre cómo funcionan estas herramientas.

---

## DIAPOSITIVA 12 — DEMOSTRACIÓN EN VIVO

### Contenido de pantalla

**Flujo de demostración — DVWA completo**

```
1. Abrir http://localhost:3000

2. Seleccionar target: DVWA (http://dvwa:80)

3. Activar todas las herramientas

4. Hacer clic en "Iniciar Escaneo"

5. Observar el progreso en tiempo real:
   Paso 1: Wappalyzer → PHP 8.x, Apache 2.4
   Paso 2: Nmap → Puerto 80 abierto
   Paso 3: Patator → admin/password ✅
   ...
   Paso 11: Score → ~45/100 (D)

6. Descargar reporte HTML
```

> ⏱️ **Duración estimada del escaneo completo: 25–35 minutos**
> *(Para la demo en vivo se puede usar un escaneo previo guardado)*

---

### 🎤 Notas del orador

> Ahora voy a hacer una demostración en vivo del sistema. *(abrir el navegador en http://localhost:3000)*
>
> Lo que van a ver es la interfaz principal. Aquí selecciono DVWA como objetivo, activo todas las herramientas del pipeline, y le doy a "Iniciar Escaneo".
>
> *(iniciar el escaneo)*
>
> Pueden ver cómo va avanzando en tiempo real: cada paso se va marcando con su estado. El Paso 1 ya detectó que DVWA usa PHP y Apache. El Paso 3 encontró las credenciales admin/password. Eso es exactamente lo que se esperaría de una aplicación deliberadamente vulnerable.
>
> *(si el tiempo no permite esperar el escaneo completo, mostrar resultados guardados)*
>
> Aquí tienen el resultado de un escaneo anterior completo. Obtuvimos una puntuación de 45/100, grado D. El dashboard muestra las vulnerabilidades por severidad, las tecnologías detectadas, los directorios encontrados, y las recomendaciones priorizadas. Y con este botón descargo el reporte en HTML o PDF.

---

## DIAPOSITIVA 13 — RESULTADOS OBTENIDOS

### Contenido de pantalla

**Escaneo completo sobre DVWA — Resultados reales**

| Herramienta | Hallazgos |
|---|---|
| Wappalyzer | PHP 8.x, Apache 2.4, MariaDB 10.11, jQuery |
| Nmap | Puerto 80 (Apache httpd) |
| Patator | ✅ `admin` / `password` encontrado |
| Metasploit | HTTP version, robots.txt, métodos HTTP |
| ffuf + Gobuster | 50+ endpoints, `/vulnerabilities/`, `/dvwa/` |
| OWASP ZAP | 15–25 alertas: SQLi, XSS, CSRF, headers |
| Nuclei | 5–10: PHP version exposed, default-login |
| InjectionScanner | SQLi en `/sqli/?id=`, XSS en `/xss_r/?name=` |
| Searchsploit | 3–5 exploits para Apache y PHP detectados |

**Puntuación final: ~45/100 · Grado D · Riesgo ALTO**

> El mismo resultado que obtendría un profesional con 6 horas de trabajo manual — en 30 minutos

---

### 🎤 Notas del orador

> Esta tabla muestra los resultados reales de un escaneo completo sobre DVWA.
>
> Wappalyzer identificó el stack completo: PHP, Apache, MariaDB y jQuery con sus versiones. Nmap confirmó el puerto 80. Patator encontró las credenciales débiles de admin. ZAP detectó entre 15 y 25 alertas de seguridad incluyendo SQL Injection, XSS y problemas con cabeceras HTTP. El InjectionScanner confirmó la SQLi en el módulo `/sqli/` y XSS en el módulo `/xss_r/`. Y Searchsploit encontró exploits públicos para las versiones de Apache y PHP detectadas.
>
> El resultado final es 45 sobre 100, grado D, riesgo alto. Exactamente lo que se esperaría de una aplicación con vulnerabilidades del nivel "low" de DVWA.
>
> Y la parte que quiero destacar: este resultado que antes tomaba 6 horas de trabajo manual ahora toma 30 minutos automatizados.

---

## DIAPOSITIVA 14 — ÉTICA Y LEGALIDAD

### Contenido de pantalla

**La ética no es solo una política — está programada en el código**

**Controles técnicos verificables:**

| Control | Implementación |
|---|---|
| 🚫 Validación de targets | Bloquea IPs de loopback (`127.0.0.1`, `0.0.0.0`) |
| 🔒 Modo laboratorio estricto | `RESTRICT_TO_LAB_TARGETS=true` → solo los 3 labs |
| 🛡️ Metasploit solo auxiliar | Solo `auxiliary/scanner/` — sin exploits ni payloads |
| 🔐 Autenticación API | Token requerido para iniciar cualquier escaneo |
| 📊 Rate Limiting | Máximo 20 escaneos por hora por IP |
| 🏠 Aislamiento de red | Labs en `lab-net` sin acceso a internet |
| 👤 Usuarios no-root | Contenedores corren como `scanner` y `nextjs` |

**Marco legal: Ley 1273 de 2009 — Art. 269A**
> Solo escanear sistemas con autorización expresa

---

### 🎤 Notas del orador

> Antes de cerrar, quiero hablar de ética porque es un tema central en seguridad informática.
>
> Cuando uno construye una herramienta de análisis de seguridad, la pregunta inmediata es: ¿no se puede usar para atacar sistemas? La respuesta es que en SecureScan Pro la ética no es solo un párrafo en el manual: está programada en el sistema y se puede verificar línea por línea en el código.
>
> Por ejemplo, el sistema bloquea por defecto ciertos targets. El modo estricto restringe el sistema exclusivamente a los tres laboratorios incluidos. Metasploit solo ejecuta módulos auxiliares de verificación, nunca exploits que comprometan el sistema objetivo. Los contenedores corren con usuarios sin privilegios.
>
> Y en cuanto al marco legal, en Colombia el artículo 269A de la Ley 1273 de 2009 establece que acceder a un sistema informático sin autorización es un delito. SecureScan Pro fue diseñado para operar exclusivamente sobre los laboratorios incluidos, que son aplicaciones de código abierto creadas específicamente para este fin.

---

## DIAPOSITIVA 15 — COMPETENCIAS DEMOSTRADAS

### Contenido de pantalla

**Mapa directo al programa del SENA**

| Competencia del programa | Evidencia en SecureScan Pro |
|---|---|
| Identificar vulnerabilidades web | ZAP, Nuclei, InjectionScanner, SQLMap |
| Aplicar herramientas profesionales | 11 herramientas reales en producción |
| Realizar pentests controlados | Metasploit auxiliar + Patator + InjectionScanner |
| Documentar hallazgos | 4 formatos de reporte: HTML, PDF, JSON, CSV |
| Implementar seguridad | Headers HTTP, validación de tokens, CORS |
| Aplicar metodologías OWASP/PTES | Pipeline alineado con OWASP Testing Guide v4.2 |
| Desarrollar aplicaciones full-stack | Flask + Next.js + 11 módulos Python |
| Trabajar con Docker | 10 servicios, 2 redes, 7 volúmenes |
| Comunicar riesgos de seguridad | Scoring 0-100 + recomendaciones priorizadas |

---

### 🎤 Notas del orador

> Esta tabla muestra directamente cómo SecureScan Pro evidencia las competencias del programa técnico del SENA.
>
> No es un proyecto teórico. Cada fila de esta tabla tiene un archivo de código fuente concreto que la respalda. La competencia de "identificar vulnerabilidades web" está respaldada por los módulos ZAP, Nuclei e InjectionScanner. La de "documentar hallazgos" está respaldada por el archivo `reporter.py` que genera los cuatro formatos de reporte.
>
> Lo que quiero transmitir con esto es que las competencias del programa no fueron aprendidas de forma separada y luego olvidadas: fueron aplicadas todas juntas en un proyecto real y funcional.

---

## DIAPOSITIVA 16 — DESAFÍOS Y APRENDIZAJES

### Contenido de pantalla

**Los 5 problemas técnicos más importantes que resolví**

| Problema | Causa | Solución |
|---|---|---|
| DVWA siempre en modo "impossible" | Faltaba el CSRF token de `security.php` | 4 peticiones secuenciales con extracción de token |
| Escaneos que se cuelgan indefinidamente | `signal.SIGALRM` no funciona en threads | Timeout con `threading.Event` |
| Pipeline se detiene si falla una herramienta | Sin manejo de errores por paso | Circuit Breaker + try/except por herramienta |
| Reporte HTML ejecuta payloads XSS | Evidencias sin sanitizar en HTML | `html.escape()` en todo el contenido externo |
| `SyntaxError` en Python 3.11 | `\` dentro de expresiones f-string | Variables intermedias para la cadena |

> **35+ bugs documentados y resueltos durante el desarrollo**

---

### 🎤 Notas del orador

> Ningún proyecto real sale perfecto a la primera, y este no fue la excepción. Quiero hablar de los cinco problemas más importantes que encontré y cómo los resolví, porque creo que eso muestra el aprendizaje real del proyecto.
>
> El primero fue con DVWA: el sistema lanzaba escaneos pero los resultados siempre estaban vacíos. Después de varios días de debugging, descubrí que DVWA requiere un token CSRF específico de la página `security.php` para aceptar el cambio de nivel de seguridad. Sin ese token, DVWA mantiene el nivel "impossible" silenciosamente. La solución fue implementar cuatro peticiones secuenciales con extracción automática del token.
>
> El segundo fue con los timeouts: al implementar timeouts con `signal.SIGALRM` de Python, los escaneos colapsaban porque esa señal no funciona dentro de threads. La solución correcta fue usar `threading.Event`, que sí es compatible con la arquitectura multi-hilo.
>
> El tercero me sorprendió: si el reporte HTML incluye un payload XSS como evidencia sin sanitizar, ese payload se ejecuta cuando el analista abre el reporte en el navegador. La solución fue aplicar `html.escape()` a todo el contenido externo.
>
> Cada uno de estos problemas me enseñó algo que no está en ningún libro de texto.

---

## DIAPOSITIVA 17 — TRABAJO FUTURO

### Contenido de pantalla

**Lo que sigue — v6.0 y más allá**

| Mejora | Impacto esperado |
|---|---|
| 👥 Soporte multi-usuario con roles | Uso en clases con múltiples aprendices |
| 🔍 Análisis estático (SAST) | Ciclo completo DAST + SAST |
| 📋 Exportación a JIRA / GitHub Issues | Integración con flujos DevSecOps reales |
| 📖 API pública documentada (Swagger) | Integración con otras herramientas |
| 🎓 Modo "guía de aprendizaje" | Explicación de cada vulnerabilidad encontrada |
| 🌐 Soporte para APIs GraphQL | Cubre tecnologías modernas |

**El sistema ya es funcional y extensible — la arquitectura lo permite**

---

### 🎤 Notas del orador

> SecureScan Pro v5.0 está completo y funcional, pero hay varias mejoras que me gustaría implementar en el futuro.
>
> La más importante para el contexto educativo es el soporte multi-usuario: actualmente el sistema está diseñado para un solo operador a la vez. Si se quisiera usar en una clase con 20 aprendices simultáneamente, haría falta un sistema de autenticación con roles.
>
> Otra mejora relevante sería añadir análisis estático de código, lo que completaría el ciclo completo de evaluación de seguridad: DAST más SAST.
>
> Y el modo "guía de aprendizaje" sería especialmente útil para el contexto del SENA: que al encontrar una vulnerabilidad, el sistema explique qué es, por qué es peligrosa y cómo se remedia, de forma didáctica.
>
> La arquitectura modular que tiene el sistema ahora facilita añadir cualquiera de estas funcionalidades sin tener que reescribir lo que ya existe.

---

## DIAPOSITIVA 18 — CONCLUSIONES

### Contenido de pantalla

**Tres conclusiones principales**

**1. El pipeline resuelve el problema real**
> 6 horas manuales → 30 minutos automatizados
> Resultado equivalente, reproducible y documentado

**2. El InjectionScanner es la aportación más original**
> 1.720 líneas · 10 técnicas · 27 subtipos
> 100% desarrollado para este proyecto

**3. Los bugs resueltos son el aprendizaje real**
> 35+ problemas concretos documentados y solucionados
> Cada uno enseñó algo que no está en ningún manual

> **SecureScan Pro demuestra que un aprendiz del SENA puede construir herramientas de nivel profesional**

---

### 🎤 Notas del orador

> Para cerrar, quiero dejar tres conclusiones concretas.
>
> Primera: el objetivo central del proyecto se cumplió. Lo que antes tomaba 6 horas de trabajo manual ahora toma 30 minutos, con un resultado equivalente, reproducible y en un formato que cualquier persona puede leer.
>
> Segunda: el módulo InjectionScanner es la contribución más original porque no fue integrar una herramienta existente, sino construir una desde cero. 1.720 líneas de Python, 10 técnicas, 27 subtipos de detección.
>
> Tercera, y para mí la más importante: los más de 35 bugs que documenté y resolví durante el desarrollo son el verdadero aprendizaje del proyecto. Cada error me obligó a entender en profundidad cómo funciona cada herramienta, cómo se comunican los contenedores Docker, cómo maneja Python los threads, cómo funcionan los tokens CSRF. Ese conocimiento no se aprende en un libro.
>
> SecureScan Pro es la demostración de que con las competencias del programa técnico del SENA, es posible construir herramientas de nivel profesional.

---

## DIAPOSITIVA 19 — PREGUNTAS

### Contenido de pantalla

```
╔══════════════════════════════════════════════╗
║                                              ║
║            ¿Preguntas?                       ║
║                                              ║
║  Recursos del proyecto:                      ║
║                                              ║
║  📦 Repositorio:                             ║
║     github.com/Marlonmorenolopez/SecureScan  ║
║                                              ║
║  📄 Documentación:                           ║
║     Carpeta /Documentacion/ en el ZIP        ║
║                                              ║
║  🛠️  Arrancar el sistema:                    ║
║     git clone <repo>                         ║
║     cp .env.example .env                     ║
║     bash start.sh                            ║
║                                              ║
╚══════════════════════════════════════════════╝
```

---

### 🎤 Notas del orador

> Muchas gracias por su atención. Quedo disponible para cualquier pregunta técnica sobre el proyecto.
>
> Si alguien quiere probar el sistema, el repositorio está en GitHub con el código completo. Con tres comandos —clonar, copiar el .env y ejecutar start.sh— el sistema arranca completamente, incluyendo los tres laboratorios.
>
> La carpeta `/Documentacion/` dentro del proyecto incluye cinco documentos técnicos: la documentación técnica completa, la guía de despliegue paso a paso, el marco ético y legal, y esta misma presentación.

---

## PREGUNTAS FRECUENTES DEL EVALUADOR

> Esta sección no va en la presentación. Es solo para que te prepares con respuestas a las preguntas más comunes de los evaluadores.

---

**P: ¿Por qué Python para el backend y no Node.js o Java?**
> Python es el lenguaje estándar en seguridad ofensiva y tiene las mejores librerías para integrar herramientas de seguridad: `pymetasploit3` para Metasploit, `python-Wappalyzer` para fingerprinting, `pdfkit` para reportes. Además, las herramientas Go como Nuclei y Gobuster se controlan vía subproceso, lo que funciona igual en cualquier lenguaje.

---

**P: ¿Qué pasa si alguien usa SecureScan Pro para atacar sistemas reales?**
> El sistema implementa controles técnicos que dificultan ese uso: la API bloquea IPs de loopback, el modo restrictivo solo permite los tres laboratorios, y el rate limiting limita a 20 escaneos por hora. Cualquier uso fuera del laboratorio educativo requiere modificar deliberadamente el código, lo cual es responsabilidad legal exclusiva del operador bajo la Ley 1273 de 2009.

---

**P: ¿Cómo se diferencia de simplemente instalar ZAP o Nuclei por separado?**
> La diferencia es el pipeline: la integración donde los resultados de cada herramienta alimentan a las siguientes. Wappalyzer determina qué módulos de Nuclei usar. Las URLs de Gobuster se inyectan en ZAP antes del escaneo activo. La cookie de sesión de Patator se comparte con todas las herramientas. Eso no se obtiene instalando las herramientas por separado.

---

**P: ¿Por qué Next.js 16 y no Angular o Vue?**
> Next.js es el framework React más adoptado en la industria SaaS de seguridad. Plataformas como Snyk y Semgrep lo usan. El App Router de Next.js facilita el Server-Side Rendering y el polling en tiempo real que necesita el dashboard. Además, el ecosistema de componentes Shadcn/ui acelera significativamente el desarrollo de interfaces profesionales.

---

**P: ¿Cuánto tiempo tomó desarrollar el proyecto?**
> El desarrollo se extendió a lo largo del programa formativo. La fase de mayor intensidad fue la integración del pipeline completo y la resolución de los más de 35 bugs documentados. Cada corrección técnica quedó documentada en el historial de desarrollo.

---

**P: ¿El sistema funciona sobre aplicaciones web reales de internet?**
> Técnicamente puede hacerlo si se modifica la variable `RESTRICT_TO_LAB_TARGETS=false` y el target es alcanzable desde la red. Pero hacerlo sin autorización del propietario es un delito bajo la Ley 1273 de 2009, Art. 269A. El sistema fue diseñado y probado exclusivamente sobre los tres laboratorios incluidos.

---

**P: ¿Metasploit no es una herramienta ilegal o peligrosa?**
> Metasploit Framework es una herramienta de código abierto con licencia BSD, usada legítimamente por miles de profesionales de seguridad en todo el mundo cada día. En SecureScan Pro solo se ejecutan módulos `auxiliary/scanner/`, que son de verificación y no comprometen ningún sistema. La diferencia entre una herramienta de diagnóstico y un arma es la autorización y la intención.

---

**P: ¿Qué harías diferente si empezaras de nuevo?**
> Implementaría el sistema de timeout con `threading.Event` desde el principio en lugar de intentar primero con `signal.SIGALRM`. También separaría los tipos TypeScript del `RiskLevel` en un archivo dedicado desde el inicio para evitar la propagación de cambios cuando se actualiza el sistema de puntuación. Y documentaría cada decisión de diseño desde el primer commit en lugar de al final.

---

*Presentación desarrollada como parte del Proyecto de Grado.*
*SENA — Programa Técnico en Seguridad de Aplicaciones Web — Colombia, Julio 2026*
*SecureScan Pro v5.0 — 23.902 líneas · 11 herramientas · 10 contenedores Docker*
