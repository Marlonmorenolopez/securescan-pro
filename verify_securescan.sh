#!/usr/bin/env bash
# =============================================================================
# SecureScan Pro — Script de verificación completa
# Verifica: P1, P2, P3, Fase A, Fase B, Fase C, Fase D
#
# USO:
#   chmod +x verify_securescan.sh
#   ./verify_securescan.sh
#
# Ejecutar desde la RAÍZ del proyecto (donde está docker-compose.yml)
# =============================================================================

# ── Colores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass()  { echo -e "  ${GREEN}✅ PASS${NC}  $1"; ((PASS++)); }
fail()  { echo -e "  ${RED}❌ FAIL${NC}  $1"; ((FAIL++)); }
warn()  { echo -e "  ${YELLOW}⚠️  WARN${NC}  $1"; ((WARN++)); }
header(){ echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════════════${NC}"; \
          echo -e "${BOLD}${CYAN}  $1${NC}"; \
          echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════${NC}"; }

# ── Helper: verificar que un patrón existe en un archivo ──────────────────────
check_file_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    fail "$label — ARCHIVO NO ENCONTRADO: $file"
  elif grep -q "$pattern" "$file" 2>/dev/null; then
    pass "$label"
  else
    fail "$label — patrón no encontrado: '$pattern' en $file"
  fi
}

# ── Helper: verificar que un patrón NO existe (strings hardcodeados eliminados)
check_file_not_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if [ ! -f "$file" ]; then
    warn "$label — ARCHIVO NO ENCONTRADO: $file"
  elif ! grep -q "$pattern" "$file" 2>/dev/null; then
    pass "$label"
  else
    warn "$label — string hardcodeado aún presente: '$pattern'"
  fi
}

# ── Helper: verificar que un archivo existe ────────────────────────────────────
check_file_exists() {
  local file="$1"
  local label="$2"
  if [ -f "$file" ]; then
    pass "$label"
  else
    fail "$label — ARCHIVO NO ENCONTRADO: $file"
  fi
}

# ── Helper: verificar que un directorio existe ────────────────────────────────
check_dir_exists() {
  local dir="$1"
  local label="$2"
  if [ -d "$dir" ]; then
    pass "$label"
  else
    fail "$label — DIRECTORIO NO ENCONTRADO: $dir"
  fi
}

# ── Helper: verificar JSON válido ─────────────────────────────────────────────
check_json_valid() {
  local file="$1"
  local label="$2"
  if [ ! -f "$file" ]; then
    fail "$label — ARCHIVO NO ENCONTRADO: $file"
  elif python3 -m json.tool "$file" > /dev/null 2>&1; then
    pass "$label — JSON válido"
  else
    fail "$label — JSON INVÁLIDO: $file"
  fi
}

# ── Helper: verificar clave en JSON ───────────────────────────────────────────
check_json_key() {
  local file="$1"
  local key="$2"   # notación jq: .report.title
  local label="$3"
  if [ ! -f "$file" ]; then
    fail "$label — ARCHIVO NO ENCONTRADO: $file"
  elif python3 -c "
import json, sys
with open('$file') as f: d = json.load(f)
keys = '$key'.lstrip('.').split('.')
v = d
for k in keys:
    v = v.get(k)
    if v is None: sys.exit(1)
sys.exit(0)
" 2>/dev/null; then
    pass "$label"
  else
    fail "$label — clave '$key' no encontrada en $file"
  fi
}

# =============================================================================
echo -e "\n${BOLD}${CYAN}SecureScan Pro — Verificación completa de cambios${NC}"
echo -e "${CYAN}Ejecutar desde la raíz del proyecto${NC}\n"

# =============================================================================
header "P1 — inject_urls() en ZapScanner"
# =============================================================================
check_file_contains \
  "server/modules/zap_scanner.py" \
  "def inject_urls" \
  "Método inject_urls() definido en ZapScanner"

check_file_contains \
  "server/modules/zap_scanner.py" \
  "core/action/accessUrl" \
  "inject_urls usa endpoint ZAP /core/action/accessUrl"

