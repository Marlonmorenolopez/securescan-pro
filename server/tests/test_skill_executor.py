"""
server/tests/test_skill_executor.py — SecureScan Pro v5.0 · Fase 1 + Fase 2 (Bloque 1)

Pruebas ligeras del motor universal de ejecución individual de Skills
(skill_execution_registry.py + skill_executor.py) y verificaciones estáticas
de regresión sobre server/app.py.

Deliberadamente usa solo `unittest` (stdlib) — el proyecto no tenía ningún
framework de tests instalado (no hay pytest en requirements.txt, no existía
ningún test_*.py antes de la Fase 1), y el encargo pide explícitamente no
introducir una dependencia pesada solo para esto.

Cómo correrlas:
    cd server && python3 -m unittest tests.test_skill_executor -v
    (o)  python3 server/tests/test_skill_executor.py

Alcance Fase 1 (Nmap) — corresponde 1:1 a los puntos A-H pedidos entonces:
    A. skill_id inexistente               -> TestSkillExecutor.test_unknown_skill_id
    B. Nmap sin subject                    -> TestSkillExecutor.test_nmap_missing_subject
    C. Nmap con subject válido             -> TestSkillExecutor.test_nmap_valid_subject_reaches_runner
    D. Dispatcher sin lógica de Nmap       -> TestSkillExecutor.test_executor_is_generic_no_hardcoded_skill
    E. Web Scan sigue usando run_nmap()    -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_nmap_directly
    F. El registry contiene Nmap           -> TestSkillExecutionRegistry.test_registry_contains_nmap
    G. Skill planned/no registrada         -> TestSkillExecutor.test_planned_skill_is_not_executable
    H. save_scan/get_scan no se tocaron    -> TestWebScanRegression.test_save_scan_get_scan_not_modified

Alcance Fase 2, Bloque 1 (Wappalyzer + Patator) — mismos puntos aplicados a
las 2 Skills nuevas:
    - Registro                    -> TestSkillExecutionRegistry.test_registry_contains_wappalyzer / _patator
    - Validación de subject        -> TestSkillExecutor.test_wappalyzer_missing_subject / test_patator_missing_subject
    - Ejecución vía runner real     -> TestSkillExecutor.test_wappalyzer_valid_subject_reaches_runner
                                       TestSkillExecutor.test_patator_valid_subject_reaches_runner_without_form_path
    - Parámetro opcional correcto   -> TestSkillExecutor.test_patator_valid_subject_with_explicit_form_path
    - Resultado retornado           -> los mismos tests de arriba comprueban el valor devuelto
    - Compatibilidad con Web Scan   -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_wappalyzer_and_run_patator_directly

Alcance Fase 2, Bloque 2 (ffuf + Nuclei) — mismos puntos, con el primer caso
real de una Skill con DOS `option` (ffuf: fuzz_path + cookie):
    - Registro                    -> TestSkillExecutionRegistry.test_registry_contains_ffuf / _nuclei
    - Validación de subject        -> TestSkillExecutor.test_ffuf_missing_subject / test_nuclei_missing_subject
    - Ejecución vía runner real     -> TestSkillExecutor.test_ffuf_valid_subject_uses_real_default_fuzz_path
                                       TestSkillExecutor.test_nuclei_valid_subject_without_cookie
    - Parámetros opcionales         -> TestSkillExecutor.test_ffuf_valid_subject_with_explicit_options
                                       TestSkillExecutor.test_nuclei_valid_subject_with_cookie
    - Compatibilidad con Web Scan   -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_ffuf_and_run_nuclei_directly

Alcance Fase 2, Bloque 3 (Gobuster) — además de los puntos de siempre, un
test de regresión específico sobre el BUG real corregido en
orchestrator.py::run_gobuster() antes de registrarla (el cookie mutaba un
atributo que GobusterScanner.scan() nunca leía; ahora se pasa como
`custom_headers`, igual que ffuf):
    - Registro                    -> TestSkillExecutionRegistry.test_registry_contains_gobuster
    - Validación de subject        -> TestSkillExecutor.test_gobuster_missing_subject
    - Ejecución vía runner real     -> TestSkillExecutor.test_gobuster_valid_subject_without_cookie
    - Cookie correcto (bug fix)     -> TestSkillExecutor.test_gobuster_valid_subject_with_cookie
    - Compatibilidad con Web Scan   -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_gobuster_directly
    - Regresión del bug corregido   -> TestWebScanRegression.test_run_gobuster_no_longer_mutates_shared_headers_attribute

Alcance Fase 2, Bloque 4 (Metasploit + Searchsploit) — primer caso real
(no sintético) de `dependencies`, y la corrección estructural
`subject_kwarg` en SkillInputSchema/SkillExecutor.run() que motivó:
    - Registro                    -> TestSkillExecutionRegistry.test_registry_contains_metasploit / _searchsploit
    - Validación de subject        -> TestSkillExecutor.test_metasploit_missing_subject / test_searchsploit_missing_subject
    - Dependencias: valor directo   -> TestSkillExecutor.test_metasploit_dependencies_as_direct_values
                                       TestSkillExecutor.test_searchsploit_dependencies_as_direct_values
    - Dependencias: from_job        -> TestSkillExecutor.test_metasploit_dependencies_from_previous_job
    - Dependencias ausentes         -> TestSkillExecutor.test_metasploit_valid_subject_without_dependencies
                                       TestSkillExecutor.test_searchsploit_dependencies_absent_default_to_empty_lists_not_none
    - subject_kwarg (bug motivador) -> TestSkillExecutor.test_searchsploit_subject_passed_as_named_target_not_positional
    - Compatibilidad con Web Scan   -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_metasploit_and_search_exploits_directly

Alcance Fase 2, Bloque 5 (ZAP) — primer caso real de resultado `Dict` (no
`List[Dict]`) y de runner que es cliente HTTP a un demonio externo, ninguno
de los dos exigió cambios al Executor:
    - Registro                    -> TestSkillExecutionRegistry.test_registry_contains_zap
    - Validación de subject        -> TestSkillExecutor.test_zap_missing_subject
    - Ejecución vía runner real     -> TestSkillExecutor.test_zap_valid_subject_uses_real_default_policy
    - Resultado Dict preservado     -> el mismo test de arriba comprueba la forma exacta del resultado
    - Parámetros opcionales         -> TestSkillExecutor.test_zap_valid_subject_with_explicit_policy_and_cookie
    - Compatibilidad con Web Scan   -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_zap_full_directly

NOTA sobre H: este sandbox no tiene instaladas las dependencias completas
del backend (redis, flask-cors, flask-limiter, celery, pymetasploit3 — ver
server/requirements.txt), así que `import app` no es viable aquí sin
instalar todo ese árbol de dependencias pesado, lo cual el propio encargo de
la Fase 1 pidió evitar. En su lugar, H se verifica de la única forma que no
requiere ese import: comprobando que las funciones save_scan/get_scan/
update_step/_persist_step_result de server/app.py NO fueron editadas (se
compara su código fuente exacto con un fingerprint tomado en la Fase 1 — el
Bloque 1 de la Fase 2 no las toca, así que el fingerprint sigue vigente).
"""

