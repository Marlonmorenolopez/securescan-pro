# GUÍA DE DESPLIEGUE COMPLETA
## SecureScan Pro v5.0 — Instalación, Configuración y Operación

**Autor:** Técnico en Seguridad de Aplicaciones Web
**Institución:** SENA — Servicio Nacional de Aprendizaje (Colombia)
**Programa:** Técnico en Seguridad de Aplicaciones Web
**Versión del sistema:** 5.0.0 (Dockerfile backend v3.1.3 / Dockerfile frontend v4)
**Fecha de actualización:** Julio 2026
**Entornos probados:** Kali Linux 2024.x · Ubuntu 24.04 LTS · Windows 11 + Docker Desktop

---

> 💡 **¿Cuánto tarda la instalación completa?**
> - Primera vez (descarga todo): **20–40 minutos** según velocidad de internet
> - Veces siguientes (imágenes ya construidas): **2–4 minutos**

---

## TABLA DE CONTENIDOS

1. [Requisitos del Sistema](#1-requisitos-del-sistema)
2. [Prerrequisitos de Software](#2-prerrequisitos-de-software)
3. [Obtención del Código Fuente](#3-obtención-del-código-fuente)
4. [Configuración del Archivo .env](#4-configuración-del-archivo-env)
5. [Instalación Automática — Método Recomendado](#5-instalación-automática--método-recomendado)
6. [Instalación Manual Paso a Paso](#6-instalación-manual-paso-a-paso)
7. [Verificación del Despliegue](#7-verificación-del-despliegue)
8. [URLs y Puertos del Sistema](#8-urls-y-puertos-del-sistema)
9. [Credenciales de los Laboratorios](#9-credenciales-de-los-laboratorios)
10. [Operación Diaria — Comandos Esenciales](#10-operación-diaria--comandos-esenciales)
11. [Gestión de Logs](#11-gestión-de-logs)
12. [Gestión de Datos y Reportes](#12-gestión-de-datos-y-reportes)
13. [Desarrollo Local sin Docker](#13-desarrollo-local-sin-docker)
14. [Actualización del Sistema](#14-actualización-del-sistema)
15. [Solución de Problemas Frecuentes](#15-solución-de-problemas-frecuentes)
16. [Referencia Completa de Variables de Entorno](#16-referencia-completa-de-variables-de-entorno)
17. [Arquitectura de Redes Docker](#17-arquitectura-de-redes-docker)
18. [Consideraciones de Seguridad](#18-consideraciones-de-seguridad)

---

## 1. REQUISITOS DEL SISTEMA

### 1.1 Hardware mínimo

| Recurso | Mínimo | Recomendado | Por qué |
|---|---|---|---|
| **CPU** | 4 núcleos | 6+ núcleos | ZAP y Nuclei son CPU-intensivos |
| **RAM** | 8 GB | 16 GB | ZAP usa hasta 3 GB solo, Metasploit ~1.5 GB |
| **Disco** | 25 GB libres | 40 GB libres | SecLists ~1.5 GB, imágenes Docker ~8 GB total |
| **Tipo de disco** | HDD | SSD | Acelera los builds significativamente |
| **Arquitectura** | x86_64 (amd64) | x86_64 (amd64) | ARM no compatible |

> ⚠️ **Nota sobre RAM:** Con todos los servicios activos durante un escaneo completo, el uso puede alcanzar **10–12 GB**. En sistemas con 8 GB puede haber swap.

> ⚠️ **Nota sobre ARM (Apple Silicon, Raspberry Pi):** No compatible. La imagen de Metasploit Framework no tiene build oficial para `arm64`.

### 1.2 Sistemas operativos compatibles

| Sistema Operativo | Estado | Notas |
|---|---|---|
| **Kali Linux 2024.x** | ✅ Entorno principal de desarrollo | Probado en VirtualBox y bare metal |
| **Ubuntu 24.04 LTS** | ✅ Compatible | Recomendado para producción |
| **Debian 12 (Bookworm)** | ✅ Compatible | Misma base que Kali |
| **Windows 11 + Docker Desktop** | ⚠️ Compatible con pasos adicionales | Ver Sección 2.3 |
| **macOS 13+ con Docker Desktop** | ⚠️ Compatible parcialmente | Sin soporte `NET_RAW` para nmap raw |
| **ARM / Apple Silicon** | ❌ No compatible | Metasploit no tiene imagen arm64 |

---

## 2. PRERREQUISITOS DE SOFTWARE

Antes de instalar SecureScan Pro, necesitas tener estos tres programas instalados en tu sistema.

---

### 2.1 Docker Engine con el plugin Compose v2

SecureScan Pro requiere el **plugin Compose v2** (`docker compose` con espacio). **No** usa `docker-compose` con guión (versión v1 legacy).

**Verificar si ya está instalado:**
```bash
docker --version
# Debe mostrar: Docker version 26.x.x o superior

docker compose version
# Debe mostrar: Docker Compose version v2.x.x o superior
```

**Instalar en Kali Linux / Debian / Ubuntu:**
```bash
# 1. Eliminar versiones antiguas si existen
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# 2. Instalar dependencias del repositorio
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 3. Agregar la clave GPG oficial de Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 4. Agregar el repositorio oficial de Docker
# (En Kali, usar bookworm que es la base de Debian)
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian bookworm stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. Instalar Docker y el plugin Compose
sudo apt-get update
sudo apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

# 6. Habilitar Docker para que arranque automáticamente
sudo systemctl enable docker
sudo systemctl start docker
```

**Agregar tu usuario al grupo docker (para no escribir `sudo` en cada comando):**
```bash
sudo usermod -aG docker $USER
newgrp docker

# Verificar que funciona sin sudo
docker run --rm hello-world
```

---

### 2.2 Git

```bash
# Verificar
git --version
# git version 2.x.x

# Instalar si no está
sudo apt-get install -y git
```

---

### 2.3 Instrucciones específicas para Windows 11

Si instalas en Windows, sigue estos pasos adicionales **antes** de continuar:

**Paso 1 — Verificar y activar virtualización en la BIOS:**
```powershell
# Abrir PowerShell como administrador y ejecutar:
systeminfo | findstr /i "virtualization"
# Debe decir: Virtualization Enabled In Firmware: Yes
```
Si no muestra nada o dice `No`, debes activar **Intel Virtualization Technology** (o **SVM Mode** en AMD) en la BIOS de tu equipo antes de continuar.

**Paso 2 — Instalar Docker Desktop:**
Descarga e instala desde https://www.docker.com/products/docker-desktop/

Durante la instalación, selecciona **"Use WSL 2 instead of Hyper-V"**.

Espera hasta que Docker Desktop muestre **"Engine running"** en la esquina inferior izquierda antes de continuar.

**Paso 3 — Aumentar timeout de Docker (importante para el build largo):**
```powershell
$env:DOCKER_CLIENT_TIMEOUT=300
$env:COMPOSE_HTTP_TIMEOUT=300
```

**Paso 4 — Usar PowerShell como administrador** para todos los comandos siguientes.

> ⚠️ **En Windows, reemplaza `~/SecureScan` por `C:\SecureScan`** en todos los ejemplos de esta guía.

---

### 2.4 pnpm y Node.js (solo para desarrollo local del frontend)

> **No se necesita para el despliegue con Docker.** Solo si quieres modificar el frontend y ver los cambios en vivo sin reconstruir la imagen.

```bash
# Instalar Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Activar pnpm con corepack
sudo corepack enable
corepack prepare pnpm@8.15.0 --activate

# Verificar
node --version    # v20.x.x
pnpm --version    # 8.15.0
```

---

## 3. OBTENCIÓN DEL CÓDIGO FUENTE

### Opción A — Desde el repositorio Git (recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/Marlonmorenolopez/SecureScan.git ~/SecureScan
cd ~/SecureScan

# Verificar que la estructura es correcta
ls
# Debe mostrar: server/ app/ components/ lib/ docker-compose.yml start.sh verify.sh ...
```

### Opción B — Desde el archivo ZIP

```bash
# Descomprimir el archivo
unzip SecureScan.zip -d ~/SecureScan
cd ~/SecureScan

# Verificar la estructura
ls
```

### Verificar que los archivos críticos existen

Antes de continuar, confirma que estos archivos están presentes:

```bash
ls docker-compose.yml start.sh verify.sh Dockerfile.frontend
ls server/app.py server/Dockerfile server/requirements.txt server/entrypoint.sh
ls server/modules/orchestrator.py server/utils/reporter.py server/utils/scoring.py
ls app/scanner/page.tsx lib/api-client.ts components/results-dashboard.tsx

echo "✅ Estructura verificada"
```

---

## 4. CONFIGURACIÓN DEL ARCHIVO .ENV

El archivo `.env` contiene todas las contraseñas y configuraciones del sistema. Debes crearlo antes de arrancar.

### 4.1 Crear el archivo .env

```bash
cd ~/SecureScan

# Si el proyecto incluye un .env.example, copiarlo como base
cp .env.example .env

# Abrirlo para editarlo
nano .env
```

### 4.2 Contenido completo del .env para laboratorio educativo

Copia y pega este contenido completo en tu archivo `.env`:

```env
# ── Flask / Backend ──────────────────────────────────────────────────
FLASK_ENV=development
FLASK_DEBUG=0
PORT=5000

# Clave secreta de Flask
# Para generarla: openssl rand -hex 32
SECRET_KEY=change-this-in-production-generate-random-key

# ── Redis ─────────────────────────────────────────────────────────────
REDIS_URL=redis://:changeme-redis-password@redis:6379/0
REDIS_PASSWORD=changeme-redis-password

# ── OWASP ZAP ────────────────────────────────────────────────────────
ZAP_API_URL=http://localhost:8080
ZAP_API_KEY=securescan-dev-key-2024

# ── DVWA / MariaDB ────────────────────────────────────────────────────
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=dvwa
MYSQL_USER=dvwa
MYSQL_PASSWORD=p@ssw0rd

# ── Laboratorios permitidos ───────────────────────────────────────────
ALLOWED_LAB_TARGETS=juice-shop:3000,dvwa:80,webgoat:8080
RESTRICT_TO_LAB_TARGETS=false

# ── Metasploit RPC ────────────────────────────────────────────────────
MSF_HOST=msfrpcd
MSF_PORT=55553
MSF_PASSWORD=msf

# ── SQLMap API ────────────────────────────────────────────────────────
SQLMAP_API_PASSWORD=sqlmapsecret

# ── Token de autenticación de la API ─────────────────────────────────
# Dejar vacío en el laboratorio = sin autenticación requerida
# Para producción: generar con openssl rand -hex 32
API_TOKEN=

# ── Frontend (Next.js) ────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_API_TOKEN=

# ── CORS ──────────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://frontend:3000

# ── Timeouts de herramientas (en segundos) ────────────────────────────
SCAN_TIMEOUT_WAPPALYZER=60
SCAN_TIMEOUT_NMAP=300
SCAN_TIMEOUT_PATATOR=180
SCAN_TIMEOUT_METASPLOIT=900
SCAN_TIMEOUT_FFUF=300
SCAN_TIMEOUT_GOBUSTER=300
SCAN_TIMEOUT_ZAP=1200
SCAN_TIMEOUT_NUCLEI=1200
SCAN_TIMEOUT_INJECTION=600
SCAN_TIMEOUT_SEARCHSPLOIT=120
SCAN_TIMEOUT_SQLMAP=600
GUNICORN_TIMEOUT=3600

# ── Logging ───────────────────────────────────────────────────────────
LOG_LEVEL=INFO
```

### 4.3 Variables que DEBES cambiar para mayor seguridad

Si el sistema va a ser usado por más de una persona o en una red compartida, genera valores únicos para estas variables:

```bash
# Generar SECRET_KEY
echo "SECRET_KEY=$(openssl rand -hex 32)"

# Generar REDIS_PASSWORD
echo "REDIS_PASSWORD=$(openssl rand -hex 16)"

# Generar ZAP_API_KEY
echo "ZAP_API_KEY=$(openssl rand -hex 16)"

# Generar API_TOKEN (activa autenticación en todos los endpoints)
echo "API_TOKEN=$(openssl rand -hex 32)"
```

Copia cada valor generado a su variable correspondiente en el `.env`.

> ⚠️ **Importante:** El archivo `.env` contiene contraseñas. Nunca lo subas a Git. Ya está incluido en el `.gitignore` del proyecto.

---

## 5. INSTALACIÓN AUTOMÁTICA — MÉTODO RECOMENDADO

El script `start.sh` hace todo el trabajo: construye las imágenes, arranca los servicios en el orden correcto y verifica que todo funciona.

### 5.1 Ejecutar la instalación

```bash
cd ~/SecureScan

# Dar permisos de ejecución (solo la primera vez)
chmod +x start.sh verify.sh

# Ejecutar
bash start.sh
```

### 5.2 ¿Qué hace start.sh?

El script ejecuta estos pasos automáticamente:

```
✅ Paso 1 — Verifica que Docker y Docker Compose v2 estén instalados
✅ Paso 2 — Crea .env automáticamente si no existe
✅ Paso 3 — Construye la imagen del backend (descarga Go, SQLMap,
            gobuster, ffuf, nuclei, SecLists, ExploitDB, nuclei-templates)
✅ Paso 4 — Construye la imagen del frontend (pnpm install + next build)
✅ Paso 5 — Arranca Redis y espera a que responda (PING → PONG)
✅ Paso 6 — Arranca ZAP en segundo plano (~60s para estar listo)
✅ Paso 7 — Arranca la BD de DVWA, luego DVWA + WebGoat + Juice Shop
✅ Paso 8 — Arranca Metasploit en segundo plano (~2–5 min para estar listo)
✅ Paso 9 — Arranca la API + SQLMap API, espera 10s, arranca el frontend
✅ Paso 10 — Verifica /api/health cada 3 segundos (máximo 60 intentos)
✅ Paso 11 — Muestra el resumen con todas las URLs
```

### 5.3 Salida esperada al finalizar

```
════════════════════════════════════════
  SecureScan Pro — Todo listo 🚀
════════════════════════════════════════

  Frontend:    http://localhost:3000
  API:         http://localhost:5000/api/health
  Juice Shop:  http://localhost:3001
  DVWA:        http://localhost:3002
  WebGoat:     http://localhost:3003

  Comandos útiles:
    docker compose logs -f api      # Logs del backend
    docker compose logs -f frontend # Logs del frontend
    docker compose down             # Parar todo
    bash verify.sh                  # Verificar estado
```

### 5.4 Tiempos esperados

| Situación | Tiempo aproximado |
|---|---|
| **Primera instalación** (descarga todo desde cero) | 20–40 minutos |
| **Instalaciones siguientes** (imágenes ya construidas) | 2–4 minutos |
| **Solo arrancar** (sin rebuild, ya instalado) | 1–2 minutos |

> 💡 El tiempo de la primera instalación depende de la velocidad de tu internet. Las descargas más pesadas son: SecLists (~1.5 GB), imagen de Metasploit (~1.5 GB), nuclei-templates (~300 MB) y ExploitDB (~200 MB).

### 5.5 Si start.sh se cuelga en Redis

En algunos sistemas el paso de verificación de Redis se puede colgar. Si esto ocurre:

```bash
# Presionar Ctrl+C para cancelar
# Verificar el estado de Redis
docker ps

# Si Redis está corriendo, continuar manualmente:
docker compose up -d zap
docker compose up -d dvwa-db
sleep 10
docker compose up -d dvwa webgoat juice-shop
docker compose up -d msfrpcd
docker compose up -d api sqlmapapi
sleep 10
docker compose up -d frontend
```

---

## 6. INSTALACIÓN MANUAL PASO A PASO

Si prefieres control total sobre cada paso, o si el script automático falla en algún punto:

### Paso 1 — Construir las imágenes

```bash
cd ~/SecureScan

# Construir el backend (tarda 15–30 min la primera vez)
docker compose build api

# Construir el frontend (tarda 3–5 min la primera vez)
docker compose build frontend
```

### Paso 2 — Arrancar Redis

```bash
docker compose up -d redis

# Esperar a que Redis esté listo
until docker compose exec redis \
    redis-cli -a "${REDIS_PASSWORD:-changeme-redis-password}" ping 2>/dev/null \
    | grep -q PONG; do
  echo "Esperando Redis..."
  sleep 2
done
echo "✅ Redis listo"
```

### Paso 3 — Arrancar ZAP

```bash
docker compose up -d zap
echo "⏳ ZAP iniciando (puede tardar ~60s)..."
```

### Paso 4 — Arrancar la base de datos y laboratorios

```bash
# Primero la base de datos de DVWA
docker compose up -d dvwa-db
sleep 15

# Luego los tres laboratorios
docker compose up -d dvwa webgoat juice-shop
echo "⏳ Laboratorios iniciando..."
```

### Paso 5 — Arrancar Metasploit

```bash
docker compose up -d msfrpcd
echo "⏳ Metasploit iniciando (puede tardar 2–5 min)..."
```

### Paso 6 — Arrancar la API

```bash
docker compose up -d api sqlmapapi

# Esperar a que la API responda
until curl -sf http://localhost:5000/api/health | grep -q healthy; do
  echo "Esperando API..."
  sleep 5
done
echo "✅ API lista"
```

### Paso 7 — Arrancar el Frontend

```bash
docker compose up -d frontend

# Esperar al frontend
until curl -sf -o /dev/null http://localhost:3000; do
  echo "Esperando Frontend..."
  sleep 5
done
echo "✅ Frontend listo"
```

### Paso 8 — Verificar estado completo

```bash
docker compose ps
```

Todos los servicios deben aparecer como `healthy` o `running`:

```
NAME                   IMAGE                           STATUS
dvwa                   ghcr.io/digininja/dvwa:latest   Up (healthy)
dvwa-db                mariadb:10.11                   Up (healthy)
juice-shop             bkimminich/juice-shop:v17.0.0   Up (healthy)
securescan-api         securescan-api                  Up (healthy)
securescan-frontend    securescan-frontend             Up (healthy)
securescan-msfrpcd     metasploit-framework:latest     Up
securescan-redis       redis:7-alpine                  Up (healthy)
securescan-sqlmapapi   securescan-sqlmapapi            Up (healthy)
securescan-zap         zaproxy:stable                  Up (healthy)
webgoat                webgoat/webgoat:latest          Up (healthy)
```

> **Nota:** `securescan-msfrpcd` puede aparecer sin `(healthy)` durante los primeros 2–5 minutos. Esto es normal. El sistema sigue funcionando.

---

## 7. VERIFICACIÓN DEL DESPLIEGUE

### 7.1 Script de verificación automática

```bash
bash verify.sh
```

Salida esperada cuando todo está correcto:
```
══ Resultado: 22 ✓  0 ✗ ══
🟢 Todo OK — SecureScan Pro listo para usar
```

### 7.2 Verificación manual de la API

```bash
# Health check — el endpoint más importante
curl -s http://localhost:5000/api/health | python3 -m json.tool
```

Respuesta esperada:
```json
{
  "status": "healthy",
  "version": "5.0.0",
  "storage": "connected",
  "zap_configured": true,
  "tools": [
    "wappalyzer", "nmap", "gobuster", "zap", "searchsploit",
    "metasploit", "nuclei", "sqlmap", "injection_scanner",
    "patator", "ffuf"
  ]
}
```

> Si `"storage"` dice `"memory"` en lugar de `"connected"`, Redis no está disponible. El sistema sigue funcionando pero los resultados no persisten entre reinicios.

### 7.3 Verificar las herramientas dentro del container

```bash
docker compose exec api bash -c "
  for tool in nmap nuclei gobuster ffuf sqlmap patator searchsploit wkhtmltopdf; do
    which \$tool > /dev/null 2>&1 \
      && echo \"  ✅ \$tool: \$(which \$tool)\" \
      || echo \"  ❌ \$tool: no encontrado\"
  done
"
```

### 7.4 Verificar conectividad entre servicios

```bash
# La API debe poder alcanzar ZAP
docker compose exec api curl -sf \
  "http://zap:8080/JSON/core/view/version/?apikey=${ZAP_API_KEY:-securescan-dev-key-2024}"

# La API debe poder alcanzar los laboratorios
docker compose exec api curl -sf -o /dev/null -w "%{http_code}" http://juice-shop:3000
docker compose exec api curl -sf -o /dev/null -w "%{http_code}" http://dvwa:80
docker compose exec api curl -sf -o /dev/null -w "%{http_code}" http://webgoat:8080/WebGoat/
```

---

## 8. URLS Y PUERTOS DEL SISTEMA

### 8.1 Acceso desde el navegador

| Servicio | URL | ¿Para qué? |
|---|---|---|
| 🖥️ **SecureScan Pro** | http://localhost:3000 | Interfaz principal |
| ⚙️ **API Health** | http://localhost:5000/api/health | Verificar estado |
| 🍊 **Juice Shop** | http://localhost:3001 | Laboratorio OWASP |
| 💀 **DVWA** | http://localhost:3002 | Laboratorio vulnerable PHP |
| 🐐 **WebGoat** | http://localhost:3003/WebGoat/ | Laboratorio Java |

### 8.2 Puertos internos (no acceder directamente)

| Servicio | Puerto | Descripción |
|---|---|---|
| Redis | `127.0.0.1:6379` | Solo accesible desde localhost |
| SQLMap API | `127.0.0.1:8775` | Solo accesible desde localhost |
| ZAP | `8080` | API de OWASP ZAP |
| Metasploit RPC | `55553` | Daemon RPC de Metasploit |

### 8.3 Tiempos de arranque por servicio

| Servicio | Tiempo típico | Observaciones |
|---|---|---|
| Redis | 3–5 s | Muy rápido |
| dvwa-db | 20–35 s | Inicialización MariaDB |
| Juice Shop | 30–45 s | Node.js startup |
| DVWA | 30–60 s | Depende de que dvwa-db esté listo |
| WebGoat | 45–90 s | Java Spring Boot — el más lento de los labs |
| ZAP | 45–90 s | JVM + carga de reglas de escaneo |
| API | 15–25 s | Flask + Gunicorn |
| Frontend | 20–40 s | Next.js server.js |
| Metasploit | 120–300 s | El más lento — **no bloquea la API** |

---

## 9. CREDENCIALES DE LOS LABORATORIOS

### 9.1 Credenciales de acceso a los labs

| Laboratorio | URL | Usuario | Contraseña |
|---|---|---|---|
| **DVWA** | http://localhost:3002 | `admin` | `password` |
| **Juice Shop** | http://localhost:3001 | `admin@juice-sh.op` | `admin123` |
| **WebGoat** | http://localhost:3003/WebGoat/ | `securescan` | `Password` |

> **Nota sobre DVWA:** SecureScan Pro fuerza automáticamente el nivel de seguridad a `low` antes de cada escaneo. Esto es necesario para que todas las herramientas puedan detectar las vulnerabilidades correctamente.

### 9.2 Credenciales de infraestructura

Estas credenciales están en el `.env` y solo se usan internamente entre los contenedores:

| Servicio | Variable | Valor por defecto |
|---|---|---|
| Redis | `REDIS_PASSWORD` | `changeme-redis-password` |
| DVWA / MariaDB root | `MYSQL_ROOT_PASSWORD` | `rootpassword` |
| DVWA / MariaDB user | `MYSQL_PASSWORD` | `p@ssw0rd` |
| Metasploit RPC | `MSF_PASSWORD` | `msf` |
| ZAP API | `ZAP_API_KEY` | `securescan-dev-key-2024` |
| SQLMap API | `SQLMAP_API_PASSWORD` | `sqlmapsecret` |

---

## 10. OPERACIÓN DIARIA — COMANDOS ESENCIALES

### Iniciar el sistema

```bash
# Con rebuild automático (recomendado si cambiaste código)
bash start.sh

# Sin rebuild (más rápido si no hubo cambios)
docker compose up -d
```

### Parar el sistema

```bash
# Parar todos los servicios (conserva los datos)
docker compose down

# Parar y eliminar todos los datos — ⚠️ IRREVERSIBLE
docker compose down -v
```

### Reiniciar un servicio específico

```bash
# Reiniciar solo la API (por ejemplo, tras cambios en server/)
docker compose restart api

# Reiniciar solo el frontend
docker compose restart frontend

# Reiniciar todos los servicios
docker compose restart
```

### Rebuild tras cambios en el código

```bash
# Solo el backend (cambios en server/)
docker compose build api
docker compose up -d --no-deps api

# Solo el frontend (cambios en app/, components/, lib/)
docker compose build frontend
docker compose up -d --no-deps frontend

# Todo desde cero (si hay problemas extraños)
docker compose build --no-cache
docker compose up -d
```

### Ver el estado de todos los servicios

```bash
docker compose ps

# Ver uso de recursos en tiempo real
docker stats
```

### Abrir una terminal dentro de un contenedor

```bash
# Dentro del contenedor de la API
docker compose exec api bash

# Verificar herramientas desde dentro
docker compose exec api nmap --version
docker compose exec api nuclei -version
docker compose exec api python3 -c "import flask; print(flask.__version__)"
```

---

## 11. GESTIÓN DE LOGS

### Ver logs en tiempo real

```bash
# Todos los servicios a la vez
docker compose logs -f

# Solo la API (más útil durante un escaneo)
docker compose logs -f api

# Solo el frontend
docker compose logs -f frontend

# Solo ZAP
docker compose logs -f zap

# Solo Metasploit
docker compose logs -f msfrpcd
```

### Opciones útiles

```bash
# Últimas 50 líneas
docker compose logs --tail=50 api

# Logs con timestamps
docker compose logs -f -t api

# Logs desde una hora específica
docker compose logs --since="2026-07-01T10:00:00" api
```

### Interpretación de los logs de la API

```log
# Arranque exitoso de Gunicorn
[INFO] Starting gunicorn 21.2.0
[INFO] Listening at: http://0.0.0.0:5000
[INFO] Worker with pid 8 booted.

# Inicio de un escaneo
INFO - Started scan f8dbc36e para target http://dvwa:80

# Progreso por herramienta
INFO - Wappalyzer → http://dvwa:80
INFO - Wappalyzer (lib) detectó 3 tecnologías en http://dvwa:80
INFO - Nmap → http://dvwa:80
INFO - Nmap scan completed in 12.2s, found 1 open ports

# Finalización exitosa
INFO - Scan f8dbc36e completed for target http://dvwa:80
```

**Mensajes normales que NO son errores:**
- `API_TOKEN no configurado` → normal en laboratorio sin autenticación
- `Usando SECRET_KEY de desarrollo` → normal con `FLASK_ENV=development`
- `wappalyzer-cli no disponible — usando librería Python` → comportamiento esperado
- `Metasploit no disponible — usando simulación` → normal mientras msfrpcd está arrancando

---

## 12. GESTIÓN DE DATOS Y REPORTES

### Ver y descargar reportes

Los reportes se guardan dentro del contenedor API en `/app/reports/`:

```bash
# Listar reportes disponibles
docker compose exec api ls /app/reports/

# Copiar todos los reportes al directorio actual del host
docker cp securescan-api:/app/reports/ ./reportes-backup/

# Copiar un reporte específico
docker cp securescan-api:/app/reports/report-<scan_id>.html ./reporte.html
```

También puedes descargarlos directamente desde la interfaz en http://localhost:3000 → historial → icono de descarga.

### Limpiar reportes y datos

```bash
# Limpiar solo los reportes generados
docker compose exec api rm -f /app/reports/report-*.html \
                              /app/reports/report-*.pdf \
                              /app/reports/report-*.json \
                              /app/reports/report-*.csv

# Limpiar el historial de escaneos en Redis
docker compose exec redis \
  redis-cli -a "${REDIS_PASSWORD:-changeme-redis-password}" FLUSHDB

# Reinicializar DVWA desde cero
docker compose down dvwa dvwa-db
docker volume rm securescan_dvwa-db-data 2>/dev/null || \
  docker volume rm securescan-main_dvwa-db-data
docker compose up -d dvwa-db
sleep 30
docker compose up -d dvwa
# Luego visitar: http://localhost:3002/setup.php
```

### Respaldo del estado de Redis

```bash
# Forzar guardado en disco
docker compose exec redis \
  redis-cli -a "${REDIS_PASSWORD:-changeme-redis-password}" BGSAVE

# Copiar el archivo de datos al host
docker cp securescan-redis:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb
```

---

## 13. DESARROLLO LOCAL SIN DOCKER

Para modificar código y ver los cambios sin esperar a que Docker reconstruya la imagen completa:

### Backend Flask en local

```bash
cd ~/SecureScan/server

# Crear entorno virtual Python
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Variables de entorno mínimas (Redis y ZAP deben correr en Docker)
export FLASK_ENV=development
export FLASK_DEBUG=1
export SECRET_KEY=dev-local-key
export REDIS_URL=redis://localhost:6379/0
export ZAP_API_URL=http://localhost:8080

# Iniciar Flask con auto-reload
python3 app.py
# O con flask run:
# flask run --host=0.0.0.0 --port=5000
```

> **Nota:** Redis, ZAP y los laboratorios deben seguir corriendo en Docker. Solo el proceso Flask corre localmente.

### Frontend Next.js en local (hot reload)

```bash
cd ~/SecureScan

# Instalar dependencias (solo la primera vez)
pnpm install

# Crear archivo de variables de entorno local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_API_TOKEN=
BACKEND_URL=http://localhost:5000
EOF

# Iniciar en modo desarrollo (los cambios se ven inmediatamente)
pnpm dev
# Frontend disponible en: http://localhost:3000
```

> **Importante:** Para el frontend en modo dev, para el contenedor frontend de Docker primero para que no haya conflicto en el puerto 3000:
> ```bash
> docker compose stop frontend
> ```

### Comandos de calidad de código

```bash
# Verificar tipos TypeScript
pnpm type-check

# Ejecutar linter
pnpm lint

# Auto-corregir problemas de linting
pnpm lint:fix

# Generar build de producción localmente
pnpm build
pnpm start
```

---

## 14. ACTUALIZACIÓN DEL SISTEMA

### Actualizar el código fuente

```bash
cd ~/SecureScan

# Si usas Git
git pull origin main

# Verificar qué cambió
git log --oneline -10
git diff HEAD~1 --name-only
```

### Reconstruir solo lo que cambió

```bash
# Si solo cambiaron archivos en server/ (Python)
docker compose build api
docker compose up -d --no-deps api

# Si solo cambiaron archivos en app/, components/, lib/ (TypeScript/React)
docker compose build frontend
docker compose up -d --no-deps frontend

# Si cambió docker-compose.yml o .env
docker compose up -d

# Rebuild forzado desde cero (resolver problemas extraños)
docker compose build --no-cache api
docker compose build --no-cache frontend
docker compose up -d
```

### Actualizar imágenes de terceros

```bash
# Descargar versiones más recientes de los laboratorios y herramientas
docker compose pull zap juice-shop webgoat

# Recrear los contenedores con las nuevas imágenes
docker compose up -d --force-recreate zap juice-shop webgoat
```

### Actualizar templates de Nuclei

```bash
# Actualizar las 13.000+ plantillas de vulnerabilidades
docker compose exec api nuclei -update-templates
```

---

## 15. SOLUCIÓN DE PROBLEMAS FRECUENTES

### ❌ Error: "SECRET_KEY debe ser una clave segura"

**Síntoma:**
```log
RuntimeError: SECRET_KEY debe ser una clave segura en producción.
```

**Solución:**
```bash
# Opción 1: Usar modo desarrollo (para laboratorio)
sed -i 's/FLASK_ENV=production/FLASK_ENV=development/' .env
docker compose restart api

# Opción 2: Generar una clave nueva
NEW_KEY=$(openssl rand -hex 32)
sed -i "s/^SECRET_KEY=.*/SECRET_KEY=$NEW_KEY/" .env
docker compose restart api
```

---

### ❌ DVWA no carga o muestra error de base de datos

**Causa:** La base de datos no terminó de inicializarse antes de que DVWA intentara conectarse.

**Solución:**
```bash
docker compose restart dvwa-db
sleep 30
docker compose restart dvwa
sleep 15

# Si persiste — inicializar manualmente
curl -sf -o /dev/null -L "http://localhost:3002/setup.php?initdb=true" || true
```

---

### ❌ El frontend no carga — ERR_CONNECTION_REFUSED

**Causa:** El contenedor del frontend no arrancó correctamente o usa `https://` en vez de `http://`.

**Verificación:**
```bash
docker compose logs --tail=20 frontend
docker compose ps | grep frontend
```

**Solución:**
```bash
# Asegurarse de usar http:// (sin la s)
# URL correcta: http://localhost:3000
# URL incorrecta: https://localhost:3000

# Si el contenedor está caído, reconstruir
docker compose rm -sf frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

---

### ❌ ZAP no responde — pasos del escaneo fallan

**Causa:** ZAP necesita ~60–90 segundos para arrancar completamente.

**Verificación:**
```bash
curl -sf "http://localhost:8080/JSON/core/view/version/?apikey=securescan-dev-key-2024"
# Si no responde, ZAP aún está cargando
```

**Solución:**
```bash
docker compose logs --tail=20 zap
docker compose restart zap
# Esperar 90 segundos antes de intentar un escaneo
```

---

### ❌ Metasploit muestra resultados "simulados"

**Causa:** `msfrpcd` aún está arrancando (puede tardar hasta 5 minutos desde que arranca el sistema).

**Verificación:**
```bash
docker compose logs --tail=10 msfrpcd
# Buscar: "msfrpcd started on port 55553"

docker compose exec api bash -c \
  "echo > /dev/tcp/msfrpcd/55553 && echo 'Puerto abierto' || echo 'No disponible'"
```

**Solución:** Esperar 2–5 minutos después del arranque y volver a escanear.

---

### ❌ Redis muestra "storage: memory" en el health check

**Causa:** Redis no está disponible o la contraseña no coincide con la del `.env`.

**Verificación:**
```bash
docker compose exec redis \
  redis-cli -a "${REDIS_PASSWORD:-changeme-redis-password}" ping
# Debe responder: PONG

grep -E "REDIS_URL|REDIS_PASSWORD" .env
# REDIS_URL debe contener la misma contraseña que REDIS_PASSWORD
```

---

### ❌ Error "docker compose" no reconocido

**Causa:** Tienes `docker-compose` v1 (legacy) pero no el plugin v2.

**Solución:**
```bash
sudo apt-get install -y docker-compose-plugin
docker compose version
# Debe mostrar: Docker Compose version v2.x.x
```

---

### ❌ Build muy lento o falla con timeout de red

**Causa:** La descarga de SecLists (~1.5 GB) o Metasploit puede fallar con conexiones inestables.

**Solución:**
```bash
# Aumentar los timeouts
export DOCKER_CLIENT_TIMEOUT=300
export COMPOSE_HTTP_TIMEOUT=300

# Reintentar el build — Docker retoma desde donde falló
docker compose build api

# Si falla repetidamente, ver el log detallado
docker compose build --progress=plain api 2>&1 | tail -50
```

---

### ❌ Frontend carga un segundo y luego se cae

**Causa:** Un componente React está intentando usar un valor de `riskLevel` que no existe en el mapa de estilos.

**Verificación:**
```bash
# Abrir la consola del navegador (F12 → Console)
# Buscar un error como: "Cannot read properties of undefined (reading 'bg')"
```

**Solución:** Verificar que el archivo `components/results-dashboard.tsx` tiene el mapeo `riskLevelToBadge` actualizado con los nuevos valores (`PROTEGIDO`, `VULNERABLE`, `EXPUESTO`, `COMPROMETIDO`):

```bash
grep "riskLevelToBadge" components/results-dashboard.tsx
# Debe mostrar: const riskLevelToBadge: Record<string, ...>
```

Si no existe, aplicar el archivo corregido del repositorio y reconstruir el frontend.

---

### ❌ Error de f-string en reporter.py (SyntaxError)

**Causa:** Python 3.11 no permite barras invertidas dentro de expresiones f-string.

**Síntoma:**
```log
SyntaxError: f-string expression part cannot include a backslash
```

**Solución:** Verificar que `server/utils/reporter.py` es la versión corregida del repositorio:

```bash
python3 -c "import ast; ast.parse(open('server/utils/reporter.py').read()); print('✅ Sintaxis OK')"
```

Si falla, descargar la versión corregida del repositorio y reiniciar la API:
```bash
git checkout server/utils/reporter.py
docker compose restart api
```

---

### ❌ "This page couldn't load" durante un escaneo activo

**Causa:** El frontend se reinició mientras había un escaneo en curso (por ejemplo, si reconstruiste el frontend en medio de un escaneo). No es un error persistente.

**Solución:** Recargar la página (`F5`). Si el escaneo quedó colgado en el historial, lanzar uno nuevo.

---

## 16. REFERENCIA COMPLETA DE VARIABLES DE ENTORNO

### Variables del backend

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `FLASK_ENV` | `development` | `development` o `production`. En `development` acepta SECRET_KEY débil |
| `FLASK_DEBUG` | `0` | `1` activa recarga automática. Nunca usar `1` en producción |
| `PORT` | `5000` | Puerto de Flask |
| `SECRET_KEY` | *(requerido)* | Clave secreta Flask. Generar con `openssl rand -hex 32` |
| `REDIS_URL` | `redis://:changeme@redis:6379/0` | URL completa de Redis con contraseña |
| `REDIS_PASSWORD` | `changeme-redis-password` | Contraseña de Redis (debe coincidir con REDIS_URL) |
| `ZAP_API_URL` | `http://zap:8080` | URL interna de ZAP |
| `ZAP_API_KEY` | `securescan-dev-key-2024` | Clave de autenticación de ZAP |
| `SQLMAP_API_URL` | `http://sqlmapapi:8775` | URL interna de SQLMap API |
| `SQLMAP_API_PASSWORD` | `sqlmapsecret` | Contraseña de SQLMap API |
| `MSF_HOST` | `msfrpcd` | Hostname del daemon Metasploit |
| `MSF_PORT` | `55553` | Puerto RPC de Metasploit |
| `MSF_PASSWORD` | `msf` | Contraseña RPC de Metasploit |
| `API_TOKEN` | `""` (vacío) | Token de autenticación. Vacío = sin autenticación |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Orígenes CORS permitidos |
| `ALLOWED_LAB_TARGETS` | `juice-shop:3000,dvwa:80,webgoat:8080` | Targets del lab (siempre permitidos) |
| `RESTRICT_TO_LAB_TARGETS` | `false` | Si `true`, bloquea cualquier target que no sea del lab |
| `GUNICORN_TIMEOUT` | `3600` | Segundos máximos por escaneo. Debe ser mayor al timeout más largo |
| `LOG_LEVEL` | `INFO` | Nivel de logging: `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `TZ` | `America/Bogota` | Zona horaria |

### Timeouts por herramienta (en segundos)

| Variable | Valor | Herramienta |
|---|---|---|
| `SCAN_TIMEOUT_WAPPALYZER` | 60 | Detector de tecnologías |
| `SCAN_TIMEOUT_NMAP` | 300 | Escáner de puertos (5 min) |
| `SCAN_TIMEOUT_PATATOR` | 180 | Brute force (3 min) |
| `SCAN_TIMEOUT_METASPLOIT` | 900 | Módulos Metasploit (15 min) |
| `SCAN_TIMEOUT_FFUF` | 300 | Fuzzing de endpoints (5 min) |
| `SCAN_TIMEOUT_GOBUSTER` | 300 | Enumeración de directorios (5 min) |
| `SCAN_TIMEOUT_ZAP` | 1200 | DAST ZAP (20 min) |
| `SCAN_TIMEOUT_NUCLEI` | 1200 | Templates de vulnerabilidades (20 min) |
| `SCAN_TIMEOUT_INJECTION` | 600 | InjectionScanner (10 min) |
| `SCAN_TIMEOUT_SEARCHSPLOIT` | 120 | Búsqueda de exploits (2 min) |
| `SCAN_TIMEOUT_SQLMAP` | 600 | Detección SQLi (10 min) |
| `GUNICORN_TIMEOUT` | 3600 | Timeout total de la petición HTTP |

### Variables del frontend

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000` | URL de la API para el navegador |
| `NEXT_PUBLIC_API_TOKEN` | `""` (vacío) | Token de autenticación para el navegador |
| `BACKEND_URL` | `http://api:5000` | URL interna Docker para SSR y rewrites |

### Variables de MariaDB (DVWA)

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | `rootpassword` | Contraseña root de MariaDB |
| `MYSQL_DATABASE` | `dvwa` | Nombre de la base de datos |
| `MYSQL_USER` | `dvwa` | Usuario de la base de datos |
| `MYSQL_PASSWORD` | `p@ssw0rd` | Contraseña del usuario |

---

## 17. ARQUITECTURA DE REDES DOCKER

### Las dos redes del sistema

| Red | Subred | ¿Qué contiene? |
|---|---|---|
| `securescan-net` | `172.20.0.0/16` | Frontend, API, Redis, ZAP, SQLMap, Metasploit |
| `lab-net` | `172.21.0.0/16` | DVWA, dvwa-db, Juice Shop, WebGoat |

La API y ZAP están en **ambas redes** para poder escanear los laboratorios.

### Diagrama de conectividad

```
HOST (tu computadora)
     │
     ├─ :3000 ─→ securescan-frontend ──┐
     ├─ :5000 ─→ securescan-api        │  securescan-net (172.20.x.x)
     ├─ :8080 ─→ securescan-zap ───────┤
     ├─ :6379 ─→ securescan-redis      │  (solo 127.0.0.1)
     ├─ :8775 ─→ securescan-sqlmapapi  │  (solo 127.0.0.1)
     └─ :55553─→ securescan-msfrpcd ───┘
                         │
                         │  (API, ZAP, SQLMap, MSF están en ambas redes)
                         ▼
     ├─ :3001 ─→ juice-shop ─────────┐
     ├─ :3002 ─→ dvwa ───────────────┤  lab-net (172.21.x.x)
     │              └─→ dvwa-db      │  (aislados de internet)
     └─ :3003 ─→ webgoat ────────────┘
```

---

## 18. CONSIDERACIONES DE SEGURIDAD

### ⚠️ Los laboratorios son deliberadamente vulnerables

DVWA, Juice Shop y WebGoat contienen vulnerabilidades reales. **Nunca los expongas a internet** sin controles adicionales. Están diseñados para correr exclusivamente en redes locales de laboratorio.

### Activar modo estricto de laboratorio

Si el sistema va a ser usado por varios aprendices en una red compartida, activa el modo estricto para que solo puedan escanear los labs incluidos:

```bash
# En .env:
RESTRICT_TO_LAB_TARGETS=true
```

Reiniciar la API:
```bash
docker compose restart api
```

Con esta opción activa, cualquier intento de escanear una URL externa o IP de red local recibirá un error `403 Forbidden`.

### Activar autenticación de la API

Para evitar que cualquier persona en la red local pueda iniciar escaneos:

```bash
# Generar token
API_TOKEN=$(openssl rand -hex 32)

# Actualizar .env
sed -i "s/^API_TOKEN=.*/API_TOKEN=$API_TOKEN/" .env
sed -i "s/^NEXT_PUBLIC_API_TOKEN=.*/NEXT_PUBLIC_API_TOKEN=$API_TOKEN/" .env

# Reiniciar ambos servicios
docker compose restart api frontend
```

### Redis y SQLMap solo en localhost

Por diseño, Redis y SQLMap API están mapeados a `127.0.0.1` (no a `0.0.0.0`):
```yaml
redis:
  ports:
    - "127.0.0.1:6379:6379"    # Solo accesible desde el mismo host

sqlmapapi:
  ports:
    - "127.0.0.1:8775:8775"    # Solo accesible desde el mismo host
```

Esto garantiza que otras máquinas en la misma red local no pueden acceder directamente a Redis ni a la SQLMap API.

---

*Guía actualizada a partir del código fuente real de SecureScan Pro v5.0.*
*Archivos verificados: `start.sh` · `docker-compose.yml` · `server/Dockerfile` · `Dockerfile.frontend` · `.env.example`*
*SENA — Programa Técnico en Seguridad de Aplicaciones Web — Colombia, Julio 2026*
