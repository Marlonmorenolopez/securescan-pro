"""
server/tests/test_skill_executor.py — SecureScan Pro v5.0 · Fase 1

Pruebas ligeras del motor universal de ejecución individual de Skills
(skill_execution_registry.py + skill_executor.py) y verificaciones estáticas
de regresión sobre server/app.py.

Deliberadamente usa solo `unittest` (stdlib) — el proyecto no tenía ningún
framework de tests instalado (no hay pytest en requirements.txt, no existía
ningún test_*.py antes de esta fase), y el encargo de la Fase 1 pide
explícitamente no introducir una dependencia pesada solo para esto.

Cómo correrlas:
    cd server && python3 -m unittest tests.test_skill_executor -v
    (o)  python3 server/tests/test_skill_executor.py

Alcance — corresponde 1:1 a los puntos A-H pedidos en la Fase 1:
    A. skill_id inexistente               -> TestSkillExecutor.test_unknown_skill_id
    B. Nmap sin subject                    -> TestSkillExecutor.test_nmap_missing_subject
    C. Nmap con subject válido             -> TestSkillExecutor.test_nmap_valid_subject_reaches_runner
    D. Dispatcher sin lógica de Nmap       -> TestSkillExecutor.test_executor_is_generic_no_hardcoded_skill
    E. Web Scan sigue usando run_nmap()    -> TestWebScanRegression.test_run_scan_still_calls_orchestrator_run_nmap_directly
    F. El registry contiene Nmap           -> TestSkillExecutionRegistry.test_registry_contains_nmap
    G. Skill planned/no registrada         -> TestSkillExecutor.test_planned_skill_is_not_executable
    H. save_scan/get_scan no se tocaron    -> TestWebScanRegression.test_save_scan_get_scan_not_modified

NOTA sobre H: este sandbox no tiene instaladas las dependencias completas
del backend (redis, flask-cors, flask-limiter, celery, pymetasploit3 — ver
server/requirements.txt), así que `import app` no es viable aquí sin
instalar todo ese árbol de dependencias pesado, lo cual el propio encargo de
esta fase pide evitar. En su lugar, H se verifica de la única forma que no
requiere ese import: comprobando que las funciones save_scan/get_scan/
update_step/_persist_step_result de server/app.py NO fueron editadas por
esta fase (se compara su código fuente exacto con un fingerprint tomado
ANTES de estos cambios).Ántes de entregar, además, se hizo una revisión
manual línea por línea del diff real (ver informe de la Fase 1).
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
    """Doble de prueba — NUNCA ejecuta nmap real ni ninguna herramienta."""

    def __init__(self):
        self.calls = []

    def run_nmap(self, target, **kwargs):
        self.calls.append(('run_nmap', target, kwargs))
        return {'called_with': target, 'kwargs': kwargs}

    def run_metasploit(self, target, ports=None, technologies=None):
        self.calls.append(('run_metasploit', target, ports, technologies))
        return {'target': target, 'ports': ports, 'technologies': technologies}


class TestSkillExecutionRegistry(unittest.TestCase):
    def test_registry_contains_nmap(self):
        # F. El registry contiene Nmap, apuntando al runner real (no a un duplicado)
        entry = reg.get_runner_entry('nmap')
        self.assertIsNotNone(entry)
        self.assertEqual(entry.status, 'available')
        self.assertEqual(entry.runner_attr, 'run_nmap')
        self.assertEqual(entry.schema.subject_kind, 'target_url')
        self.assertEqual(entry.schema.fields, [])

    def test_only_nmap_registered_in_phase_1(self):
        # Ninguna de las otras 28 Skills debe estar registrada todavía.
        self.assertEqual(list(reg.SKILL_EXECUTION_REGISTRY.keys()), ['nmap'])

    def test_unknown_skill_returns_none(self):
        self.assertIsNone(reg.get_runner_entry('amass'))
        self.assertIsNone(reg.get_runner_entry('wappalyzer'))  # aún no migrada


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
        # D. El dispatcher no contiene lógica específica de Nmap: se prueba
        # registrando una Skill DISTINTA (Metasploit, con dependencias) y
        # comprobando que el mismo SkillExecutor, sin ningún cambio, la
        # despacha correctamente al método correcto por nombre (getattr),
        # resuelve sus dependencias, y no confunde su schema con el de Nmap.
        metasploit_entry = reg.SkillRunnerEntry(
            skill_id='metasploit',
            schema=reg.SkillInputSchema(subject_kind='target_url', fields=[
                reg.SkillInputField('ports', 'dependency', required=False, type='list'),
                reg.SkillInputField('technologies', 'dependency', required=False, type='list'),
            ]),
            runner_attr='run_metasploit',
        )
        reg.SKILL_EXECUTION_REGISTRY['metasploit'] = metasploit_entry
        try:
            result = self.executor.run(
                'metasploit', '192.0.2.10',
                dependencies={'ports': {'from_job': 'job-nmap-1', 'field': 'ports'}},
            )
            self.assertEqual(
                self.orchestrator.calls,
                [('run_metasploit', '192.0.2.10', [80, 443], None)],
            )
            self.assertEqual(result['ports'], [80, 443])
        finally:
            del reg.SKILL_EXECUTION_REGISTRY['metasploit']

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