import ast
import dataclasses
import hashlib
import os
import re
import sys
import unittest

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

import skill_execution_registry as reg   # noqa: E402
import skill_executor as sx              # noqa: E402


class FakeOrchestrator:
    """Doble de prueba — NUNCA ejecuta nmap/wappalyzer/patator reales ni ninguna herramienta."""

    def __init__(self):
        self.calls = []

    def run_nmap(self, target, **kwargs):
        self.calls.append(('run_nmap', target, kwargs))
        return {'called_with': target, 'kwargs': kwargs}

    def run_wappalyzer(self, target, **kwargs):
        self.calls.append(('run_wappalyzer', target, kwargs))
        return [{'technology': 'nginx', 'version': '1.25', 'target': target}]

    def run_patator(self, target, form_path=None):
        self.calls.append(('run_patator', target, form_path))
        return [{'tool': 'patator', 'target': target, 'form_path': form_path, 'success': False}]

    def run_ffuf(self, target, fuzz_path='/FUZZ', cookie=None):
        self.calls.append(('run_ffuf', target, fuzz_path, cookie))
        return [{'tool': 'ffuf', 'target': target, 'fuzz_path': fuzz_path, 'cookie': cookie, 'status': 200}]

    def run_nuclei(self, target, cookie=None):
        self.calls.append(('run_nuclei', target, cookie))
        return [{'tool': 'nuclei', 'target': target, 'cookie': cookie, 'severity': 'info'}]

    def run_gobuster(self, target, cookie=None):
        self.calls.append(('run_gobuster', target, cookie))
        return [{'tool': 'gobuster', 'target': target, 'cookie': cookie, 'path': '/admin', 'status': 200}]

    def run_metasploit(self, target, ports=None, technologies=None):
        self.calls.append(('run_metasploit', target, ports, technologies))
        return {'target': target, 'ports': ports, 'technologies': technologies}

    def run_zap_full(self, target, policy='Default Policy', cookie=None):
        # Devuelve un Dict (no List[Dict]) a propósito -- es exactamente la
        # forma real de orchestrator.run_zap_full(), y el Executor debe
        # preservarla sin envolver ni aplanar.
        self.calls.append(('run_zap_full', target, policy, cookie))
        return {
            'urls_descubiertas': [f'{target}/login.php'],
            'vulnerabilidades': [{'risk': 'medium', 'name': 'X-Frame-Options missing'}],
            'tool': 'zap_full', 'success': True,
        }

    def search_exploits(self, technologies, ports, target='', known_cves=None):
        # Firma FIEL a orchestrator.py::search_exploits -- target es el
        # TERCER parámetro, no el primero. Si el Executor lo pasara
        # posicional (bug que motivó subject_kwarg), este doble lo
        # detectaría porque `technologies` recibiría el string del target
        # en vez de una lista, y las aserciones de abajo fallarían.
        self.calls.append(('search_exploits', technologies, ports, target, known_cves))
        return [{'tool': 'searchsploit', 'target': target, 'technologies': technologies, 'ports': ports}]