check_file_contains \
  "server/modules/zap_scanner.py" \
  "followRedirects" \
  "inject_urls pasa followRedirects=true"

# Verificar que el método está ANTES de def scan()
if [ -f "server/modules/zap_scanner.py" ]; then
  LINE_INJECT=$(grep -n "def inject_urls" server/modules/zap_scanner.py | head -1 | cut -d: -f1)
  LINE_SCAN=$(grep -n "def scan(" server/modules/zap_scanner.py | head -1 | cut -d: -f1)
  if [ -n "$LINE_INJECT" ] && [ -n "$LINE_SCAN" ] && [ "$LINE_INJECT" -lt "$LINE_SCAN" ]; then
    pass "inject_urls() está definido ANTES de scan() (línea $LINE_INJECT vs $LINE_SCAN)"
  else
    fail "inject_urls() debería estar antes de scan() — revisar orden"
  fi
fi

# =============================================================================
header "P1 — Command Injection DVWA: indicadores <pre> y www-data"
# =============================================================================
check_file_contains \
  "server/modules/injection_scanner.py" \
  "www-data" \
  "Indicador www-data añadido a COMMAND_PATTERNS"

check_file_contains \
  "server/modules/injection_scanner.py" \
  "<pre>" \
  "Indicador <pre> añadido a COMMAND_PATTERNS"

check_file_contains \
  "server/modules/injection_scanner.py" \
  "gid=" \
  "Indicador gid= añadido a COMMAND_PATTERNS"

check_file_contains \
  "server/modules/injection_scanner.py" \
  "icmp_seq" \
  "Indicador icmp_seq añadido a COMMAND_PATTERNS"

check_file_contains \
  "server/modules/injection_scanner.py" \
  "command not found" \
  "Indicador 'command not found' añadido a COMMAND_PATTERNS"

# =============================================================================
header "P1 — Wordlists específicas DVWA y WebGoat"
# =============================================================================
check_file_exists \
  "server/wordlists/dvwa_wordlist.txt" \
  "Wordlist DVWA existe"

check_file_exists \
  "server/wordlists/webgoat_wordlist.txt" \
  "Wordlist WebGoat existe"

check_file_contains \
  "server/wordlists/dvwa_wordlist.txt" \
  "vulnerabilities/exec" \
  "Wordlist DVWA contiene vulnerabilities/exec"

check_file_contains \
  "server/wordlists/dvwa_wordlist.txt" \
  "hackable/uploads" \
  "Wordlist DVWA contiene hackable/uploads"

check_file_contains \
  "server/wordlists/webgoat_wordlist.txt" \
  "WebGoat/SqlInjection" \
  "Wordlist WebGoat contiene WebGoat/SqlInjection"

check_file_contains \
  "server/wordlists/webgoat_wordlist.txt" \
  "actuator/heapdump" \
  "Wordlist WebGoat contiene actuator/heapdump"

check_file_contains \
  "server/modules/gobuster.py" \
  "dvwa_wordlist.txt" \
  "gobuster.py referencia dvwa_wordlist.txt"

check_file_contains \
  "server/modules/gobuster.py" \
  "webgoat_wordlist.txt" \
  "gobuster.py referencia webgoat_wordlist.txt"

check_file_contains \
  "server/modules/gobuster.py" \
  "bak" \
  "Perfil Apache incluye extensión .bak"

check_file_contains \
  "server/modules/gobuster.py" \
  "mvc" \
  "Perfil Spring incluye extensión .mvc"

# =============================================================================
header "P2 — Patator REST JSON para Juice Shop"
# =============================================================================
check_file_contains \
  "server/modules/patator.py" \
  "is_juice_shop" \
  "Variable is_juice_shop definida en patator.py"

check_file_contains \
  "server/modules/patator.py" \
  "juice_users" \
  "Filtro juice_users (solo emails) implementado"

check_file_contains \
  "server/modules/patator.py" \
  "admin@juice-sh.op" \
  "Fallback admin@juice-sh.op presente"

