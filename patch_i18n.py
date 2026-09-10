#!/usr/bin/env python3
"""
patch_i18n.py — SecureScan Pro
Aplica i18n completo al backend:
  1. Añade claves faltantes a server/locales/en.json y es.json
  2. Reemplaza strings hardcodeados en server/app.py por llamadas a get_t()
"""

import json
import re
import sys
from pathlib import Path

# ── Rutas ─────────────────────────────────────────────────────────────────────
ROOT      = Path(__file__).parent
APP_PY    = ROOT / 'server' / 'app.py'
EN_JSON   = ROOT / 'server' / 'locales' / 'en.json'
ES_JSON   = ROOT / 'server' / 'locales' / 'es.json'

for p in [APP_PY, EN_JSON, ES_JSON]:
    if not p.exists():
        print(f'❌ No encontrado: {p}')
        sys.exit(1)

# ── 1. Claves a añadir a los JSONs ────────────────────────────────────────────
NEW_KEYS = {
    'en': {
        'errors': {
            'invalidFormat':    'Invalid scan ID format',
            'scanNotCompleted': 'Scan not completed yet',
            'historyFailed':    'Failed to retrieve scan history',
        }
    },
    'es': {
        'errors': {
            'invalidFormat':    'Formato de ID de escaneo inválido',
            'scanNotCompleted': 'El escaneo aún no ha finalizado',
            'historyFailed':    'Error al obtener el historial de escaneos',
        }
    },
}

def patch_json(path: Path, new_keys: dict) -> bool:
    data = json.loads(path.read_text(encoding='utf-8'))
    changed = False
    for section, keys in new_keys.items():
        if section not in data:
            data[section] = {}
        for k, v in keys.items():
            if k not in data[section]:
                data[section][k] = v
                changed = True
                print(f'  + {path.name}: {section}.{k} = "{v}"')
            else:
                print(f'  ✓ {path.name}: {section}.{k} ya existe')
    if changed:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8'
        )
    return changed

print('\n── Paso 1: Actualizar JSONs de traducción ──────────────────────────')
patch_json(EN_JSON, NEW_KEYS['en'])
patch_json(ES_JSON, NEW_KEYS['es'])

# ── 2. Reemplazos en app.py ───────────────────────────────────────────────────
# Cada entrada: (patrón_exacto, reemplazo)
# Usamos _t() como helper local para no repetir get_t(locale_from_request(request))
# Se añade el helper al inicio del archivo si no existe.

REPLACEMENTS = [
    # Invalid scan ID format (aparece 3 veces, en líneas 890, 902, 942)
    (
        "return jsonify({'error': 'Invalid scan ID format'}), 400",
        "return jsonify({'error': _t('errors.invalidFormat')}), 400",
    ),
    # Scan not completed yet
    (
        "return jsonify({'error': 'Scan not completed yet', 'status': scan.get('status')}), 400",
        "return jsonify({'error': _t('errors.scanNotCompleted'), 'status': scan.get('status')}), 400",
    ),
    # Format not allowed
    (
        "return jsonify({'error': f'Format not allowed. Use: {allowed_formats}'}), 400",
        "return jsonify({'error': _t('errors.formatNotAllowed', formats=', '.join(allowed_formats))}), 400",
    ),
    # Report generation failed
    (
        "return jsonify({'error': 'Report generation failed'}), 500",
        "return jsonify({'error': _t('errors.reportFailed')}), 500",
    ),
    # Failed to retrieve scan history
    (
        "return jsonify({'error': 'Failed to retrieve scan history'}), 500",
        "return jsonify({'error': _t('errors.historyFailed')}), 500",
    ),
    # Docker not available (aparece 3 veces)
    (
        "return jsonify({'error': 'Docker not available'}), 500",
        "return jsonify({'error': _t('errors.dockerUnavailable')}), 500",
    ),
    # Lab not found (aparece 2 veces)
    (
        "return jsonify({'error': 'Lab not found'}), 404",
        "return jsonify({'error': _t('errors.labNotFound')}), 404",
    ),
]

# Helper _t() que se inyectará si no existe en el archivo
HELPER_SNIPPET = '''
def _t(key: str, **kwargs) -> str:
    """Shorthand: traduce key al locale de la request actual."""
    return get_t(locale_from_request(request))(key, **kwargs)
'''

print('\n── Paso 2: Parchear server/app.py ──────────────────────────────────')
source = APP_PY.read_text(encoding='utf-8')
original = source

# Añadir helper _t() si no existe
if 'def _t(' not in source:
    # Insertar justo después de los imports de i18n_backend
    marker = 'from server.utils.i18n_backend import get_t, locale_from_request'
    if marker in source:
        source = source.replace(marker, marker + '\n' + HELPER_SNIPPET, 1)
        print('  + Añadido helper _t() tras imports de i18n_backend')
    else:
        # Fallback: insertar antes de "app = Flask"
        source = source.replace('app = Flask(__name__)', HELPER_SNIPPET + '\napp = Flask(__name__)', 1)
        print('  + Añadido helper _t() antes de app = Flask(...)')
else:
    print('  ✓ Helper _t() ya existe')

# Aplicar reemplazos
for old, new in REPLACEMENTS:
    count = source.count(old)
    if count == 0:
        print(f'  ? No encontrado (¿ya parcheado?): {old[:60]}...')
    else:
        source = source.replace(old, new)
        print(f'  + ({count}x) {old[:55]}...')
        print(f'         → {new[:55]}...')

# Guardar solo si hubo cambios
if source != original:
    APP_PY.write_text(source, encoding='utf-8')
    print('\n✅ server/app.py actualizado.')
else:
    print('\n✓ server/app.py sin cambios (ya estaba parcheado).')

# ── 3. Verificación rápida ────────────────────────────────────────────────────
print('\n── Paso 3: Verificación ────────────────────────────────────────────')
result = APP_PY.read_text(encoding='utf-8')
remaining = re.findall(r"jsonify\(\{'error': '[^']+'\}\)", result)
# Filtrar los que ya usan _t() o get_t()
hardcoded = [r for r in remaining if '_t(' not in r and 'get_t(' not in r]

if hardcoded:
    print(f'⚠️  Strings hardcodeados restantes ({len(hardcoded)}):')
    for h in hardcoded:
        print(f'   {h}')
else:
    print('✅ No quedan strings de error hardcodeados en inglés.')

# Verificar claves en JSONs
for path, lang in [(EN_JSON, 'en'), (ES_JSON, 'es')]:
    data = json.loads(path.read_text(encoding='utf-8'))
    errors = data.get('errors', {})
    expected = ['invalidFormat', 'scanNotCompleted', 'historyFailed',
                'formatNotAllowed', 'reportFailed', 'dockerUnavailable', 'labNotFound']
    missing = [k for k in expected if k not in errors]
    if missing:
        print(f'⚠️  {lang}.json — claves faltantes: {missing}')
    else:
        print(f'✅ {lang}.json — todas las claves presentes')

print('\n✅ Patch completo. Ejecuta el script de verificación para confirmar.')