class TestSkillExecutionRegistry(unittest.TestCase):
    def test_registry_contains_nmap(self):
        # F. El registry contiene Nmap, apuntando al runner real (no a un duplicado)
        entry = reg.get_runner_entry('nmap')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_nmap')
        self.assertEqual(entry.schema.subject_kind, 'target_url')
        self.assertEqual(entry.schema.fields, [])

    def test_registry_contains_wappalyzer(self):
        # Fase 2, Bloque 1 — mismo patrón exacto que Nmap: sin campos propios.
        entry = reg.get_runner_entry('wappalyzer')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_wappalyzer')
        self.assertEqual(entry.schema.subject_kind, 'target_url')
        self.assertEqual(entry.schema.fields, [])

    def test_registry_contains_patator(self):
        # Fase 2, Bloque 1 — primer caso real con un `option` no requerido.
        entry = reg.get_runner_entry('patator')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_patator')
        self.assertEqual(entry.schema.subject_kind, 'target_url')
        self.assertEqual(len(entry.schema.fields), 1)
        form_path_field = entry.schema.fields[0]
        self.assertEqual(form_path_field.name, 'form_path')
        self.assertEqual(form_path_field.source, 'option')
        self.assertFalse(form_path_field.required)
        self.assertIsNone(form_path_field.default)

    def test_registry_contains_ffuf(self):
        # Fase 2, Bloque 2 — dos `option` no requeridos, con el default REAL
        # de orchestrator.run_ffuf (fuzz_path='/FUZZ'), no uno inventado.
        entry = reg.get_runner_entry('ffuf')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_ffuf')
        fields = {f.name: f for f in entry.schema.fields}
        self.assertEqual(set(fields.keys()), {'fuzz_path', 'cookie'})
        self.assertFalse(fields['fuzz_path'].required)
        self.assertEqual(fields['fuzz_path'].default, '/FUZZ')
        self.assertFalse(fields['cookie'].required)
        self.assertIsNone(fields['cookie'].default)

    def test_registry_contains_nuclei(self):
        # Fase 2, Bloque 2 — solo `cookie`; dry_run/retry_cfg NO se exponen
        # (son detalle de ejecución interna, sin consumidor real).
        entry = reg.get_runner_entry('nuclei')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_nuclei')
        self.assertEqual(len(entry.schema.fields), 1)
        self.assertEqual(entry.schema.fields[0].name, 'cookie')
        self.assertFalse(entry.schema.fields[0].required)

    def test_registry_contains_gobuster(self):
        # Fase 2, Bloque 3 — registrada DESPUÉS de corregir el bug real del
        # cookie en orchestrator.py::run_gobuster() (ver su comentario "FIX").
        entry = reg.get_runner_entry('gobuster')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_gobuster')
        self.assertEqual(len(entry.schema.fields), 1)
        self.assertEqual(entry.schema.fields[0].name, 'cookie')
        self.assertFalse(entry.schema.fields[0].required)

    def test_registry_contains_metasploit(self):
        # Fase 2, Bloque 4 — primer caso real de `dependency` (no sintético).
        entry = reg.get_runner_entry('metasploit')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_metasploit')
        self.assertEqual(entry.schema.subject_kwarg, 'target')
        fields = {f.name: f for f in entry.schema.fields}
        self.assertEqual(set(fields.keys()), {'ports', 'technologies'})
        self.assertEqual(fields['ports'].source, 'dependency')
        self.assertFalse(fields['ports'].required)
        self.assertIsNone(fields['ports'].default)

    def test_registry_contains_searchsploit(self):
        # Fase 2, Bloque 4 — la única Skill cuyo runner real NO tiene
        # `target` como primer parámetro posicional (ver subject_kwarg).
        entry = reg.get_runner_entry('searchsploit')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'search_exploits')
        self.assertEqual(entry.schema.subject_kwarg, 'target')
        fields = {f.name: f for f in entry.schema.fields}
        self.assertEqual(set(fields.keys()), {'technologies', 'ports'})
        self.assertEqual(fields['technologies'].default, [])
        self.assertEqual(fields['ports'].default, [])

    def test_registry_contains_zap(self):
        # Fase 2, Bloque 5 — primer caso real de resultado no-lista y de
        # cliente HTTP a un demonio externo. Ninguno exige campos nuevos en
        # el schema más allá de los `option` ya conocidos.
        entry = reg.get_runner_entry('zap')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_zap_full')
        self.assertEqual(entry.schema.subject_kwarg, 'target')
        fields = {f.name: f for f in entry.schema.fields}
        self.assertEqual(set(fields.keys()), {'policy', 'cookie'})
        self.assertEqual(fields['policy'].default, 'Default Policy')
        self.assertFalse(fields['policy'].required)

    def test_only_block1_to_block5_skills_registered_in_phase_2(self):
        # Ninguna de las Skills de bloques futuros debe estar registrada
        # todavía. El orden importa poco; el conjunto sí.
        self.assertEqual(
            set(reg.SKILL_EXECUTION_REGISTRY.keys()),
            {'nmap', 'wappalyzer', 'patator', 'ffuf', 'nuclei', 'gobuster',
             'metasploit', 'searchsploit', 'zap'},
        )

    def test_unknown_skill_returns_none(self):
        self.assertIsNone(reg.get_runner_entry('amass'))
        self.assertIsNone(reg.get_runner_entry('sqlmap'))   # aún no migrada (bloque futuro)
        self.assertIsNone(reg.get_runner_entry('zap-spider'))  # sin runner real -- queda fuera indefinidamente