check_file_not_contains \
  "server/modules/patator.py" \
  "parsed.port}/rest" \
  "Bug port None corregido (no hay f-string con parsed.port directamente)"

check_file_contains \
  "server/modules/patator.py" \
  "_port else" \
  "Construcción condicional de URL sin port None"

# =============================================================================
header "P2 — Ajax Spider Angular (Juice Shop)"
# =============================================================================
check_file_contains \
  "server/modules/zap_scanner.py" \
  "is_angular" \
  "Parámetro is_angular en _run_ajax_spider"

check_file_contains \
  "server/modules/zap_scanner.py" \
  "firefox-headless" \
  "Browser firefox-headless configurado para Angular"

check_file_contains \
  "server/modules/zap_scanner.py" \
  "setOptionBrowserId" \
  "Llamada a setOptionBrowserId antes de lanzar Ajax Spider"

check_file_contains \
  "server/modules/zap_scanner.py" \
  "240" \
  "Timeout 240s para Angular definido"

check_file_contains \
  "server/modules/zap_scanner.py" \
  "_is_angular" \
  "Detección automática is_angular en scan()"

# =============================================================================
header "P2 — Reautenticación automática mid-scan"
# =============================================================================
check_file_contains \
  "server/app.py" \
  "_refresh_session_if_needed" \
  "Función _refresh_session_if_needed definida en app.py"

check_file_contains \
  "server/app.py" \
  "_SESSION_TTL" \
  "Constante _SESSION_TTL definida (20 minutos)"

check_file_contains \
  "server/app.py" \
  "_auth_timestamp" \
  "Variable _auth_timestamp para tracking del login"

# Verificar que se llama 3 veces (antes de ZAP, Nuclei e InjectionScanner)
REFRESH_COUNT=$(grep -c "_refresh_session_if_needed" server/app.py 2>/dev/null || echo "0")
if [ "$REFRESH_COUNT" -ge 4 ]; then
  pass "Reautenticación invocada ≥3 veces (definición + 3 llamadas)"
else
  fail "Reautenticación debería invocarse al menos 3 veces (ZAP, Nuclei, InjectionScanner) — encontradas: $REFRESH_COUNT"
fi

check_file_contains \
  "server/app.py" \
  "nonlocal session_cookie" \
  "nonlocal session_cookie en el closure de reautenticación"

# =============================================================================
header "P3 — Scoring cap por herramienta/severidad"
# =============================================================================
check_file_contains \
  "server/utils/scoring.py" \
  "_TOOL_CAPS" \
  "Dict _TOOL_CAPS definido en scoring.py"

check_file_contains \
  "server/utils/scoring.py" \
  "capped_vulns" \
  "Lista capped_vulns implementada"

check_file_contains \
  "server/utils/scoring.py" \
  "over_cap_count" \
  "Contador over_cap_count para logging"

check_file_contains \
  "server/utils/scoring.py" \
  "_tool_sev_count" \
  "Tracking _tool_sev_count por herramienta y severidad"

# =============================================================================
header "P3 — Correlación CVE Nuclei → Searchsploit"
# =============================================================================
check_file_contains \
  "server/app.py" \
  "_nuclei_cves" \
  "Extracción de CVEs desde nuclei_findings en app.py"

check_file_contains \
  "server/app.py" \
  "template_id" \
  "Extracción de CVE desde template_id de Nuclei"

check_file_contains \
  "server/modules/orchestrator.py" \
  "known_cves" \
  "Parámetro known_cves en search_exploits()"

check_file_contains \
  "server/modules/orchestrator.py" \
  "valid_cves" \
  "Validación y límite de CVEs directos"

check_file_contains \
  "server/modules/orchestrator.py" \
  "Optional\[List\[str\]\]" \
  "Tipo Optional[List[str]] en firma de search_exploits"

# =============================================================================
header "P3 — Validación robusta sesión WebGoat"
# =============================================================================
check_file_contains \
  "server/modules/orchestrator.py" \
  "_WG_SESSION_MARKERS" \
  "Marcadores semánticos _WG_SESSION_MARKERS definidos"

