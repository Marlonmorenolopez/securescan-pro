# ÉTICA Y LEGALIDAD EN EL USO DE SECURESCAN PRO
## Marco Ético, Legal y de Uso Responsable

**Proyecto:** SecureScan Pro v5.0 — Plataforma Automatizada de Análisis de Seguridad Web
**Autor:** Técnico en Seguridad de Aplicaciones Web
**Institución:** SENA — Servicio Nacional de Aprendizaje (Colombia)
**Programa:** Técnico en Seguridad de Aplicaciones Web
**Fecha de actualización:** Julio 2026

---

> ⚠️ **Aviso importante:** Este documento no es una formalidad. Es parte esencial del proyecto. Las salvaguardas éticas y legales de SecureScan Pro no son solo políticas escritas: están programadas directamente en el código fuente y pueden verificarse línea por línea. Este documento explica el **por qué** de cada una de esas decisiones de diseño.

---

## TABLA DE CONTENIDOS

1. [Declaración de Principios Éticos](#1-declaración-de-principios-éticos)
2. [Marco Legal en Colombia](#2-marco-legal-en-colombia)
3. [Marco Legal Internacional de Referencia](#3-marco-legal-internacional-de-referencia)
4. [Controles Técnicos de Seguridad Ética en el Código](#4-controles-técnicos-de-seguridad-ética-en-el-código)
5. [Uso Autorizado y Uso No Autorizado](#5-uso-autorizado-y-uso-no-autorizado)
6. [Los Tres Laboratorios — Por Qué Son Legales y Seguros](#6-los-tres-laboratorios--por-qué-son-legales-y-seguros)
7. [Metasploit en Modo Auxiliar — Distinción Técnica y Ética](#7-metasploit-en-modo-auxiliar--distinción-técnica-y-ética)
8. [Responsabilidades del Operador](#8-responsabilidades-del-operador)
9. [Privacidad y Protección de Datos de los Reportes](#9-privacidad-y-protección-de-datos-de-los-reportes)
10. [Principio de Divulgación Responsable](#10-principio-de-divulgación-responsable)
11. [Alineación con Estándares Internacionales de Ética](#11-alineación-con-estándares-internacionales-de-ética)
12. [Preguntas Frecuentes sobre Ética y Legalidad](#12-preguntas-frecuentes-sobre-ética-y-legalidad)
13. [Declaración de Uso Educativo y Compromiso de Responsabilidad](#13-declaración-de-uso-educativo-y-compromiso-de-responsabilidad)
14. [Referencias Legales y Normativas](#14-referencias-legales-y-normativas)

---

## 1. DECLARACIÓN DE PRINCIPIOS ÉTICOS

SecureScan Pro fue diseñado desde su concepción con la **ética como principio de diseño**, no como complemento tardío. Esto significa que las salvaguardas éticas no son simplemente un capítulo del manual: están codificadas en el sistema y no pueden desactivarse sin modificar deliberadamente el código fuente.

A continuación se presentan los siete principios que guiaron cada decisión técnica del proyecto.

---

### Principio 1 — Autorización previa y expresa

**Ningún análisis de seguridad es legal ni ético sin autorización del propietario del sistema.**

Esto aplica sin excepción, independientemente de la intención del analista, del tipo de sistema o de si la información del sistema es "pública". La autorización debe ser expresa (idealmente por escrito) y previa al inicio de cualquier actividad.

> **Implementación en el código:** El sistema valida cada target contra una lista de patrones prohibidos y una lista explícita de laboratorios permitidos (`ALLOWED_LAB_TARGETS`). Si el entorno está configurado en modo estricto (`RESTRICT_TO_LAB_TARGETS=true`), la API rechaza con `403 Forbidden` cualquier target que no sea uno de los tres laboratorios incluidos.

---

### Principio 2 — Proporcionalidad

**Las técnicas utilizadas deben ser proporcionales al objetivo de la evaluación.**

SecureScan Pro verifica si las vulnerabilidades existen; no las explota para obtener acceso ni causa daño en el sistema objetivo. La diferencia entre un escáner de seguridad y un arma cibernética reside en este límite.

> **Implementación en el código:** Metasploit solo ejecuta módulos del tipo `auxiliary/scanner/` (verificación). Nunca ejecuta módulos `exploits/`, `post/` (post-explotación) ni carga `payloads/` (código malicioso).

---

### Principio 3 — Mínimo privilegio

**El sistema opera con los permisos mínimos necesarios para cumplir su función.**

Ningún contenedor corre como usuario `root`. La API no tiene acceso completo al sistema operativo del host. Redis y SQLMap solo aceptan conexiones desde `localhost`.

> **Implementación en el código:** El usuario `scanner` (no-root) ejecuta Flask/Gunicorn. La directiva `no-new-privileges: true` en Docker impide cualquier escalada de privilegios. Solo los permisos estrictamente necesarios para nmap (`NET_RAW`, `NET_ADMIN`) están habilitados.

---

### Principio 4 — Confinamiento

**Los laboratorios vulnerables están aislados. No tienen acceso a internet ni a sistemas externos.**

Un entorno de práctica seguro requiere que las aplicaciones vulnerables no puedan ser alcanzadas desde redes externas ni puedan comunicarse con sistemas reales.

> **Implementación en el código:** DVWA, Juice Shop y WebGoat solo existen en la red Docker `lab-net` (`172.21.0.0/16`). No tienen acceso a `securescan-net` ni a internet. Un atacante que comprometa uno de los labs no puede pivotar hacia la infraestructura principal.

---

### Principio 5 — Trazabilidad

**Toda actividad del sistema queda registrada.**

La trazabilidad permite auditar quién inició un escaneo, sobre qué objetivo, cuándo y con qué resultado. Es el mecanismo que hace posible la rendición de cuentas.

> **Implementación en el código:** Cada petición queda en los logs de Flask/Gunicorn con timestamp, IP del solicitante, endpoint y código de respuesta. Los intentos de acceso no autorizado (`401`) se registran con advertencia explícita. Cada escaneo tiene un ID único UUID v4 y timestamps de inicio y fin.

---

### Principio 6 — Divulgación responsable

**Si se descubren vulnerabilidades reales, deben reportarse al propietario antes de cualquier divulgación pública.**

Publicar una vulnerabilidad sin dar tiempo al propietario para corregirla no es ético y puede ser ilegal. El proceso de Responsible Disclosure equilibra el interés público en conocer las vulnerabilidades con el derecho del propietario a proteger su sistema.

> **Ver Sección 10** para el proceso detallado paso a paso.

---

### Principio 7 — Propósito educativo

**Este sistema fue creado para aprender a defender, no para atacar.**

Comprender cómo piensan y actúan los atacantes es indispensable para construir defensas efectivas. SecureScan Pro hace visible y comprensible el proceso de análisis de seguridad, convirtiendo herramientas complejas de la industria en un entorno de aprendizaje estructurado.

---

## 2. MARCO LEGAL EN COLOMBIA

### 2.1 Ley 1273 de 2009 — Delitos Informáticos

La **Ley 1273 de 2009** ("Por medio de la cual se modifica el Código Penal, se crea un nuevo bien jurídico tutelado denominado 'de la protección de la información y de los datos'") es la norma principal que regula los delitos informáticos en Colombia. Entrar en vigor el 5 de enero de 2009, fue la primera ley colombiana en tipificar específicamente los crímenes en el entorno digital.

**Artículos más relevantes para el uso de herramientas de seguridad:**

| Artículo | ¿Qué prohíbe? | Pena máxima |
|---|---|---|
| **Art. 269A** | Acceder a un sistema informático sin autorización o permanecer en él contra la voluntad del titular | 96 meses de prisión + multa |
| **Art. 269B** | Obstaculizar o impedir el funcionamiento de sistemas informáticos (DoS) | 96 meses + multa |
| **Art. 269C** | Interceptar datos informáticos en tránsito | 72 meses de prisión |
| **Art. 269D** | Dañar, borrar, deteriorar o alterar datos sin autorización | 96 meses + multa |
| **Art. 269E** | Crear, adquirir, distribuir o usar software malicioso | 96 meses + multa |
| **Art. 269F** | Acceder, capturar o usar datos personales sin autorización | 96 meses + multa |
| **Art. 269G** | Suplantar sitios web para capturar datos personales (phishing) | 96 meses + multa |
| **Art. 269I** | Hurto usando medios informáticos | 8 años de prisión + multa |

**Relación directa con SecureScan Pro:**

| Acción | Norma aplicable |
|---|---|
| Usar SecureScan Pro sobre un sistema sin autorización del propietario | Art. 269A (acceso abusivo) |
| Si el escaneo genera carga que afecta la disponibilidad del sistema | Art. 269B (obstaculización) |
| Si durante el escaneo se captura tráfico de red | Art. 269C (interceptación) |
| Si el escaneo extrae y usa datos personales de la base de datos | Art. 269F (violación de datos personales) |
| Modificar el sistema para eludir los controles éticos y usarlo como herramienta de ataque | Art. 269E (software malicioso) |

**La excepción legal clave — Autorización expresa:**

El Art. 269A establece que solo constituye delito el acceso **sin autorización**. Un contrato de pentesting, una carta de autorización o las reglas de un CTF son los documentos legales que convierten una actividad potencialmente delictiva en un servicio legítimo y legal.

> **Regla de oro:** Sin autorización escrita, no hay escaneo. Sin importar cuán buenas sean las intenciones.

---

### 2.2 Ley 1581 de 2012 — Protección de Datos Personales

La **Ley 1581 de 2012** regula el tratamiento de datos personales en Colombia. Es relevante para SecureScan Pro en dos dimensiones:

**Dimensión 1 — Datos encontrados durante el escaneo:**
Un escaneo sobre un sistema real podría revelar datos personales de usuarios (nombres, correos electrónicos, contraseñas en texto plano, documentos de identidad). Estos datos deben tratarse con confidencialidad estricta. Ni almacenarlos, ni compartirlos, ni divulgarlos sin consentimiento expreso del titular y sin la autorización del responsable del tratamiento.

**Dimensión 2 — El reporte como documento confidencial:**
Los reportes generados por SecureScan Pro contienen información sensible sobre la postura de seguridad de un sistema u organización. El tratamiento y la distribución de estos reportes deben ser acordados con el cliente antes del inicio del análisis y deben estar contemplados en el contrato de servicios.

> **Control técnico:** Los reportes se almacenan localmente en el volumen Docker `scan-reports`. No se transmiten a servidores externos. Los datos en Redis expiran automáticamente tras 24 horas para escaneos completados.

---

### 2.3 Decreto 1078 de 2015 — Sector TIC

El **Decreto 1078 de 2015** del Ministerio de Tecnologías de la Información y las Comunicaciones establece el marco regulatorio del sector TIC en Colombia. Para entidades públicas, el decreto exige evaluaciones periódicas de seguridad de sus sistemas de información. Herramientas como SecureScan Pro son instrumentos válidos para cumplir este mandato, siempre que el análisis sea autorizado por la dirección de tecnología de la entidad.

---

### 2.4 Ley 1266 de 2008 — Habeas Data Financiero

Complementa la Ley 1581. Es relevante si durante un análisis de seguridad autorizado se accede a bases de datos con información financiera de personas naturales. El manejo de esa información está sujeto a restricciones adicionales de confidencialidad y uso.

---

## 3. MARCO LEGAL INTERNACIONAL DE REFERENCIA

### 3.1 Estados Unidos — Computer Fraud and Abuse Act (CFAA)

La **CFAA (18 U.S.C. § 1030)** es la ley federal estadounidense que penaliza el acceso no autorizado a sistemas informáticos. Es relevante para SecureScan Pro porque varias herramientas integradas (Metasploit, Nuclei, SQLMap, Gobuster) son desarrolladas principalmente por organizaciones y personas en EE.UU., y su uso puede estar sujeto a esta norma en contextos transnacionales.

La CFAA ha sido interpretada en algunos casos de forma muy amplia, llegando a penalizar el acceso a información "pública" cuando los términos de servicio del sitio lo prohíben expresamente. Esto es especialmente relevante para herramientas de escaneo automatizado, que muchos términos de servicio prohíben.

---

### 3.2 Unión Europea — Directiva 2013/40/UE y NIS2

La **Directiva 2013/40/UE** establece estándares mínimos armonizados de penalización para delitos informáticos en los 27 estados miembros de la UE, con un alcance similar a la Ley 1273 colombiana. La **Directiva NIS2 (2022/2555)** complementa esto con obligaciones de ciberseguridad para operadores de servicios esenciales (energía, salud, transporte, infraestructura digital).

---

### 3.3 Convenio de Budapest sobre Ciberdelincuencia

El **Convenio de Budapest** (Council of Europe Treaty Series No. 185, 2001) es el primer y más importante tratado internacional sobre crímenes en Internet y sistemas informáticos. Aunque Colombia no es parte signataria, el convenio es la referencia internacional de facto para la tipificación de delitos informáticos, y la Ley 1273 de 2009 fue directamente influenciada por su estructura.

---

## 4. CONTROLES TÉCNICOS DE SEGURIDAD ÉTICA EN EL CÓDIGO

Esta sección es fundamental: los controles éticos de SecureScan Pro no son solo una política declarativa, están escritos en el código fuente y pueden ser verificados directamente por cualquier persona con acceso al repositorio.

### 4.1 Validación multi-nivel de targets (`server/app.py`)

El sistema aplica cinco capas de validación antes de aceptar cualquier URL de destino:

**Capa 1 — Caracteres inválidos:** Rechaza cualquier target que contenga `@`, espacios, barras invertidas o saltos de línea.

**Capa 2 — Patrones de IPs prohibidas:**
```python
FORBIDDEN_PATTERNS = [
    r'^localhost',           # Apunta al propio contenedor
    r'^0\.0\.0\.0',         # Dirección cero — inválida como destino externo
    r'^::1',                 # Loopback IPv6
]
```
> **Nota:** Los rangos de IPs privadas (`192.168.x.x`, `10.x.x.x`, `172.16-31.x`) fueron **deliberadamente permitidos** para que el sistema pueda escanear redes domésticas y de laboratorio propias del usuario, que son casos de uso completamente legítimos.

**Capa 3 — Allowlist de laboratorios:** Los hostnames de los tres labs siempre pasan la validación. Están en la lista `ALLOWED_LAB_TARGETS` configurada en `.env`.

**Capa 4 — Modo restrictivo (variable de entorno):**
```python
RESTRICT_TO_LAB = os.environ.get('RESTRICT_TO_LAB_TARGETS', 'false').lower() == 'true'
```
Cuando `RESTRICT_TO_LAB_TARGETS=true`, la API rechaza con `403 Forbidden` cualquier target que no sea exactamente uno de los tres laboratorios, sin excepción. Esta opción es ideal para entornos educativos compartidos (por ejemplo, una sala de clase del SENA) donde se quiere garantizar que los aprendices solo puedan escanear los labs incluidos.

**Capa 5 — Validación de alcanzabilidad:** Opcionalmente, el sistema verifica que el hostname resuelva en DNS y que el puerto esté abierto antes de iniciar el escaneo. Esto previene escaneos sobre objetivos inexistentes o mal escritos.

---

### 4.2 Autenticación por token API (`server/app.py`)

```python
# Todos los intentos fallidos quedan en el log con la IP del solicitante
if token != API_TOKEN:
    logger.warning(
        "Intento de acceso no autorizado a %s desde %s",
        request.path, request.remote_addr,
    )
    return jsonify({'error': 'Unauthorized — invalid or missing API token'}), 401
```

Cuando `API_TOKEN` está configurado en `.env`, **todos** los endpoints sensibles exigen el header `X-API-Token`. Sin él, la API responde `401 Unauthorized` y registra el intento con la dirección IP. Esto permite identificar intentos de uso no autorizado del sistema.

---

### 4.3 Rate Limiting — Límite de peticiones por hora (`server/app.py`)

```python
@app.route('/api/scan', methods=['POST'])
@limiter.limit("20 per hour")  # Máximo 20 escaneos por hora por IP
def start_scan():
    ...
```

El endpoint más crítico (`POST /api/scan`) está limitado a **20 peticiones por hora por dirección IP**. Esto previene el uso automatizado masivo del sistema para escanear múltiples objetivos en serie sin intervención humana, que es un indicador claro de uso malicioso.

---

### 4.4 Circuit Breaker — Protección anti-DoS involuntario (`server/app.py`)

El Circuit Breaker registra los fallos consecutivos contra un objetivo. Después de 3 fallos seguidos, "abre el circuito" y rechaza nuevas peticiones hacia ese objetivo durante 60 segundos. Esto previene que el sistema genere una ráfaga de peticiones contra un objetivo que está fallando, lo que podría interpretarse (o convertirse en) un ataque de denegación de servicio involuntario.

```python
# Flujo del Circuit Breaker
3 fallos → Circuito ABIERTO → 429 Too Many Requests
               ↓ (60 segundos después)
           Circuito ENTREABIERTO → Permite 1 intento de prueba
               ↓ (si el intento funciona)
           Circuito CERRADO → Operación normal
```

---

### 4.5 Aislamiento de red Docker (`docker-compose.yml`)

```yaml
networks:
  securescan-net:
    ipam:
      config:
        - subnet: 172.20.0.0/16   # Infraestructura principal (API, Redis, ZAP)
  lab-net:
    ipam:
      config:
        - subnet: 172.21.0.0/16   # Laboratorios vulnerables — completamente aislados
```

Los laboratorios (DVWA, Juice Shop, WebGoat) están **exclusivamente** en `lab-net` y no tienen acceso a `securescan-net` ni a internet. Incluso si un atacante comprometiera uno de los laboratorios durante un escaneo, no podría acceder a la infraestructura principal ni pivotear hacia la red del host.

---

### 4.6 Usuarios no-root en todos los contenedores

```dockerfile
# server/Dockerfile — el backend corre como usuario "scanner"
RUN groupadd -r scanner && useradd -r -g scanner ...
USER scanner

# Dockerfile.frontend — el frontend corre como usuario "nextjs"
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs
USER nextjs
```

Si una vulnerabilidad en la API o el frontend fuera explotada, el proceso comprometido tendría permisos de usuario sin privilegios (`scanner` o `nextjs`), limitando significativamente el daño potencial.

---

### 4.7 Privilegios mínimos del contenedor API (`docker-compose.yml`)

```yaml
cap_add:
  - NET_RAW    # Solo para nmap (raw socket access)
  - NET_ADMIN  # Solo para nmap (network interface management)
security_opt:
  - no-new-privileges: true  # Ningún proceso puede ganar privilegios adicionales
```

La directiva `no-new-privileges: true` es una capa de defensa que impide que cualquier proceso dentro del contenedor gane nuevos privilegios mediante `setuid`, `setgid` o file capabilities, incluso si el atacante explota un binario con esos bits activados.

---

### 4.8 Redis y SQLMap API — Binding exclusivo a localhost

```yaml
redis:
  ports:
    - "127.0.0.1:6379:6379"   # Solo accesible desde el mismo host

sqlmapapi:
  ports:
    - "127.0.0.1:8775:8775"   # Solo accesible desde el mismo host
```

Redis (que contiene todos los resultados de escaneos) y la SQLMap API no están expuestos en `0.0.0.0`. Solo pueden ser alcanzados desde `localhost`, lo que significa que no son accesibles desde otras máquinas en la misma red local.

---

### 4.9 Metasploit — Exclusivamente módulos auxiliares (`server/modules/metasploit.py`)

Todo el código del módulo de Metasploit usa exclusivamente prefijos `auxiliary/scanner/`. No existe en todo el código fuente ninguna invocación de módulos `exploits/`, `post/` o `payload/`. Esta restricción es arquitectural: la función `_select_modules()` solo retorna módulos de la lista predefinida, y esa lista fue construida manualmente sin incluir módulos de explotación.

---

### 4.10 Sanitización XSS en reportes (`server/utils/reporter.py`)

```python
def sanitize_html(text: Any) -> str:
    """Sanitiza todo contenido antes de insertarlo en el HTML del reporte"""
    if text is None:
        return ''
    return html.escape(str(text), quote=True)
```

Todo contenido externo insertado en los reportes HTML (nombres de vulnerabilidades, payloads, URLs, evidencias encontradas) es sanitizado con `html.escape(text, quote=True)`. Esto previene que un payload XSS descubierto durante el escaneo se ejecute en el navegador del analista al abrir el reporte.

---

### 4.11 Headers de seguridad en el frontend (`next.config.mjs`)

El frontend implementa seis cabeceras de seguridad HTTP en todas las respuestas:

| Header | Valor | ¿Qué previene? |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | MIME sniffing attacks |
| `X-Frame-Options` | `DENY` | Clickjacking via iframes |
| `X-XSS-Protection` | `1; mode=block` | XSS reflejado en navegadores antiguos |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Filtración de URLs internas |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Acceso a hardware del usuario |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'none'` | Inyección de scripts y clickjacking |

El header `X-Powered-By` está desactivado (`poweredByHeader: false`) para no revelar la tecnología usada.

---

### 4.12 Validación estricta de SECRET_KEY en producción (`server/app.py`)

```python
if not _secret_key or 'CAMBIA' in _secret_key or 'change' in _secret_key.lower():
    if os.environ.get('FLASK_ENV') != 'development':
        raise RuntimeError(
            "SECRET_KEY debe ser una clave segura en producción. "
            "Genera una con: openssl rand -hex 32"
        )
```

El sistema **se niega a arrancar** en modo producción si `SECRET_KEY` contiene las cadenas de ejemplo del `.env`. Esto previene despliegues accidentales con claves predecibles que comprometerían la integridad de las sesiones Flask.

---

## 5. USO AUTORIZADO Y USO NO AUTORIZADO

### 5.1 Usos AUTORIZADOS y LEGALES

| Escenario | Tipo de autorización | Descripción |
|---|---|---|
| **Laboratorio SENA** (DVWA, Juice Shop, WebGoat) | Implícita — los labs existen para este fin | Las tres aplicaciones son diseñadas y licenciadas para ser analizadas |
| **Sistema propio del operador** (VPS, servidor personal) | Propia — el operador es el propietario | El propietario siempre tiene autorización sobre sus propios sistemas |
| **Sistema del empleador** en contexto laboral | Autorización escrita del empleador | Auditorías internas, bug bounty corporativo |
| **Sistema de un cliente** en consultoría | Contrato de pentesting firmado | Evaluación de seguridad profesional para terceros |
| **CTF / Hackathon** | Las reglas de la competencia | Las reglas del evento constituyen la autorización |
| **Lab personal** (VMs locales propias) | Propia — el operador controla el entorno | Práctica y experimentación personal |

### 5.2 Usos NO AUTORIZADOS e ILEGALES

| Escenario | Por qué es ilegal | Norma aplicable |
|---|---|---|
| Escanear un sitio web de empresa u organización sin permiso | Acceso no autorizado aunque el sitio sea "público" | Art. 269A Ley 1273/2009, CFAA |
| Escanear la red de un vecino, empresa aledaña o institución educativa sin permiso | Acceso abusivo a sistema de terceros | Art. 269A Ley 1273/2009 |
| Generar tráfico que afecte la disponibilidad del objetivo | Obstaculización ilegítima de sistema | Art. 269B Ley 1273/2009 |
| Extraer y almacenar datos personales de un sistema escaneado | Violación de datos personales | Art. 269F + Ley 1581/2012 |
| Escanear infraestructura gubernamental o crítica sin permiso | Agravantes por objetivo crítico | Art. 269A con agravantes |
| Modificar el código para eludir los controles de targets | Conversión en herramienta de ataque | Art. 269E (software malicioso) |
| Compartir el sistema modificado con terceros para ataques | Coautoría o complicidad | Arts. 269A, 269E Ley 1273/2009 |

### 5.3 Zona gris — Bug Bounty y programas de divulgación

Algunos sitios web tienen programas de **bug bounty** (recompensa por vulnerabilidades reportadas). En ese caso:

- El alcance (**scope**) del programa define exactamente qué sistemas pueden ser probados.
- Las técnicas permitidas están especificadas en las reglas del programa.
- **El uso de herramientas automatizadas como SecureScan Pro puede estar prohibido en algunos programas.** Revisar siempre las reglas antes de usarlas.
- Si el programa lo permite, SecureScan Pro puede ser un punto de partida válido para el reconocimiento inicial.

**Regla de oro:** Leer siempre las reglas completas del programa antes de iniciar cualquier actividad, y ceñirse a ellas con exactitud.

---

## 6. LOS TRES LABORATORIOS — POR QUÉ SON LEGALES Y SEGUROS

### 6.1 🍊 OWASP Juice Shop

**Licencia:** MIT License
**Propósito declarado por sus autores:**
> *"OWASP Juice Shop is probably the most modern and sophisticated insecure web application! It can be used in security trainings, awareness demos, CTFs and as a guinea pig for security tools!"*

**Repositorio oficial:** https://github.com/juice-shop/juice-shop
**Mantenido por:** Bjoern Kimminich y OWASP Foundation

Juice Shop fue diseñada específicamente para ser atacada. Contiene vulnerabilidades OWASP Top 10 2021 de forma intencional y documentada. No hay usuarios reales, no hay datos personales reales, no hay ningún sistema de producción involucrado.

**Versión usada en SecureScan Pro:** `bkimminich/juice-shop:v17.0.0`

---

### 6.2 💀 DVWA (Damn Vulnerable Web Application)

**Licencia:** GNU General Public License v3.0
**Propósito declarado:**
> *"Damn Vulnerable Web Application (DVWA) is a PHP/MySQL web application that is damn vulnerable. Its main goal is to be an aid for security professionals to test their skills and tools in a legal environment, help web developers better understand the processes of securing web applications."*

**Repositorio oficial:** https://github.com/digininja/DVWA
**Mantenido por:** Robin Wood (digininja) y la comunidad

DVWA fue creada específicamente para entrenamiento legal. Su documentación incluye advertencias explícitas sobre **no desplegarla en servidores accesibles desde internet** sin controles adicionales. En SecureScan Pro, DVWA está en la red `lab-net` completamente aislada, cumpliendo exactamente con esa recomendación.

**Versión usada:** `ghcr.io/digininja/dvwa:latest`

---

### 6.3 🐐 WebGoat

**Licencia:** Apache License 2.0
**Propósito declarado:**
> *"WebGoat is a deliberately insecure web application maintained by OWASP designed to teach web application security lessons."*

**Repositorio oficial:** https://github.com/WebGoat/WebGoat
**Mantenido por:** OWASP Foundation

WebGoat es la plataforma educativa más longeva de OWASP, con más de 20 años de uso en formación profesional de seguridad. Incluye lecciones interactivas donde el aprendiz explota vulnerabilidades paso a paso y luego aprende cómo remediarlas.

**Versión usada:** `webgoat/webgoat:latest`

---

### 6.4 Configuración de aislamiento en SecureScan Pro

Los tres laboratorios comparten esta configuración de aislamiento en `docker-compose.yml`:

```yaml
juice-shop:
  networks:
    - lab-net      # Solo en lab-net — sin acceso a securescan-net ni a internet

dvwa:
  networks:
    - lab-net

webgoat:
  networks:
    - lab-net
```

**Lo que este aislamiento garantiza:**
- Ningún laboratorio tiene acceso a internet
- Ningún laboratorio puede comunicarse con Redis, la API o el frontend
- Ningún laboratorio puede ser alcanzado desde otras máquinas en la red del host (salvo a través de los puertos mapeados deliberadamente: 3001, 3002, 3003)
- Un atacante que comprometa un laboratorio durante un escaneo no puede pivotar hacia otros sistemas

---

## 7. METASPLOIT EN MODO AUXILIAR — DISTINCIÓN TÉCNICA Y ÉTICA

### 7.1 Los cuatro tipos de módulos de Metasploit

Metasploit Framework tiene una arquitectura modular con cuatro tipos bien diferenciados:

| Tipo | Prefijo | ¿Qué hace? | Uso en SecureScan Pro |
|---|---|---|---|
| **Auxiliares** | `auxiliary/` | Escaneo, enumeración, **verificación** de vulnerabilidades. No compromete el sistema. | ✅ **Son los únicos usados** |
| **Exploits** | `exploits/` | Explota activamente una vulnerabilidad para **ganar acceso** al sistema | ❌ Nunca usados |
| **Post-explotación** | `post/` | Actividades después de comprometer el sistema (persistencia, extracción de datos, pivoting) | ❌ Nunca usados |
| **Payloads** | `payload/` | Código malicioso que se ejecuta en el sistema comprometido (shells, backdoors) | ❌ Nunca usados |

### 7.2 La diferencia que importa éticamente

La diferencia entre un módulo **auxiliar** y un módulo **exploit** es la misma que existe entre un médico que examina un paciente para ver si tiene una enfermedad, y un médico que deliberadamente le contagia esa enfermedad. El primero es diagnóstico; el segundo es daño.

SecureScan Pro hace **diagnóstico**, no daño.

### 7.3 Módulos auxiliares específicos usados

```python
# server/modules/metasploit.py — Todos son auxiliary/scanner/
_BASE_WEB = [
    ("auxiliary/scanner/http/http_version",  ...),  # Detecta versión del servidor HTTP
    ("auxiliary/scanner/http/options",       ...),  # Verifica métodos HTTP peligrosos
    ("auxiliary/scanner/http/dir_listing",   ...),  # Verifica si el listado de dirs está activo
    ("auxiliary/scanner/http/robots_txt",    ...),  # Lee el archivo robots.txt
]
```

Módulos adicionales según tecnología (todos `auxiliary/scanner/`):
- Si detecta **Apache Tomcat:** `tomcat_mgr_login`, `tomcat_enum`
- Si detecta **PHP:** `php_cgi_arg_injection`, `phpinfo`
- Si detecta **Jenkins:** `jenkins_enum`
- Si detecta **WordPress:** `wp_login`

Ninguno de estos módulos modifica datos, instala nada ni compromete el acceso al sistema. Solo verifican si ciertas condiciones de vulnerabilidad están presentes.

### 7.4 Modo simulación automático

Si `msfrpcd` no está disponible o la conexión RPC falla, el módulo activa automáticamente un modo de simulación que genera resultados de ejemplo marcados con `"simulated": true`. El pipeline continúa sin interrupciones y el dashboard muestra claramente que esos resultados son simulados.

---

## 8. RESPONSABILIDADES DEL OPERADOR

El operador de SecureScan Pro es la persona que instala, configura y usa el sistema. Con ese rol vienen responsabilidades concretas.

### 8.1 Antes de cualquier escaneo

| Responsabilidad | Cómo cumplirla |
|---|---|
| Verificar que tiene autorización | Propietario del sistema, contrato firmado o uso dentro del laboratorio educativo incluido |
| Revisar el alcance de la autorización | Si hay contrato, verificar exactamente qué sistemas y técnicas están permitidos |
| Configurar el modo restrictivo si hay usuarios múltiples | `RESTRICT_TO_LAB_TARGETS=true` en `.env` para garantizar que solo se escaneen los labs |
| Verificar que los labs estén activos | `docker compose ps` para confirmar que los tres laboratorios están en estado `healthy` |

### 8.2 Durante el escaneo

| Responsabilidad | Por qué importa |
|---|---|
| No interrumpir escaneos activos sobre sistemas productivos | Una interrupción a mitad puede dejar ZAP con procesos activos en el objetivo |
| Monitorear el consumo de recursos del objetivo | ZAP con escaneo activo puede generar carga. En sistemas productivos, coordinar con operaciones |
| No compartir las credenciales de la API durante el escaneo | `API_TOKEN` es un secreto operacional |

### 8.3 Después del escaneo

| Responsabilidad | Cómo cumplirla |
|---|---|
| Tratar el reporte con confidencialidad | Solo personas autorizadas deben acceder al reporte |
| Reportar los hallazgos al propietario | Si es un cliente, comunicar formalmente dentro del plazo acordado en el contrato |
| Eliminar los datos cuando ya no sean necesarios | Ver comandos de eliminación en la Sección 9.3 |
| No divulgar vulnerabilidades sin autorización | Seguir el proceso de Responsible Disclosure (Sección 10) |

### 8.4 Responsabilidad sobre el acceso de terceros

Si el operador comparte el acceso al sistema con otras personas (compañeros, aprendices, clientes), asume la responsabilidad de:

1. Instruirles sobre el marco legal y ético antes de que usen el sistema
2. Asegurarse de que solo escaneen targets para los cuales tengan autorización
3. Configurar `API_TOKEN` para controlar quién puede iniciar escaneos
4. Mantener los logs activos para auditoría posterior

---

## 9. PRIVACIDAD Y PROTECCIÓN DE DATOS DE LOS REPORTES

### 9.1 ¿Qué datos almacena el sistema?

| Tipo de dato | Dónde se guarda | Tiempo de vida | ¿Quién puede accederlo? |
|---|---|---|---|
| Estado del escaneo (progreso, pasos) | Redis / memoria interna | 1 hora (en curso), 24 horas (completado) | API con token |
| Resultados completos (vulnerabilidades, tecnologías, etc.) | Redis / memoria interna | 24 horas | API con token |
| Reportes generados (HTML, PDF, JSON, CSV) | Volumen Docker `scan-reports` | Sin expiración automática | Acceso al contenedor |
| Logs de acceso (IPs, endpoints, timestamps) | Stdout del contenedor | Hasta reinicio del contenedor | Acceso al host |

### 9.2 ¿Qué datos NO almacena el sistema?

El sistema fue diseñado con privacidad por defecto. **No almacena:**

- Contraseñas de usuarios reales de los sistemas escaneados (Patator solo reporta que encontró una credencial válida, sin guardar la contraseña en Redis)
- Capturas de tráfico de red
- Datos personales extraídos de bases de datos durante pruebas de SQLi
- Información financiera de usuarios de los sistemas analizados

> **Aclaración importante:** La cookie de sesión usada durante el auto-login es la de la cuenta de prueba del laboratorio (por ejemplo, `admin@juice-sh.op`). No es la cookie de ningún usuario real.

### 9.3 Eliminación segura de datos

Cuando ya no se necesiten los datos de un escaneo:

```bash
# Eliminar todos los reportes del volumen Docker
docker compose exec api find /app/reports -name "report-*" -delete

# Eliminar todos los escaneos de Redis
docker compose exec redis redis-cli -a "${REDIS_PASSWORD}" FLUSHDB
```

### 9.4 Clasificación de confidencialidad recomendada

| Entorno escaneado | Clasificación recomendada del reporte |
|---|---|
| Laboratorio (DVWA, Juice Shop, WebGoat) | Sin clasificación especial (datos sintéticos) |
| Sistema propio de práctica | USO INTERNO |
| Sistema de cliente en contexto profesional | CONFIDENCIAL |
| Sistema de infraestructura crítica | RESERVADO — distribución estrictamente restringida |

---

## 10. PRINCIPIO DE DIVULGACIÓN RESPONSABLE

### 10.1 ¿Qué es la divulgación responsable?

La **divulgación responsable** (también llamada *Coordinated Vulnerability Disclosure*) es el proceso por el cual un investigador que descubre una vulnerabilidad en un sistema que no es suyo actúa de la siguiente manera:

1. **Notifica primero al propietario** del sistema afectado con todos los detalles técnicos necesarios para reproducir y entender la vulnerabilidad.
2. **Concede un plazo razonable** para que el propietario corrija la vulnerabilidad. El estándar de la industria (Google Project Zero) es **90 días**.
3. **No explota la vulnerabilidad** para ningún beneficio propio durante ese plazo, ni comparte la información con terceros.
4. **Solo publica** la vulnerabilidad después de que fue corregida o de que venció el plazo sin respuesta.

Este proceso equilibra dos intereses legítimos: el derecho del público a conocer las vulnerabilidades que los afectan, y el derecho del propietario a tener tiempo suficiente para corregirlas antes de que sean explotadas.

---

### 10.2 Proceso paso a paso para aprendices de SecureScan Pro

Si durante el uso del sistema se descubren vulnerabilidades reales en sistemas con autorización (bug bounty, auditoría contratada, sistema propio):

**Paso 1 — Documentar con precisión:**
Guardar el reporte generado por SecureScan Pro. Anotar la URL exacta, el parámetro afectado, el payload que demostró la vulnerabilidad y la evidencia visible (screenshot, código de respuesta HTTP, etc.).

**Paso 2 — Identificar el canal de contacto correcto:**
La mayoría de organizaciones tienen una dirección de contacto de seguridad, usualmente `security@empresa.com`, o una plataforma de bug bounty (HackerOne, Bugcrowd). Algunas tienen un archivo `security.txt` en `/.well-known/security.txt`.

**Paso 3 — Enviar el reporte de forma confidencial:**
Enviar el reporte solo al responsable de seguridad de la organización. No publicarlo en redes sociales, foros públicos ni comentarlo con terceros antes de que la vulnerabilidad sea corregida.

**Paso 4 — Acordar el plazo y hacer seguimiento:**
Confirmar que el reporte fue recibido. Acordar un plazo de corrección. El estándar es 90 días; para vulnerabilidades críticas con explotación activa, el plazo puede reducirse a 7-14 días.

**Paso 5 — Respetar el proceso:**
No divulgar la vulnerabilidad durante el plazo acordado, incluso si la organización no responde con la rapidez esperada. Si el plazo vence sin corrección, notificar que se procederá a publicar y dar 7-14 días adicionales.

---

### 10.3 Organizaciones de referencia

| Organización | Recurso |
|---|---|
| CERT/CC | https://www.kb.cert.org/vuls/report/ |
| Google Project Zero | https://googleprojectzero.blogspot.com/p/vulnerability-disclosure-faq.html |
| CISA (EE.UU.) | https://www.cisa.gov/coordinated-vulnerability-disclosure-process |
| HackerOne | https://hackerone.com/disclosure-guidelines |
| ISO/IEC 29147:2018 | Estándar internacional para divulgación de vulnerabilidades |

---

## 11. ALINEACIÓN CON ESTÁNDARES INTERNACIONALES DE ÉTICA

### 11.1 Código de Ética EC-Council (CEH — Certified Ethical Hacker)

El **EC-Council** certifica a los profesionales de hacking ético más reconocidos del mundo. Su código de ética exige:

- Mantener la privacidad y confidencialidad de la información de los clientes
- No acceder a sistemas sin autorización expresa
- No usar las habilidades adquiridas para dañar a terceros
- Reportar vulnerabilidades a los propietarios antes de divulgarlas públicamente

SecureScan Pro implementa técnicamente estos cuatro compromisos: la validación de targets, el modo auxiliar de Metasploit, la sanitización XSS de reportes y el proceso de Responsible Disclosure son las expresiones en código de cada uno de estos principios.

---

### 11.2 Cánones Éticos de (ISC)² — CISSP

El **International Information System Security Certification Consortium** establece cuatro cánones en su código de ética:

| Canon | Descripción | Cómo SecureScan Pro contribuye |
|---|---|---|
| **1** | Proteger la sociedad, el bien común y la infraestructura necesaria | Forma analistas capaces de defender sistemas reales |
| **2** | Actuar de forma honorable, honesta, justa, responsable y legal | Los controles técnicos imponen comportamiento ético incluso sin supervisión |
| **3** | Proveer servicio diligente y competente a los empleadores | Las herramientas integradas son las mismas usadas en la industria profesional |
| **4** | Hacer avanzar y proteger la profesión | El proyecto es evidencia de formación técnica seria en el contexto latinoamericano |

---

### 11.3 OWASP — Principios para herramientas de seguridad

OWASP establece que las herramientas de seguridad deben:

- Ser diseñadas para uso defensivo y educativo ✅
- Incluir documentación clara sobre uso legal y ético ✅ (este documento)
- No facilitar ataques contra sistemas sin autorización ✅ (controles técnicos en `app.py`)

---

### 11.4 PTES — Penetration Testing Execution Standard

El **PTES** establece como Fase 0 (*Pre-engagement*) la obtención de **autorización formal por escrito** antes de cualquier actividad de pentesting. SecureScan Pro refleja esto en su diseño: los laboratorios incluidos representan la "autorización implícita" del entorno educativo, y el modo restrictivo (`RESTRICT_TO_LAB_TARGETS=true`) garantiza que el sistema no pueda usarse fuera de ese contexto controlado sin una modificación deliberada de la configuración.

---

### 11.5 NIST SP 800-115 — Guía de Evaluaciones de Seguridad

El **NIST SP 800-115** ("Technical Guide to Information Security Testing and Assessment") define las prácticas técnicas para evaluaciones de seguridad en organizaciones federales de EE.UU. y es adoptado como referencia internacional. Sus fases (Planificación → Descubrimiento → Ataque → Reporte) mapean directamente con el pipeline de SecureScan Pro:

| Fase NIST SP 800-115 | Equivalente en SecureScan Pro |
|---|---|
| Planificación | Selección de herramientas y configuración del escaneo |
| Descubrimiento | Wappalyzer, Nmap, Gobuster, ffuf, ZAP Spider |
| Ataque | ZAP Active Scan, Nuclei, InjectionScanner, SQLMap, Metasploit |
| Reporte | `reporter.py` — HTML, PDF, JSON, CSV |

---

## 12. PREGUNTAS FRECUENTES SOBRE ÉTICA Y LEGALIDAD

**P1: ¿Puedo usar SecureScan Pro para analizar el sitio web de mi universidad?**
No, a menos que tengas autorización expresa y por escrito del área de tecnología. Ser estudiante de la institución no otorga autorización para escanear sus sistemas. Solicita permiso formalmente antes de proceder.

**P2: ¿Es legal escanear un sitio web que no tiene login ni datos personales?**
No. La ausencia de autenticación o datos personales no hace legal el acceso no autorizado. La Ley 1273 Art. 269A penaliza el acceso a cualquier sistema informático sin autorización, independientemente de su contenido.

**P3: ¿Puedo usar SecureScan Pro para analizar los sistemas de mi empleador?**
Depende. Si tu rol incluye responsabilidades de seguridad y tienes autorización para realizar pruebas, sí. En caso de duda, solicita autorización por escrito antes de proceder. Una autorización verbal puede ser suficiente en la práctica, pero no lo es ante un proceso legal.

**P4: Los controles técnicos del sistema, ¿me protegen legalmente si alguien lo usa mal?**
Los controles técnicos son evidencia de buena fe en el diseño del sistema, pero no constituyen una exención legal automática. Quien modifica el código para eludir esos controles y lo usa de forma ilegal asume plena responsabilidad penal. El operador que compartió el sistema sin instrucciones claras puede ser considerado cómplice.

**P5: ¿Qué hago si durante un escaneo autorizado encuentro una vulnerabilidad crítica?**
Documenta el hallazgo con el reporte de SecureScan Pro, notifica inmediatamente al propietario o cliente, y sigue el proceso de Responsible Disclosure (Sección 10). No compartas la información con terceros antes de que sea corregida.

**P6: ¿Puedo compartir SecureScan Pro con compañeros del SENA?**
Sí. El código es de uso educativo y puede ser compartido. Asegúrate de incluir este documento junto con el sistema, para que quienes lo reciban también conozcan el marco ético y legal de su uso.

**P7: ¿Puedo usar SecureScan Pro en un CTF o Hackathon?**
Sí, siempre que las reglas del evento lo permitan. Algunas competencias prohíben herramientas automatizadas. Lee las reglas completas antes de usarlas.

**P8: ¿Es legal tener Metasploit instalado en mi computadora?**
En Colombia, la mera posesión de herramientas de seguridad no es ilegal. Lo que es ilegal es su uso para acceder a sistemas sin autorización (Arts. 269A y 269E, Ley 1273). Metasploit es utilizado legítimamente por miles de profesionales de seguridad en todo el mundo cada día.

**P9: ¿SecureScan Pro puede usarse en entornos de producción reales?**
Sí, con las condiciones adecuadas: autorización escrita del propietario, coordinación con el equipo de operaciones para gestionar el impacto de la carga, y acuerdo previo sobre confidencialidad del reporte. Para producción, se recomienda usar los modos "Ligero" o "Normal" en lugar del modo "Completo", para minimizar el impacto sobre la disponibilidad del sistema.

---

## 13. DECLARACIÓN DE USO EDUCATIVO Y COMPROMISO DE RESPONSABILIDAD

### 13.1 Declaración formal

El proyecto **SecureScan Pro v5.0** fue desarrollado con el propósito exclusivo de aprender, practicar y demostrar competencias en seguridad de aplicaciones web en el marco del programa **Técnico en Seguridad de Aplicaciones Web del SENA**.

Todos los análisis de seguridad realizados durante el desarrollo y las pruebas del sistema se efectuaron sobre los laboratorios vulnerables incluidos (DVWA, OWASP Juice Shop y WebGoat), que son aplicaciones de código abierto diseñadas específicamente para ese propósito, sin intervenir en ningún sistema de terceros sin autorización.

El sistema implementa controles técnicos verificables que dificultan activamente su uso fuera del entorno educativo autorizado, incluyendo la validación multi-nivel de targets, el aislamiento de red Docker, el modo restrictivo por variable de entorno, la limitación de Metasploit a módulos auxiliares y el rate limiting de peticiones.

---

### 13.2 Compromiso de uso responsable

Al instalar y usar SecureScan Pro, el operador acepta implícitamente:

1. Escanear **únicamente** sistemas sobre los cuales tenga autorización expresa o implícita como propietario.
2. Tratar todos los resultados con el nivel de confidencialidad apropiado al contexto.
3. **No modificar** los controles de seguridad éticos del sistema para eludir las restricciones de targets.
4. Reportar cualquier vulnerabilidad real descubierta siguiendo el proceso de Responsible Disclosure (Sección 10).
5. Asumir plena responsabilidad legal y ética por cualquier uso del sistema fuera del laboratorio educativo incluido.
6. Instruir a cualquier tercero con acceso al sistema sobre este marco ético y legal antes de que lo usen.

---

### 13.3 Licencias de las herramientas integradas

| Herramienta | Licencia |
|---|---|
| Nmap | Nmap Public Source License (NPSL) |
| OWASP ZAP | Apache License 2.0 |
| SQLMap | GNU General Public License v2.0 |
| Nuclei | MIT License |
| Gobuster | Apache License 2.0 |
| ffuf | MIT License |
| Metasploit Framework | BSD 3-Clause "New" License |
| Searchsploit / ExploitDB | GNU General Public License v2.0 |
| Patator | GNU General Public License v2.0 |
| DVWA | GNU General Public License v3.0 |
| OWASP Juice Shop | MIT License |
| WebGoat | Apache License 2.0 |
| Redis | Redis Source Available License 2.0 (RSALv2) |
| Next.js | MIT License |
| Python / Flask | Python Software Foundation License / BSD |

---

## 14. REFERENCIAS LEGALES Y NORMATIVAS

### Legislación colombiana

- Congreso de Colombia. (2009). *Ley 1273 de 2009 — Protección de la información y de los datos*. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34492
- Congreso de Colombia. (2008). *Ley 1266 de 2008 — Habeas Data Financiero*. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=34488
- Congreso de Colombia. (2012). *Ley 1581 de 2012 — Protección de Datos Personales*. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981
- Presidencia de la República. (2015). *Decreto 1078 de 2015 — Decreto Único Reglamentario Sector TIC*. https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=72925

### Normativa internacional de referencia

- Council of Europe. (2001). *Convention on Cybercrime (Budapest Convention)*. https://www.coe.int/en/web/conventions/full-list/-/conventions/treaty/185
- European Parliament. (2013). *Directive 2013/40/EU on attacks against information systems*. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32013L0040
- European Parliament. (2022). *Directive NIS2 (2022/2555)*. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32022L2555
- U.S. Department of Justice. (2020). *Computer Fraud and Abuse Act (18 U.S.C. § 1030)*. https://www.justice.gov/jm/jm-9-48000-computer-fraud

### Estándares y marcos éticos

- EC-Council. (2024). *CEH Code of Ethics*. https://www.eccouncil.org/code-of-ethics/
- (ISC)². (2024). *Code of Ethics*. https://www.isc2.org/Ethics
- OWASP Foundation. (2024). *OWASP Code of Ethics*. https://owasp.org/www-policy/legal/code-of-ethics
- PTES Technical Guidelines. (2012). *Penetration Testing Execution Standard — Pre-engagement*. http://www.pentest-standard.org/index.php/Pre-engagement
- NIST. (2008). *NIST SP 800-115: Technical Guide to Information Security Testing and Assessment*. https://csrc.nist.gov/publications/detail/sp/800-115/final
- ISO/IEC 29147:2018. *Information technology — Security techniques — Vulnerability disclosure*. https://www.iso.org/standard/72311.html

### Laboratorios vulnerables — Términos de uso

- OWASP Juice Shop. *MIT License*. https://github.com/juice-shop/juice-shop/blob/master/LICENSE
- DVWA. *GPL v3 + Legal Disclaimer*. https://github.com/digininja/DVWA/blob/master/README.md#legal
- WebGoat. *Apache License 2.0*. https://github.com/WebGoat/WebGoat/blob/develop/LICENSE

### Divulgación responsable

- Google Project Zero. (2024). *Vulnerability Disclosure Policy*. https://googleprojectzero.blogspot.com/p/vulnerability-disclosure-faq.html
- CISA. (2024). *Coordinated Vulnerability Disclosure Process*. https://www.cisa.gov/coordinated-vulnerability-disclosure-process
- HackerOne. (2024). *Disclosure Guidelines*. https://hackerone.com/disclosure-guidelines

---

*Documento elaborado como parte del Proyecto de Grado — Técnico en Seguridad de Aplicaciones Web.*
*SENA — Servicio Nacional de Aprendizaje — Colombia, Julio 2026*

*Los controles técnicos descritos en la Sección 4 pueden verificarse directamente en el código fuente:*
*`server/app.py` · `server/modules/metasploit.py` · `server/utils/reporter.py` · `docker-compose.yml` · `next.config.mjs`*
