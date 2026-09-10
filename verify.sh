#!/bin/bash
# ============================================================
# SecureScan Pro v3.0 — Verificación completa del sistema
# ============================================================
echo "═══ SecureScan Pro v3.0 — Verificación ═══"
PASS=0; FAIL=0

check() {
    if eval "$2" &>/dev/null; then
        echo "  ✓ $1"
        ((PASS++))
    else
        echo "  ✗ $1"
        ((FAIL++))
    fi
}

echo ""
echo "── Contenedores ──"
check "securescan-api"       "docker compose ps api        | grep -q healthy"
check "securescan-frontend"  "docker compose ps frontend   | grep -q healthy"
check "securescan-redis"     "docker compose ps redis      | grep -q healthy"
check "securescan-zap"       "docker compose ps zap        | grep -q Up"
check "securescan-sqlmapapi" "docker compose ps sqlmapapi  | grep -q Up"
check "juice-shop"           "docker compose ps juice-shop | grep -q Up"
check "dvwa"                 "docker compose ps dvwa       | grep -q Up"
check "webgoat"              "docker compose ps webgoat    | grep -q Up"
check "msfrpcd"              "docker compose ps msfrpcd    | grep -q Up"

echo ""
echo "── Backend API ──"
check "Health endpoint"      "curl -sf http://localhost:5000/api/health | grep -q healthy"
check "Config endpoint"      "curl -sf http://localhost:5000/api/config | grep -q wappalyzer"
check "History endpoint"     "curl -sf http://localhost:5000/api/history | grep -q scans"

echo ""
echo "── Frontend ──"
check "Frontend en :3000"    "curl -sf -o /dev/null http://localhost:3000"

echo ""
echo "── Labs ──"
check "Juice Shop :3001"     "curl -sf -o /dev/null http://localhost:3001"
check "DVWA :3002"           "curl -sf -o /dev/null -L http://localhost:3002"
check "WebGoat :3003"        "curl -sf -o /dev/null http://localhost:3003/WebGoat/"

echo ""
echo "── ZAP ──"
check "ZAP API :8080"        "curl -sf 'http://localhost:8080/JSON/core/view/version/?apikey=${ZAP_API_KEY:-securescan-dev-key-2024}' | grep -q version"

echo ""
echo "── Herramientas dentro del contenedor API ──"
check "nmap"                 "docker compose exec api which nmap"
check "searchsploit"         "docker compose exec api which searchsploit"
check "nuclei"               "docker compose exec api which nuclei"
check "sqlmap"               "docker compose exec api which sqlmap"
check "patator"              "docker compose exec api which patator"
check "ffuf"                 "docker compose exec api which ffuf"
check "gobuster"             "docker compose exec api which gobuster"
check "wkhtmltopdf"          "docker compose exec api which wkhtmltopdf"

echo ""
echo "── Redis ──"
check "Redis ping"           "docker compose exec redis redis-cli -a \${REDIS_PASSWORD:-changeme-redis-password} ping | grep -q PONG"

echo ""
echo "══ Resultado: $PASS ✓  $FAIL ✗ ══"
if [ $FAIL -eq 0 ]; then
    echo "🟢 Todo OK — SecureScan Pro listo para usar"
else
    echo "🔴 Hay $FAIL problema(s) — revisa los ✗ de arriba"
    echo ""
    echo "Comandos útiles para reparar:"
    echo "  docker compose logs -f api         ← ver errores del backend"
    echo "  docker compose logs -f frontend    ← ver errores del frontend"
    echo "  docker compose restart <servicio>  ← reiniciar un servicio"
    echo "  docker compose up -d --build       ← rebuild completo"
fi