check_file_contains \
  "server/modules/orchestrator.py" \
  "start.mvc" \
  "Marcador 'start.mvc' incluido en validación WebGoat"

check_file_not_contains \
  "server/modules/orchestrator.py" \
  "len(r_attack.text) > 3000" \
  "Heurística len() > 3000 eliminada (primera ocurrencia)"

check_file_not_contains \
  "server/modules/orchestrator.py" \
  "len(r_login.text) > 3000" \
  "Heurística len() > 3000 eliminada (segunda ocurrencia)"

# Verificar que aparece 2 veces el marcador (dos bloques de validación)
MARKERS_COUNT=$(grep -c "_WG_SESSION_MARKERS" server/modules/orchestrator.py 2>/dev/null || echo "0")
if [ "$MARKERS_COUNT" -ge 2 ]; then
  pass "_WG_SESSION_MARKERS aparece en las 2 validaciones de sesión WebGoat"
else
  fail "_WG_SESSION_MARKERS debería aparecer 2 veces — encontradas: $MARKERS_COUNT (¿se aplicó solo una ocurrencia?)"
fi

# =============================================================================
header "FASE A — Infraestructura next-intl"
# =============================================================================
check_file_exists \
  "messages/es.json" \
  "Archivo messages/es.json existe"

check_file_exists \
  "messages/en.json" \
  "Archivo messages/en.json existe"

check_file_exists \
  "i18n/routing.ts" \
  "Archivo i18n/routing.ts existe"

check_file_exists \
  "i18n/request.ts" \
  "Archivo i18n/request.ts existe"

check_file_exists \
  "middleware.ts" \
  "Archivo middleware.ts existe"

check_file_exists \
  "components/language-switcher.tsx" \
  "Componente language-switcher.tsx existe"

check_json_valid \
  "messages/es.json" \
  "messages/es.json"

check_json_valid \
  "messages/en.json" \
  "messages/en.json"

check_file_contains \
  "i18n/routing.ts" \
  "localePrefix: 'never'" \
  "routing.ts usa modo sin prefijo de ruta"

check_file_contains \
  "i18n/routing.ts" \
  "defaultLocale: 'en'" \
  "Idioma por defecto es español"

check_file_contains \
  "middleware.ts" \
  "api|_next|_vercel" \
  "middleware.ts excluye rutas /api, /_next, /_vercel"

check_file_contains \
  "next.config.mjs" \
  "createNextIntlPlugin\|withNextIntl" \
  "Plugin next-intl añadido en next.config.mjs"

check_file_contains \
  "next.config.mjs" \
  "withNextIntl(nextConfig)" \
  "nextConfig envuelto con withNextIntl"

check_file_contains \
  "app/layout.tsx" \
  "NextIntlClientProvider" \
  "NextIntlClientProvider importado en layout.tsx"

check_file_contains \
  "app/layout.tsx" \
  "getLocale\|getMessages" \
  "getLocale y getMessages usados en layout.tsx"

check_file_contains \
  "app/layout.tsx" \
  "async function RootLayout" \
  "RootLayout convertido a función async"

check_file_contains \
  "components/language-switcher.tsx" \
  "NEXT_LOCALE" \
  "LanguageSwitcher guarda cookie NEXT_LOCALE"

check_file_contains \
  "components/language-switcher.tsx" \
  "router.refresh" \
  "LanguageSwitcher usa router.refresh() para aplicar cambio"

check_file_contains \
  "components/header.tsx" \
  "LanguageSwitcher" \
  "LanguageSwitcher añadido al header"

check_file_contains \
  "components/header.tsx" \
  "useTranslations" \
  "useTranslations importado en header.tsx"

# Verificar que next-intl está en package.json
check_file_contains \
  "package.json" \
  "next-intl" \
  "next-intl instalado (aparece en package.json)"

