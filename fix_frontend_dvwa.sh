#!/bin/bash
# ============================================================
# SecureScan Pro — Fix Frontend + DVWA
# ============================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
log()  { echo -e "${CYAN}[fix]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
err()  { echo -e "${RED}  ✗${NC} $1"; }

echo -e "${BOLD}${CYAN}═══ SecureScan Pro — Reparando Frontend y DVWA ═══${NC}"
echo ""

# ── PROBLEMA 1: DVWA ─────────────────────────────────────────────────────────
echo -e "${BOLD}1. Diagnosticando DVWA...${NC}"
DVWA_STATUS=$(docker compose ps dvwa --format "{{.Status}}" 2>/dev/null)
DB_STATUS=$(docker compose ps dvwa-db --format "{{.Status}}" 2>/dev/null)
echo "   dvwa:    $DVWA_STATUS"
echo "   dvwa-db: $DB_STATUS"

# Ver últimas líneas del log de dvwa
DVWA_LOG=$(docker compose logs dvwa --tail=5 2>/dev/null)
if echo "$DVWA_LOG" | grep -qi "error\|failed\|cannot"; then
    warn "DVWA tiene errores — reiniciando base de datos primero"
    docker compose restart dvwa-db
    sleep 8
    docker compose restart dvwa
    sleep 5
else
    log "Reiniciando DVWA..."
    docker compose restart dvwa
    sleep 5
fi

# Verificar DVWA
if curl -sf -o /dev/null -L http://localhost:3002 2>/dev/null; then
    ok "DVWA OK en :3002"
else
    warn "DVWA tarda en arrancar — iniciando setup automático..."
    # Intentar setup via curl (inicializa la DB de DVWA)
    curl -sf -o /dev/null -L \
      "http://localhost:3002/setup.php?initdb=true" 2>/dev/null || true
    sleep 3
    if curl -sf -o /dev/null -L http://localhost:3002 2>/dev/null; then
        ok "DVWA OK tras setup"
    else
        err "DVWA sigue sin responder — revisa: docker compose logs dvwa"
    fi
fi
echo ""

# ── PROBLEMA 2: FRONTEND ─────────────────────────────────────────────────────
echo -e "${BOLD}2. Construyendo Frontend (Next.js)...${NC}"

# Verificar que existe el Dockerfile.frontend
if [ ! -f "Dockerfile.frontend" ]; then
    err "Dockerfile.frontend no encontrado en $(pwd)"
    echo "   Descárgalo desde el ZIP de correcciones y cópialo aquí."
    exit 1
fi
ok "Dockerfile.frontend encontrado"

# Verificar que existen los directorios del frontend
MISSING=""
for dir in app components lib hooks public; do
    [ ! -d "$dir" ] && MISSING="$MISSING $dir"
done
if [ -n "$MISSING" ]; then
    err "Directorios faltantes:$MISSING"
    exit 1
fi
ok "Directorios del frontend presentes"

# Limpiar imagen anterior si existe
log "Limpiando imagen anterior del frontend..."
docker compose rm -sf frontend 2>/dev/null || true

# Build del frontend
log "Ejecutando build (puede tardar 3-5 min la primera vez)..."
if docker compose build --no-cache frontend; then
    ok "Build completado"
else
    err "Build falló — revisa los errores de arriba"
    exit 1
fi

# Arrancar frontend
log "Arrancando frontend..."
docker compose up -d frontend

# Esperar a que el frontend esté listo
log "Esperando que el frontend responda (máx 60s)..."
ELAPSED=0
until curl -sf -o /dev/null http://localhost:3000 2>/dev/null; do
    if [ $ELAPSED -ge 60 ]; then
        err "Frontend no respondió en 60s"
        echo "   Logs: docker compose logs frontend"
        exit 1
    fi
    sleep 3
    ELAPSED=$((ELAPSED + 3))
done
ok "Frontend OK en :3000 (tardó ${ELAPSED}s)"

echo ""
echo -e "${BOLD}${GREEN}═══ Reparación completada ═══${NC}"
echo ""
echo -e "  ${CYAN}Frontend:${NC}   http://localhost:3000"
echo -e "  ${CYAN}DVWA:${NC}       http://localhost:3002"
echo ""
echo "Ejecuta 'bash verify.sh' para confirmar que todo está al 100%."
