#!/bin/sh
# ============================================================
# SecureScan Pro — entrypoint.sh
# Inicialización robusta antes de arrancar gunicorn
# ============================================================
set -e
echo "═══ SecureScan Pro — Inicializando backend ═══"

# 0. Corregir permisos — necesario cuando se monta ./server:/app
# como volumen, ya que Git no preserva permisos de lectura para otros
echo "  ✓ Corrigiendo permisos de /app..."
find /app -not -path "*/reports*" -exec chmod o+r {} \; 2>/dev/null || true

# 1. Verificar herramientas esenciales
for tool in nmap nuclei gobuster ffuf sqlmap searchsploit; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "  ✓ $tool disponible"
    else
        echo "  ⚠ $tool NO encontrado — se usará simulación"
    fi
done
# 2. Verificar directorio de reportes
mkdir -p /app/reports
echo "  ✓ Directorio de reportes: /app/reports"
# 3. Verificar templates de nuclei
if [ -d "/home/scanner/nuclei-templates" ]; then
    COUNT=$(find /home/scanner/nuclei-templates -name "*.yaml" 2>/dev/null | wc -l)
    echo "  ✓ Nuclei templates: $COUNT archivos"
else
    echo "  ⚠ Nuclei templates no encontradas — nuclei usará descarga automática"
fi
# 4. Verificar PDF support
if command -v wkhtmltopdf >/dev/null 2>&1; then
    echo "  ✓ wkhtmltopdf disponible — reportes PDF habilitados"
else
    echo "  ⚠ wkhtmltopdf no disponible — reportes PDF deshabilitados"
fi
echo "═══ Listo — arrancando gunicorn ═══"
# Ejecutar el CMD pasado como argumentos
exec "$@"