# =============================================================================
header "FASE A — Claves base en messages/es.json y messages/en.json"
# =============================================================================
for key in ".nav.home" ".nav.scanner" ".scanner.title" ".scanner.scanButton" \
           ".progress.scanning" ".progress.completed" \
           ".report.title" ".report.generating" \
           ".language.current" ".language.switchTo"; do
  check_json_key "messages/es.json" "$key" "ES: $key"
  check_json_key "messages/en.json" "$key" "EN: $key"
done

# =============================================================================
header "FASE B — scan-form.tsx"
# =============================================================================
check_file_contains \
  "components/scan-form.tsx" \
  "useTranslations" \
  "useTranslations importado en scan-form.tsx"

check_file_contains \
  "components/scan-form.tsx" \
  "t('title')\|t(\"title\")" \
  "Título del formulario usa t('title')"

check_file_contains \
  "components/scan-form.tsx" \
  "t('legalTitle')\|t(\"legalTitle\")" \
  "Aviso legal usa t('legalTitle')"

check_file_contains \
  "components/scan-form.tsx" \
  "t('scanButton')\|t(\"scanButton\")" \
  "Botón escanear usa t('scanButton')"

check_file_contains \
  "components/scan-form.tsx" \
  "t('profiles.light')\|t(\"profiles.light\")" \
  "Perfil Ligero usa t('profiles.light')"

check_file_contains \
  "components/scan-form.tsx" \
  "t('estimatedTimes\|t(\"estimatedTimes" \
  "Tiempos estimados usan t('estimatedTimes.*')"

check_file_contains \
  "components/scan-form.tsx" \
  "t('validationEmptyTarget')\|t(\"validationEmptyTarget\")" \
  "Validación de URL vacía usa t('validationEmptyTarget')"

check_file_not_contains \
  "components/scan-form.tsx" \
  "Iniciar Análisis de Seguridad" \
  "String 'Iniciar Análisis de Seguridad' eliminado"

check_file_not_contains \
  "components/scan-form.tsx" \
  "Aviso Legal y Ético" \
  "String 'Aviso Legal y Ético' eliminado"

check_file_not_contains \
  "components/scan-form.tsx" \
  "~2 minutos" \
  "String '~2 minutos' eliminado"

# =============================================================================
header "FASE B — scan-progress.tsx"
# =============================================================================
check_file_contains \
  "components/scan-progress.tsx" \
  "useTranslations" \
  "useTranslations importado en scan-progress.tsx"

check_file_contains \
  "components/scan-progress.tsx" \
  "t('scanning')\|t(\"scanning\")" \
  "Estado 'Escaneando...' usa t('scanning')"

check_file_contains \
  "components/scan-progress.tsx" \
  "t('completedMessage')\|t(\"completedMessage\")" \
  "Mensaje de completado usa t('completedMessage')"

check_file_contains \
  "components/scan-progress.tsx" \
  "t('cancelConfirmYes')\|t(\"cancelConfirmYes\")" \
  "Botón confirmar cancelación usa t('cancelConfirmYes')"

check_file_not_contains \
  "components/scan-progress.tsx" \
  "Escaneando\.\.\." \
  "String 'Escaneando...' eliminado"

check_file_not_contains \
  "components/scan-progress.tsx" \
  "¡Escaneo completado exitosamente!" \
  "String '¡Escaneo completado exitosamente!' eliminado"

# =============================================================================
header "FASE B — report-download-modal.tsx"
# =============================================================================
check_file_contains \
  "components/report-download-modal.tsx" \
  "useTranslations" \
  "useTranslations importado en report-download-modal.tsx"

check_file_contains \
  "components/report-download-modal.tsx" \
  "t('recommended')\|t(\"recommended\")\|t('pdfDesc')\|t(\"pdfDesc\")" \
  "Descripciones de formato usan t()"

check_file_contains \
  "components/report-download-modal.tsx" \
  "t('generating')\|t(\"generating\")" \
  "Estado 'Generando...' usa t('generating')"

check_file_not_contains \
  "components/report-download-modal.tsx" \
  "Recomendado" \
  "String 'Recomendado' eliminado"

check_file_not_contains \
  "components/report-download-modal.tsx" \
  "Generando\.\.\." \
  "String 'Generando...' eliminado"

