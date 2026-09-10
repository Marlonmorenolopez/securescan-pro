#!/bin/bash
# ============================================================
# SecureScan Pro — start.sh
# Inicia toda la plataforma con un solo comando
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
BOLD='\033[1m'

log()    { echo -e "${CYAN}[SecureScan]${NC} $1"; }
ok()     { echo -e "${GREEN}  ✓${NC} $1"; }
warn()   { echo -e "${YELLOW}  ⚠${NC} $1"; }
error()  { echo -e "${RED}  ✗${NC} $1"; }
header() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${NC}"; }

header "SecureScan Pro v3.0 — Inicio"

# ── 1. Prerrequisitos ────────────────────────────────────────────────
header "Verificando prerrequisitos"

if ! command -v docker &>/dev/null; then
    error "Docker no está instalado"; exit 1
fi
ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

if ! docker compose version &>/dev/null; then
    error "Docker Compose v2 no está instalado"; exit 1
fi
ok "Docker Compose $(docker compose version --short)"

# ── 2. Archivo .env ──────────────────────────────────────────────────
header "Configuración"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        warn ".env creado desde .env.example — revisa los valores antes de producción"
    else
        error ".env.example no encontrado"; exit 1
    fi
else
    ok ".env existente"
fi

# ── 3. Build ─────────────────────────────────────────────────────────
header "Construyendo imágenes"

log "Construyendo backend API..."
docker compose build api sqlmapapi

log "Construyendo frontend..."
docker compose build frontend

ok "Build completado"

# ── 4. Arrancar servicios por orden ──────────────────────────────────
header "Arrancando servicios"

log "1/5 Redis..."
docker compose up -d redis
docker compose run --rm -T --no-deps redis \
    sh -c "until redis-cli -a \${REDIS_PASSWORD:-changeme-redis-password} ping 2>/dev/null | grep -q PONG; do sleep 1; done"
ok "Redis listo"

log "2/5 ZAP (en background — puede tardar ~60s)..."
docker compose up -d zap
ok "ZAP iniciando"

log "3/5 Labs de seguridad..."
docker compose up -d dvwa-db
sleep 5
docker compose up -d dvwa webgoat juice-shop
ok "Labs iniciando"

log "4/5 Metasploit (en background — puede tardar ~2min)..."
docker compose up -d msfrpcd
ok "Metasploit iniciando"

log "5/5 Backend API y Frontend..."
docker compose up -d api sqlmapapi
sleep 10
docker compose up -d frontend
ok "API y Frontend iniciados"

# ── 5. Verificación ───────────────────────────────────────────────────
header "Verificando estado"

MAX_WAIT=60
ELAPSED=0
log "Esperando que la API esté lista (máx ${MAX_WAIT}s)..."
until curl -sf http://localhost:5000/api/health | grep -q healthy; do
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        error "API no respondió en ${MAX_WAIT}s — revisa: docker compose logs api"
        break
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
done
ok "API respondiendo en ${ELAPSED}s"

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  SecureScan Pro — Todo listo 🚀        ${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}    http://localhost:3000"
echo -e "  ${CYAN}API:${NC}         http://localhost:5000/api/health"
echo -e "  ${CYAN}Juice Shop:${NC}  http://localhost:3001"
echo -e "  ${CYAN}DVWA:${NC}        http://localhost:3002"
echo -e "  ${CYAN}WebGoat:${NC}     http://localhost:3003"
echo ""
echo -e "  Comandos útiles:"
echo -e "    ${YELLOW}docker compose logs -f api${NC}      # Logs del backend"
echo -e "    ${YELLOW}docker compose logs -f frontend${NC} # Logs del frontend"
echo -e "    ${YELLOW}docker compose down${NC}             # Parar todo"
echo -e "    ${YELLOW}bash verify.sh${NC}                  # Verificar estado"
echo ""