class TestSkillExecutor(unittest.TestCase):
    def setUp(self):
        self.orchestrator = FakeOrchestrator()
        self.scans = {'job-nmap-1': {'ports': [80, 443]}}
        self.executor = sx.SkillExecutor(self.orchestrator, get_scan_fn=self.scans.get)

    def test_unknown_skill_id(self):
        # A. skill_id inexistente -> error coherente (SkillNotFoundError)
        with self.assertRaises(sx.SkillNotFoundError):
            self.executor.run('amass', '192.0.2.10')

    def test_nmap_missing_subject(self):
        # B. Nmap sin subject -> falla validación, nunca llega al runner
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('nmap', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])   # el runner NUNCA se llamó

        with self.assertRaises(sx.SkillValidationError):
            self.executor.run('nmap', '   ')             # solo espacios tampoco es válido

    def test_nmap_valid_subject_reaches_runner(self):
        # C. Nmap con subject válido -> llega exactamente a orchestrator.run_nmap
        result = self.executor.run('nmap', '192.0.2.10')
        self.assertEqual(self.orchestrator.calls, [('run_nmap', '192.0.2.10', {})])
        self.assertEqual(result, {'called_with': '192.0.2.10', 'kwargs': {}})

    # ── Fase 2, Bloque 1: Wappalyzer ────────────────────────────────────────

    def test_wappalyzer_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('wappalyzer', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_wappalyzer_valid_subject_reaches_runner(self):
        # Llega exactamente a orchestrator.run_wappalyzer, sin kwargs extra
        # (su schema no declara ningún `field`, igual que Nmap).
        result = self.executor.run('wappalyzer', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_wappalyzer', 'dvwa:80', {})])
        self.assertEqual(result, [{'technology': 'nginx', 'version': '1.25', 'target': 'dvwa:80'}])

    # ── Fase 2, Bloque 1: Patator ────────────────────────────────────────────

    def test_patator_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('patator', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_patator_valid_subject_reaches_runner_without_form_path(self):
        # form_path es OPCIONAL: sin él, el kwarg debe llegar como None y el
        # propio run_patator real es quien lo autodetecta (no el Executor).
        result = self.executor.run('patator', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_patator', 'dvwa:80', None)])
        self.assertEqual(result, [{'tool': 'patator', 'target': 'dvwa:80', 'form_path': None, 'success': False}])

    def test_patator_valid_subject_with_explicit_form_path(self):
        # Con options.form_path explícito, debe llegar tal cual al runner —
        # sin inventar ningún otro parámetro (fail_string, etc. los resuelve
        # run_patator() internamente, no el Executor).
        result = self.executor.run('patator', 'dvwa:80', options={'form_path': '/login.php'})
        self.assertEqual(self.orchestrator.calls, [('run_patator', 'dvwa:80', '/login.php')])
        self.assertEqual(result[0]['form_path'], '/login.php')

    # ── Fase 2, Bloque 2: ffuf ───────────────────────────────────────────────

    def test_ffuf_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('ffuf', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_ffuf_valid_subject_uses_real_default_fuzz_path(self):
        # Sin options.fuzz_path, debe llegar exactamente el default REAL del
        # runner ('/FUZZ'), no vacío ni None.
        result = self.executor.run('ffuf', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_ffuf', 'dvwa:80', '/FUZZ', None)])
        self.assertEqual(result[0]['fuzz_path'], '/FUZZ')

    def test_ffuf_valid_subject_with_explicit_options(self):
        result = self.executor.run('ffuf', 'dvwa:80', options={'fuzz_path': '/api/FUZZ', 'cookie': 'PHPSESSID=abc'})
        self.assertEqual(self.orchestrator.calls, [('run_ffuf', 'dvwa:80', '/api/FUZZ', 'PHPSESSID=abc')])
        self.assertEqual(result[0]['fuzz_path'], '/api/FUZZ')
        self.assertEqual(result[0]['cookie'], 'PHPSESSID=abc')

    # ── Fase 2, Bloque 2: Nuclei ─────────────────────────────────────────────

    def test_nuclei_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('nuclei', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_nuclei_valid_subject_without_cookie(self):
        result = self.executor.run('nuclei', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_nuclei', 'dvwa:80', None)])
        self.assertEqual(result[0]['cookie'], None)

    def test_nuclei_valid_subject_with_cookie(self):
        result = self.executor.run('nuclei', 'dvwa:80', options={'cookie': 'PHPSESSID=abc'})
        self.assertEqual(self.orchestrator.calls, [('run_nuclei', 'dvwa:80', 'PHPSESSID=abc')])
        self.assertEqual(result[0]['cookie'], 'PHPSESSID=abc')

    # ── Fase 2, Bloque 3: Gobuster ───────────────────────────────────────────

    def test_gobuster_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('gobuster', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_gobuster_valid_subject_without_cookie(self):
        result = self.executor.run('gobuster', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_gobuster', 'dvwa:80', None)])
        self.assertEqual(result[0]['cookie'], None)

    def test_gobuster_valid_subject_with_cookie(self):
        # Cubre exactamente el bug corregido en el Bloque 3: el cookie debe
        # llegar al runner real como argumento de la llamada (kwarg), nunca
        # mutando un atributo de `orchestrator` por fuera de esta llamada.
        result = self.executor.run('gobuster', 'dvwa:80', options={'cookie': 'PHPSESSID=abc'})
        self.assertEqual(self.orchestrator.calls, [('run_gobuster', 'dvwa:80', 'PHPSESSID=abc')])
        self.assertEqual(result[0]['cookie'], 'PHPSESSID=abc')
        # El FakeOrchestrator no tiene ningún atributo mutable tipo
        # `_headers`/`timeout` que el Executor pudiera estar tocando por
        # fuera del kwarg -- si lo hiciera, este doble fallaría por
        # TypeError/AttributeError antes de llegar aquí.

    # ── Fase 2, Bloque 4: Metasploit (primer caso real de `dependencies`) ──

    def test_metasploit_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('metasploit', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_metasploit_valid_subject_without_dependencies(self):
        # Sin ports/technologies -> degrada con gracia (default None), no falla.
        result = self.executor.run('metasploit', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_metasploit', 'dvwa:80', None, None)])
        self.assertEqual(result, {'target': 'dvwa:80', 'ports': None, 'technologies': None})

    def test_metasploit_dependencies_as_direct_values(self):
        # A) valor directo suministrado por quien ejecuta la Skill.
        result = self.executor.run(
            'metasploit', 'dvwa:80',
            dependencies={'ports': [80, 443], 'technologies': ['PHP', 'Apache']},
        )
        self.assertEqual(self.orchestrator.calls, [('run_metasploit', 'dvwa:80', [80, 443], ['PHP', 'Apache'])])
        self.assertEqual(result['ports'], [80, 443])

    def test_metasploit_dependencies_from_previous_job(self):
        # B) resultado real de un job anterior (ej. una ejecución individual
        # de Nmap guardada en Redis bajo 'job-nmap-1', con campo 'ports' —
        # mismo mecanismo que usaría el frontend al encadenar Nmap -> Metasploit.
        result = self.executor.run(
            'metasploit', 'dvwa:80',
            dependencies={'ports': {'from_job': 'job-nmap-1', 'field': 'ports'}},
        )
        self.assertEqual(self.orchestrator.calls, [('run_metasploit', 'dvwa:80', [80, 443], None)])

    # ── Fase 2, Bloque 4: Searchsploit (subject_kwarg + dependencies) ───────

    def test_searchsploit_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('searchsploit', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_searchsploit_subject_passed_as_named_target_not_positional(self):
        # Prueba exactamente el bug que motivó subject_kwarg: el string del
        # target debe llegar al parámetro `target` (3er posicional real de
        # search_exploits), NUNCA a `technologies` (1er posicional).
        result = self.executor.run('searchsploit', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('search_exploits', [], [], 'dvwa:80', None)])
        self.assertEqual(result[0]['target'], 'dvwa:80')
        # Si el Executor hubiera pasado `subject` posicionalmente, `target`
        # habría quedado '' (su default) y 'dvwa:80' habría caído en
        # `technologies` -- la llamada registrada sería otra muy distinta.

    def test_searchsploit_dependencies_as_direct_values(self):
        result = self.executor.run(
            'searchsploit', 'dvwa:80',
            dependencies={'technologies': [{'name': 'PHP'}], 'ports': [{'port': 80}]},
        )
        self.assertEqual(
            self.orchestrator.calls,
            [('search_exploits', [{'name': 'PHP'}], [{'port': 80}], 'dvwa:80', None)],
        )

    def test_searchsploit_dependencies_absent_default_to_empty_lists_not_none(self):
        # search_exploits() real NO acepta None para technologies/ports (itera
        # sobre ellos con `for ... in ...`) -- el default del schema es []
        # exactamente para evitar un TypeError real, no una elección arbitraria.
        result = self.executor.run('searchsploit', 'dvwa:80')
        call = self.orchestrator.calls[0]
        self.assertEqual(call[1], [])   # technologies
        self.assertEqual(call[2], [])   # ports
        self.assertIsNotNone(result)

    # ── Fase 2, Bloque 5: ZAP (resultado Dict, no List) ─────────────────────

    def test_zap_missing_subject(self):
        with self.assertRaises(sx.SkillValidationError) as ctx:
            self.executor.run('zap', '')
        self.assertIn('subject es obligatorio', ctx.exception.errors)
        self.assertEqual(self.orchestrator.calls, [])

    def test_zap_valid_subject_uses_real_default_policy(self):
        result = self.executor.run('zap', 'dvwa:80')
        self.assertEqual(self.orchestrator.calls, [('run_zap_full', 'dvwa:80', 'Default Policy', None)])
        # El resultado se preserva tal cual -- Dict, no List[Dict].
        self.assertIsInstance(result, dict)
        self.assertEqual(result['tool'], 'zap_full')
        self.assertIn('urls_descubiertas', result)
        self.assertIn('vulnerabilidades', result)

    def test_zap_valid_subject_with_explicit_policy_and_cookie(self):
        result = self.executor.run('zap', 'dvwa:80', options={'policy': 'Dev Full', 'cookie': 'PHPSESSID=abc'})
        self.assertEqual(self.orchestrator.calls, [('run_zap_full', 'dvwa:80', 'Dev Full', 'PHPSESSID=abc')])
        self.assertEqual(result['tool'], 'zap_full')
        # NOTA: contra un target real "dvwa", el propio run_zap_full()
        # ignoraría este 'Dev Full' y usaría 'Dev Standard' (heurística
        # interna por target, documentada en skill_execution_registry.py).
        # El FakeOrchestrator no replica esa heurística -- lo que este test
        # prueba es que el Executor PASA el valor que se le pidió, sin
        # decidir nada por su cuenta; el comportamiento final de la
        # heurística es responsabilidad exclusiva del runner real.

    def test_planned_skill_is_not_executable(self):
        # G. Una Skill 'planned' no es ejecutable, igual que una inexistente.
        planned = dataclasses.replace(reg.get_runner_entry('nmap'), skill_id='amass-planned', status='planned')
        reg.SKILL_EXECUTION_REGISTRY['amass-planned'] = planned
        try:
            with self.assertRaises(sx.SkillNotFoundError):
                self.executor.run('amass-planned', '192.0.2.10')
            self.assertEqual(self.orchestrator.calls, [])
        finally:
            del reg.SKILL_EXECUTION_REGISTRY['amass-planned']   # dejar el registry como estaba

    def test_executor_is_generic_no_hardcoded_skill(self):
        # D. El dispatcher no contiene lógica específica de ninguna Skill en
        # particular: se prueba registrando una Skill SINTÉTICA (misma forma
        # que Metasploit: target + dependencies) bajo un id que NO colisiona
        # con ninguna Skill real ya migrada (ver nota abajo), y comprobando
        # que el mismo SkillExecutor, sin ningún cambio, la despacha
        # correctamente al método correcto por nombre (getattr), resuelve
        # sus dependencias, y no confunde su schema con el de ninguna otra.
        #
        # NOTA: antes este test reutilizaba el id 'metasploit' como Skill
        # sintética. Desde que 'metasploit' pasó a ser una Skill REAL del
        # registry (Fase 2, Bloque 4), hacerlo pisaría la entrada real
        # durante el test y la borraría al limpiar (`del
        # SKILL_EXECUTION_REGISTRY['metasploit']`), rompiendo cualquier otro
        # test que corra después y espere encontrarla. Se usa un id que
        # claramente no es ninguna de las 29 Skills del Registry.
        synthetic_id = 'synthetic-skill-for-generic-dispatch-test'
        self.assertIsNone(reg.get_runner_entry(synthetic_id), "el id sintético no debe colisionar con una Skill real")
        synthetic_entry = reg.SkillRunnerEntry(
            skill_id=synthetic_id,
            schema=reg.SkillInputSchema(subject_kind='target_url', fields=[
                reg.SkillInputField('ports', 'dependency', required=False, type='list'),
                reg.SkillInputField('technologies', 'dependency', required=False, type='list'),
            ]),
            runner_attr='run_metasploit',   # reutiliza el mismo runner real, sin relación con el id
        )
        reg.SKILL_EXECUTION_REGISTRY[synthetic_id] = synthetic_entry
        try:
            result = self.executor.run(
                synthetic_id, '192.0.2.10',
                dependencies={'ports': {'from_job': 'job-nmap-1', 'field': 'ports'}},
            )
            self.assertEqual(
                self.orchestrator.calls,
                [('run_metasploit', '192.0.2.10', [80, 443], None)],
            )
            self.assertEqual(result['ports'], [80, 443])
        finally:
            del reg.SKILL_EXECUTION_REGISTRY[synthetic_id]

        # También por inspección estática (AST — evita falsos positivos en
        # comentarios/docstrings que mencionen 'nmap' como ejemplo, como
        # hace este mismo archivo): ninguna comparación (`==`) del código
        # real de skill_executor.py puede usar el literal 'nmap'.
        with open(os.path.join(SERVER_DIR, 'skill_executor.py'), encoding='utf-8') as f:
            source = f.read()
        tree = ast.parse(source)
        offending = [
            n for n in ast.walk(tree)
            if isinstance(n, ast.Compare)
            and any(
                isinstance(v, ast.Constant) and isinstance(v.value, str) and v.value.lower() == 'nmap'
                for v in [n.left, *n.comparators]
            )
        ]
        self.assertEqual(offending, [], "skill_executor.py no debe comparar contra el literal 'nmap'")

    def test_dependency_resolution_direct_value(self):
        entry = reg.SkillRunnerEntry(
            skill_id='x', runner_attr='run_metasploit',
            schema=reg.SkillInputSchema(subject_kind='target_url', fields=[
                reg.SkillInputField('ports', 'dependency', type='list'),
            ]),
        )
        resolved = self.executor.resolve_dependencies(entry, {'ports': [22, 80]})
        self.assertEqual(resolved, {'ports': [22, 80]})

    def test_dependency_resolution_absent_uses_default(self):
        entry = reg.SkillRunnerEntry(
            skill_id='x', runner_attr='run_metasploit',
            schema=reg.SkillInputSchema(subject_kind='target_url', fields=[
                reg.SkillInputField('ports', 'dependency', type='list', default=None),
            ]),
        )
        resolved = self.executor.resolve_dependencies(entry, {})
        self.assertEqual(resolved, {'ports': None})   # nunca lanza excepción por ausencia


class TestWebScanRegression(unittest.TestCase):
    """
    E y H — verificaciones ESTÁTICAS sobre server/app.py (no requieren
    importar Flask/Redis/Celery, que no están instalados en este sandbox).
    """

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(SERVER_DIR, 'app.py'), encoding='utf-8') as f:
            cls.app_source = f.read()

    def test_run_scan_still_calls_orchestrator_run_nmap_directly(self):
        # E. El Web Scan (run_scan) sigue llamando orchestrator.run_nmap()
        # directamente -- nunca a través de skill_executor_instance.
        m = re.search(r"def run_scan\(.*?\n(?=def |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_scan() en app.py")
        run_scan_body = m.group(0)
        self.assertIn('orchestrator.run_nmap(', run_scan_body)
        self.assertNotIn('skill_executor', run_scan_body)
        self.assertNotIn('skill_execution_registry', run_scan_body)

    def test_run_scan_still_calls_orchestrator_run_wappalyzer_and_run_patator_directly(self):
        # Fase 2, Bloque 1: el Web Scan sigue llamando directamente a los
        # runners existentes de Wappalyzer y Patator -- la migración al
        # Universal Skill Executor es una segunda ENTRADA, no un reemplazo
        # del pipeline orquestado.
        m = re.search(r"def run_scan\(.*?\n(?=def |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_scan() en app.py")
        run_scan_body = m.group(0)
        self.assertIn('orchestrator.run_wappalyzer(', run_scan_body)
        self.assertIn('orchestrator.run_patator(', run_scan_body)
        self.assertNotIn('skill_executor', run_scan_body)
        self.assertNotIn('skill_execution_registry', run_scan_body)

    def test_run_scan_still_calls_orchestrator_run_ffuf_and_run_nuclei_directly(self):
        # Fase 2, Bloque 2: mismo criterio -- el Web Scan sigue llamando
        # directamente a los runners existentes de ffuf y Nuclei.
        m = re.search(r"def run_scan\(.*?\n(?=def |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_scan() en app.py")
        run_scan_body = m.group(0)
        self.assertIn('orchestrator.run_ffuf(', run_scan_body)
        self.assertIn('orchestrator.run_nuclei(', run_scan_body)
        self.assertNotIn('skill_executor', run_scan_body)
        self.assertNotIn('skill_execution_registry', run_scan_body)

    def test_run_scan_still_calls_orchestrator_run_gobuster_directly(self):
        # Fase 2, Bloque 3: el Web Scan sigue llamando a run_gobuster() con
        # la MISMA firma (target, cookie=...) -- el arreglo del bug del
        # cookie fue puramente interno a run_gobuster(), no cambió su punto
        # de llamada en run_scan().
        m = re.search(r"def run_scan\(.*?\n(?=def |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_scan() en app.py")
        run_scan_body = m.group(0)
        self.assertIn('orchestrator.run_gobuster(', run_scan_body)
        self.assertIn('cookie=session_cookie', run_scan_body)
        self.assertNotIn('skill_executor', run_scan_body)
        self.assertNotIn('skill_execution_registry', run_scan_body)

    def test_run_scan_still_calls_orchestrator_run_metasploit_and_search_exploits_directly(self):
        # Fase 2, Bloque 4: el Web Scan sigue llamando directamente a los
        # runners existentes -- el nuevo subject_kwarg solo afecta cómo
        # SkillExecutor.run() los invoca, no cómo los invoca run_scan().
        m = re.search(r"def run_scan\(.*?\n(?=def |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_scan() en app.py")
        run_scan_body = m.group(0)
        self.assertIn('orchestrator.run_metasploit(', run_scan_body)
        self.assertIn('orchestrator.search_exploits(', run_scan_body)
        self.assertNotIn('skill_executor', run_scan_body)
        self.assertNotIn('skill_execution_registry', run_scan_body)

    def test_run_scan_still_calls_orchestrator_run_zap_full_directly(self):
        # Fase 2, Bloque 5: el Web Scan sigue llamando directamente a
        # run_zap_full() -- la migración no cambió su firma ni su resultado.
        m = re.search(r"def run_scan\(.*?\n(?=def |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_scan() en app.py")
        run_scan_body = m.group(0)
        self.assertIn('orchestrator.run_zap_full(', run_scan_body)
        self.assertNotIn('skill_executor', run_scan_body)
        self.assertNotIn('skill_execution_registry', run_scan_body)

    def test_run_gobuster_no_longer_mutates_shared_headers_attribute(self):
        # Fase 2, Bloque 3 -- regresión específica del bug corregido: el
        # código real de run_gobuster() ya NO debe mutar self.gobuster._headers
        # (atributo que GobusterScanner.scan() nunca lee), y SÍ debe pasar el
        # cookie como `custom_headers` al llamar a .scan().
        with open(os.path.join(SERVER_DIR, 'modules', 'orchestrator.py'), encoding='utf-8') as f:
            orch_source = f.read()
        m = re.search(r"\n    def run_gobuster\(.*?\n(?=\n    def |\Z)", orch_source, re.S)
        self.assertIsNotNone(m, "no se encontró run_gobuster() en orchestrator.py")
        run_gobuster_body = m.group(0)
        # Se busca la MUTACIÓN real (asignación/indexado), no la mención en
        # comentarios que documentan el bug ya corregido.
        mutation = re.search(r"self\.gobuster\._headers\s*(=|\[)", run_gobuster_body)
        self.assertIsNone(mutation, "run_gobuster() no debe volver a mutar self.gobuster._headers")
        self.assertIn('custom_headers', run_gobuster_body)

    def test_save_scan_get_scan_not_modified(self):
        # H. Las funciones de persistencia existentes no fueron editadas por
        # esta fase. Fingerprint tomado del código fuente real (ver Fase 1):
        # si alguna cambia, este test debe fallar y hay que revisar por qué.
        expected_hashes = {
            'save_scan':             '0eab4cdab31c04817600bf6441581c52ed6e4e13873478d3ba0908c42e2b42f2',
            'get_scan':              'f266753712ad2b109648d9eb0ed010b760fdcfaf722b0f54dc49423a2c510caa',
            'update_step':           'eaa4e87d44d69a7616e45e769215c16d31f4bf82c9bd841f8e9977234330a46e',
            '_persist_step_result':  '24942e3ca31dd6ad529434626fbeadf09323af0f877d503f7f79bc5963cf52e2',
        }
        for fn_name, expected in expected_hashes.items():
            self._assert_function_source_unchanged(fn_name, expected)

    def _assert_function_source_unchanged(self, fn_name, expected_hash):
        m = re.search(rf"\ndef {re.escape(fn_name)}\(.*?\n(?=\ndef |\n@app\.route|\nclass |\Z)", self.app_source, re.S)
        self.assertIsNotNone(m, f"no se encontró {fn_name}() en app.py")
        actual_hash = hashlib.sha256(m.group(0).encode('utf-8')).hexdigest()
        self.assertEqual(
            actual_hash, expected_hash,
            f"{fn_name}() cambió de código fuente respecto al fingerprint tomado en la Fase 1 "
            f"-- revisar si el cambio fue intencional.",
        )


if __name__ == '__main__':
    unittest.main(verbosity=2)