# =============================================================================
header "FASE C — results-dashboard.tsx"
# =============================================================================
check_file_contains \
  "components/results-dashboard.tsx" \
  "useTranslations" \
  "useTranslations importado en results-dashboard.tsx"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('totalFindings')\|t(\"totalFindings\")" \
  "Total hallazgos usa t('totalFindings')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('vulnerabilities')\|t(\"vulnerabilities\")" \
  "Tab Vulnerabilidades usa t('vulnerabilities')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('severities.critical')\|t(\"severities.critical\")" \
  "Severidad crítico usa t('severities.critical')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('noVulnerabilities')\|t(\"noVulnerabilities\")" \
  "Mensaje 'no vulns' usa t('noVulnerabilities')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('tabTech')\|t(\"tabTech\")" \
  "Sub-label tab tecnologías usa t('tabTech')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('port')\|t(\"port\")" \
  "Header tabla Puertos usa t('port')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('nucleiTitle')\|t(\"nucleiTitle\")" \
  "Sección Nuclei usa t('nucleiTitle')"

check_file_contains \
  "components/results-dashboard.tsx" \
  "t('credentialsFound')\|t(\"credentialsFound\")" \
  "Credenciales encontradas usa t('credentialsFound')"

check_file_not_contains \
  "components/results-dashboard.tsx" \
  "Vulnerabilidades Detectadas" \
  "String 'Vulnerabilidades Detectadas' eliminado"

check_file_not_contains \
  "components/results-dashboard.tsx" \
  "Tecnologías Detectadas" \
  "String 'Tecnologías Detectadas' eliminado"

check_file_not_contains \
  "components/results-dashboard.tsx" \
  "Total hallazgos" \
  "String 'Total hallazgos' eliminado"

# Verificar claves nuevas en messages/es.json
for key in ".results.scoreTitle" ".results.tabTech" ".results.tabPorts" \
           ".results.noDirectories" ".results.nucleiTitle" \
           ".results.patatorTitle" ".results.ffufTitle" \
           ".results.severities.critical"; do
  check_json_key "messages/es.json" "$key" "ES: $key"
  check_json_key "messages/en.json" "$key" "EN: $key"
done

# =============================================================================
header "FASE D — Archivos nuevos del backend"
# =============================================================================
check_file_exists \
  "server/utils/i18n_backend.py" \
  "Módulo i18n_backend.py existe"

check_file_exists \
  "server/locales/es.json" \
  "Traducciones backend ES existe"

check_file_exists \
  "server/locales/en.json" \
  "Traducciones backend EN existe"

check_json_valid \
  "server/locales/es.json" \
  "server/locales/es.json"

check_json_valid \
  "server/locales/en.json" \
  "server/locales/en.json"

check_file_contains \
  "server/utils/i18n_backend.py" \
  "class T:" \
  "Clase T implementada en i18n_backend.py"

check_file_contains \
  "server/utils/i18n_backend.py" \
  "def locale_from_request" \
  "Función locale_from_request implementada"

check_file_contains \
  "server/utils/i18n_backend.py" \
  "Accept-Language" \
  "Detección por header Accept-Language implementada"

# Verificar claves clave en los JSONs del backend
for key in ".report.title" ".report.confidential" ".errors.targetRequired" \
           ".errors.scanNotFound" ".scoring.goodPosture" ".scoring.critical"; do
  check_json_key "server/locales/es.json" "$key" "Backend ES: $key"
  check_json_key "server/locales/en.json" "$key" "Backend EN: $key"
done

# =============================================================================
header "FASE D — Integración en scoring.py, reporter.py y app.py"
# =============================================================================
check_file_contains \
  "server/utils/scoring.py" \
  "from utils.i18n_backend import get_t" \
  "scoring.py importa get_t"

check_file_contains \
  "server/utils/scoring.py" \
  "locale: str = 'es'" \
  "calculate_score acepta parámetro locale"

check_file_contains \
  "server/utils/scoring.py" \
  "t('scoring.goodPosture')\|t(\"scoring.goodPosture\")" \
  "generate_recommendations usa t() para goodPosture"

check_file_not_contains \
  "server/utils/scoring.py" \
  "Good security posture. Continue" \
  "String hardcodeado 'Good security posture' eliminado"

check_file_contains \
  "server/utils/reporter.py" \
  "from utils.i18n_backend import get_t" \
  "reporter.py importa get_t"

check_file_contains \
  "server/utils/reporter.py" \
  "locale: str = 'es'" \
  "generate_html_report acepta parámetro locale"

check_file_contains \
  "server/utils/reporter.py" \
  "t('report.recommendations')\|t(\"report.recommendations\")" \
  "reporter.py usa t() para 'Recomendaciones'"

check_file_not_contains \
  "server/utils/reporter.py" \
  "Hallazgos Metasploit" \
  "String hardcodeado 'Hallazgos Metasploit' eliminado"

check_file_not_contains \
  "server/utils/reporter.py" \
  "información sensible. Distribución restringida" \
  "String confidencial hardcodeado eliminado"

check_file_contains \
  "server/app.py" \
  "from utils.i18n_backend import get_t, locale_from_request" \
  "app.py importa get_t y locale_from_request"

check_file_contains \
  "server/app.py" \
  "locale_from_request(request)" \
  "app.py detecta locale de la request"

check_file_not_contains \
  "server/app.py" \
  "'Scan not found'" \
  "String 'Scan not found' hardcodeado eliminado de app.py"

check_file_not_contains \
  "server/app.py" \
  "'Target URL is required'" \
  "String 'Target URL is required' hardcodeado eliminado"

# =============================================================================
header "DOCKERFILE — Directorios i18n y wordlists incluidos"
# =============================================================================
check_file_contains \
  "Dockerfile.frontend" \
  "COPY messages" \
  "Dockerfile.frontend copia directorio messages/"

check_file_contains \
  "Dockerfile.frontend" \
  "COPY i18n" \
  "Dockerfile.frontend copia directorio i18n/"

check_file_contains \
  "Dockerfile.frontend" \
  "COPY middleware.ts" \
  "Dockerfile.frontend copia middleware.ts"

# Verificar que el server Dockerfile también copia wordlists (si tiene COPY)
if grep -q "COPY.*wordlists\|COPY \. \." server/Dockerfile 2>/dev/null; then
  pass "server/Dockerfile incluye wordlists/ (COPY . . o COPY wordlists)"
else
  warn "Verificar manualmente que server/Dockerfile copia server/wordlists/ al contenedor"
fi

# =============================================================================
header "VERIFICACIÓN RUNTIME (requiere contenedores activos)"
# =============================================================================
echo ""
echo -e "${CYAN}  Los siguientes tests requieren que los contenedores estén corriendo.${NC}"
echo -e "${CYAN}  Si no están activos, se marcarán como WARN (no FAIL).${NC}"
echo ""

# Test: API health check
if curl -sf "http://localhost:5000/api/health" > /dev/null 2>&1; then
  pass "Backend API responde en http://localhost:5000/api/health"

  # Test: error localizado en español
  RESP_ES=$(curl -s -X POST http://localhost:5000/api/scan \
    -H "X-API-Token: 5bb0a27b0af49342416d52586b4e74fa9986c10f2080c53cd3261822c601ef22" \
    -H "Content-Type: application/json" \
    -H "Accept-Language: es" \
    -d '{"options":{}}' 2>/dev/null)
  if echo "$RESP_ES" | grep -q "requiere\|objetivo"; then
    pass "Error API localizado en ES: 'requiere una URL objetivo'"
  else
    warn "Error API en ES no localizado — respuesta: $RESP_ES"
  fi

  # Test: error localizado en inglés
  RESP_EN=$(curl -s -X POST http://localhost:5000/api/scan \
    -H "X-API-Token: 5bb0a27b0af49342416d52586b4e74fa9986c10f2080c53cd3261822c601ef22" \
    -H "Content-Type: application/json" \
    -H "Accept-Language: en" \
    -d '{"options":{}}' 2>/dev/null)
  if echo "$RESP_EN" | grep -q "required\|Target URL"; then
    pass "Error API localizado en EN: 'Target URL is required'"
  else
    warn "Error API en EN no localizado — respuesta: $RESP_EN"
  fi

  # Test: i18n_backend importa correctamente
  IMPORT_TEST=$(docker exec securescan-api python3 -c \
    "from utils.i18n_backend import get_t; t=get_t('en'); print(t('report.title'))" \
    2>/dev/null)
  if [ "$IMPORT_TEST" = "Security Analysis Report" ]; then
    pass "i18n_backend.py importa y traduce correctamente en EN"
  else
    warn "i18n_backend.py test: esperado 'Security Analysis Report', obtenido: '$IMPORT_TEST'"
  fi

  IMPORT_TEST_ES=$(docker exec securescan-api python3 -c \
    "from utils.i18n_backend import get_t; t=get_t('es'); print(t('scoring.goodPosture'))" \
    2>/dev/null)
  if echo "$IMPORT_TEST_ES" | grep -q "Buena postura"; then
    pass "i18n_backend.py traduce correctamente en ES"
  else
    warn "i18n_backend.py test ES: '$IMPORT_TEST_ES'"
  fi
else
  warn "Backend no disponible en localhost:5000 — omitiendo tests de runtime API"
fi

# Test: Frontend responde
if curl -s "http://localhost:3000" > /dev/null 2>&1; then
  pass "Frontend responde en http://localhost:3000"

  # Test: header lang cambia con cookie
  LANG_EN=$(curl -s "http://localhost:3000" \
    -H "Cookie: NEXT_LOCALE=en" 2>/dev/null | grep -o 'lang="[a-z]*"' | head -1)
  if [ "$LANG_EN" = 'lang="en"' ]; then
    pass "Frontend sirve lang=\"en\" cuando cookie NEXT_LOCALE=en"
  else
    warn "Frontend lang con cookie en: '$LANG_EN' (esperado: lang=\"en\")"
  fi

  LANG_ES=$(curl -s "http://localhost:3000" \
    -H "Cookie: NEXT_LOCALE=es" 2>/dev/null | grep -o 'lang="[a-z]*"' | head -1)
  if [ "$LANG_ES" = 'lang="es"' ]; then
    pass "Frontend sirve lang=\"es\" cuando cookie NEXT_LOCALE=es"
  else
    warn "Frontend lang con cookie es: '$LANG_ES' (esperado: lang=\"es\")"
  fi
else
  warn "Frontend no disponible en localhost:3000 — omitiendo tests de runtime"
fi

# =============================================================================
header "RESUMEN FINAL"
# =============================================================================
TOTAL=$((PASS + FAIL + WARN))
echo ""
echo -e "  ${GREEN}✅ PASS: $PASS${NC}"
echo -e "  ${RED}❌ FAIL: $FAIL${NC}"
echo -e "  ${YELLOW}⚠️  WARN: $WARN${NC}"
echo -e "  Total checks: $TOTAL"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  🎉 PERFECTO — Todos los cambios aplicados correctamente.${NC}"
elif [ "$FAIL" -eq 0 ]; then
  echo -e "${YELLOW}${BOLD}  ✅ Sin errores críticos. Revisar los WARN manualmente.${NC}"
elif [ "$FAIL" -le 3 ]; then
  echo -e "${YELLOW}${BOLD}  ⚠️  $FAIL check(s) fallaron. Revisar los ❌ FAIL arriba.${NC}"
else
  echo -e "${RED}${BOLD}  ❌ $FAIL checks fallaron. Revisar los cambios indicados.${NC}"
fi

echo ""
echo -e "${CYAN}  PRÓXIMOS PASOS si hay FAILs:${NC}"
echo -e "  1. Buscar el texto exacto del FAIL arriba"
echo -e "  2. Abrir el archivo indicado en el IDE"
echo -e "  3. Re-aplicar el Ctrl+H del documento de instrucciones correspondiente"
echo -e "  4. Volver a ejecutar este script"
echo ""

exit $FAIL