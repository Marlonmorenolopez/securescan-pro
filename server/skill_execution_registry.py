"""
server/skill_execution_registry.py — SecureScan Pro v5.0 · Fase 1

Registro backend de EJECUCIÓN de Skills. Es un archivo distinto y separado
de lib/skills.ts (el Skill Registry del frontend), a propósito:

    lib/skills.ts                          server/skill_execution_registry.py
      id, name, category, subgroup,          skill_id, input_schema, runner_attr
      status, icon, docs, targetSupport        (¿qué función ejecuta y cómo
      (metadata de CATÁLOGO/UI)                 llamarla — EJECUCIÓN)

La única clave que los conecta es el string `skill_id` — ninguno de los dos
importa al otro, y este archivo NO repite name/icon/docs/category visual.

Diseñado en las fases previas (Fase 0 y Fase 0.1) de esta misma conversación:
  - SkillInputField / SkillInputSchema: contrato declarativo de entrada, para
    que el SkillExecutor pueda validar genéricamente sin conocer qué campos
    usa cada herramienta ("if skill_id == 'nmap'" NO debe existir en el
    Executor — la diferencia entre Skills vive aquí, como datos).
  - `runner_attr` es el NOMBRE del método en la instancia `orchestrator` de
    server/app.py (ej. 'run_nmap'), NO una referencia directa a la función.
    Esto evita un import circular (server/app.py ya importa este archivo;
    si este archivo importara `orchestrator` de vuelta, sería circular).
    server/skill_executor.py resuelve el método real con getattr() en el
    momento de la llamada, recibiendo `orchestrator` como parámetro.

FASE 2 (Bloque 1): 'wappalyzer' y 'patator'.
FASE 2 (Bloque 2): 'ffuf' y 'nuclei'.
FASE 2 (Bloque 3): 'gobuster' (con el arreglo del cookie en orchestrator.py
descrito abajo, aprobado explícitamente antes de aplicarlo).
FASE 2 (Bloque 4): 'metasploit' y 'searchsploit' (primer caso real de
`dependencies`; requirió agregar `subject_kwarg` a SkillInputSchema,
aprobado explícitamente antes de aplicarlo — ver su docstring).
FASE 2 (Bloque 5): 'zap' (primer caso real de resultado no-lista y de
cliente HTTP a un demonio externo — ninguno exigió cambios al Executor).
FASE 2 (Bloque 6): 'sqlmap' (mismo mecanismo que Nuclei/Gobuster/ZAP, sin
casos especiales nuevos para el Executor).
FASE 2 (Bloque 7): 'injection_scanner' (mismo mecanismo que SQLMap; el único
matiz es documental -- run_injection_scan() conserva su fallback interno a
SQLMap cuando el módulo InjectionScanner no está instalado, comportamiento
preexistente que la Skill hereda sin cambios).
FASE 2 (Bloque 8): 'zap-spider' -- CIERRA la categoría Pentesting (12/12).
Único caso hasta ahora donde el runner no existía realmente (stub
deprecated) y hubo que construirlo: se agregó ZapScanner.spider_scan() +
ZapScanner._get_spider_results() en zap_scanner.py, reutilizando la misma
instancia/sesión/apikey que 'zap', y se reemplazó el cuerpo de
orchestrator.run_zap_spider() (ya NO es un stub). El Registry y el
Executor en sí no necesitaron ningún caso especial nuevo.
Todas con el mismo mecanismo — una entrada de diccionario más, sin tocar el
Executor ni el ciclo de vida del job. Las Skills restantes se agregan en
bloques posteriores, igual que estas.
"""

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


@dataclass(frozen=True)
class SkillInputField:
    """
    Un campo de entrada declarado por una Skill. El SkillExecutor lo usa
    para validar y para construir los kwargs de la llamada al runner, sin
    contener lógica propia de ninguna herramienta.
    """
    name: str
    source: Literal['option', 'dependency']
    required: bool = False
    type: Literal['string', 'list', 'dict', 'int'] = 'string'
    default: Any = None


@dataclass(frozen=True)
class SkillInputSchema:
    """
    subject_kind describe qué representa `subject` para esta Skill
    (documental por ahora — el propio dato ya viaja como string en
    SkillExecutionRequest.subject; ver server/skill_executor.py).

    subject_kwarg — FASE 2, BLOQUE 4: nombre del parámetro del runner real al
    que se pasa `subject`. El Executor lo pasa SIEMPRE como kwarg nombrado
    (`runner(**{subject_kwarg: subject}, **kwargs)`), nunca posicional.

    Por qué existe: 6 de las 7 Skills migradas hasta ahora tienen `target`
    como primer parámetro posicional de su runner, así que pasarlo posicional
    "parecía" funcionar. search_exploits() (Searchsploit) rompe esa
    suposición: su firma real es
        search_exploits(self, technologies, ports, target='', known_cves=None)
    — `target` es el TERCER parámetro, no el primero. Pasar `subject` de
    forma posicional lo haría caer en `technologies` por error. Declarar
    `subject_kwarg` por Skill (con default 'target', que cubre los otros 6
    casos sin cambiarles nada) es la corrección general: el Executor sigue
    sin saber nada de ninguna Skill en particular, solo lee este campo.
    """
    subject_kind: Literal[
        'target_url', 'username', 'domain', 'email', 'source_path', 'image_ref',
    ]
    fields: list = field(default_factory=list)
    subject_kwarg: str = 'target'


@dataclass(frozen=True)
class SkillRunnerEntry:
    skill_id: str
    schema: SkillInputSchema
    # Nombre del método en la instancia `orchestrator` (server/app.py) que
    # YA ejecuta esta Skill hoy dentro del Web Scan — se reutiliza tal cual,
    # nunca se reimplementa ni se envuelve con una segunda función.
    runner_attr: str
    # 'available' = ejecutable; 'planned' = catalogada, inerte (mismo
    # significado que status en lib/skills.ts — ver Skill Registry frontend).
    status: Literal['available', 'planned'] = 'available'


# ─── Registro ────────────────────────────────────────────────────────────────
#
# Nmap (Fase 1) no depende de ninguna otra Skill (ni como entrada ni como
# salida requerida) — es exactamente por eso que se eligió como piloto en el
# documento de diseño de Fase 0 (sección M). Su schema no declara ningún
# `field`: orchestrator.run_nmap(target) no acepta más que el target.
#
# Wappalyzer y Patator (Fase 2, Bloque 1) — mismo criterio de análisis
# aplicado antes de migrar cada una (ver documento de análisis del Bloque 1):
#   - wappalyzer: orchestrator.run_wappalyzer(target) — idéntico patrón a
#     Nmap, sin parámetros propios ni dependencias.
#   - patator:    orchestrator.run_patator(target, form_path=None) —
#     `form_path` es OPCIONAL en el runner real (si no se pasa, el propio
#     run_patator lo autodetecta vía self._detect_login_path(target)); se
#     declara como `option` NO requerido, sin inventar ningún parámetro que
#     el runner no acepte.
#
# ffuf y Nuclei (Fase 2, Bloque 2) — mismo criterio de análisis:
#   - ffuf:   orchestrator.run_ffuf(target, fuzz_path='/FUZZ', cookie=None) —
#     ambos kwargs se pasan tal cual a self.ffuf.scan(); `fuzz_path` declara
#     el mismo default real del runner ('/FUZZ'), no un default inventado.
#   - nuclei: orchestrator.run_nuclei(target, dry_run=False, retry_cfg=None,
#     cookie=None) — `dry_run`/`retry_cfg` son detalles de ejecución interna
#     del runner (no del contrato de la Skill) y NO se exponen como campos:
#     ningún consumidor real (frontend, otras Skills) necesita fijarlos, así
#     que declararlos violaría la regla "sin campo sin consumidor real" ya
#     aplicada en el Skill Registry. Solo `cookie` es un dato que quien
#     ejecuta la Skill puede querer controlar.
#   Ninguna de las dos muta estado compartido de `orchestrator` (a diferencia
#   de Gobuster antes del Bloque 3, ver documento de análisis) — cero riesgo
#   nuevo de carrera.
#
# Gobuster (Fase 2, Bloque 3) — orchestrator.run_gobuster(target, cookie=None):
#   Antes de registrarla se corrigió orchestrator.py::run_gobuster() (ver su
#   comentario "FIX" ahí): pasaba el cookie mutando self.gobuster._headers,
#   un atributo que GobusterScanner.scan() nunca lee — el cookie de sesión
#   no llegaba a Gobuster en NINGÚN Web Scan (bug preexistente, no
#   introducido por esta migración) — y además mutaba estado de la instancia
#   COMPARTIDA `orchestrator.gobuster`, insegura entre ejecuciones paralelas.
#   Ahora el cookie se pasa como `custom_headers` de scan(), igual que ffuf.
#   La firma de run_gobuster() no cambió; el Web Scan sigue llamándola igual.
#   `dry_run`/`retry_cfg` tampoco se exponen aquí, mismo criterio que Nuclei.
#
# Metasploit y Searchsploit (Fase 2, Bloque 4) — primer caso real de
# `dependencies` (no sintético, a diferencia de los tests de la Fase 1):
#   - metasploit: orchestrator.run_metasploit(target, ports=None,
#     technologies=None) — ambos opcionales con degradación real ya
#     verificada en el documento de diseño de Fase 0 (sin ellos, corre con
#     menos correlación, nunca falla). Se declaran como `dependency`, no
#     `option`, porque conceptualmente vienen de OTRA Skill (Nmap/
#     Wappalyzer), no son una preferencia de quien ejecuta Metasploit.
#   - searchsploit: orchestrator.search_exploits(technologies, ports,
#     target='', known_cves=None) — misma degradación real (fallback por
#     laboratorio conocido si faltan, confirmado en el código). Es la ÚNICA
#     de las 12 Skills de Pentesting cuyo runner no tiene `target` como
#     primer parámetro posicional — ver `subject_kwarg` en SkillInputSchema
#     (arriba) y el comentario en skill_executor.py::run(). `known_cves` no
#     se expone: no tiene consumidor real hoy (ninguna Skill lo produce como
#     dependencia; el único origen sería un Finding ya calculado, que es un
#     caso de uso distinto, no de esta migración).
#
# ZAP (Fase 2, Bloque 5) — orchestrator.run_zap_full(target,
# policy='Default Policy', cookie=None) -> Dict[str, Any]:
#   Primer caso real de dos cosas nuevas, ya soportadas por el Executor sin
#   cambios (confirmado, no solo supuesto):
#     1. Cliente HTTP a un demonio externo (contenedor `zap`), no subprocess
#        — el Executor no sabe ni le importa cómo se ejecuta la herramienta
#        por debajo, solo llama a `orchestrator.run_zap_full(...)`.
#     2. Resultado `Dict` (`{'urls_descubiertas', 'vulnerabilidades', 'tool',
#        'success'}`), no `List[Dict]` como las 8 anteriores — el resultado
#        se guarda tal cual (`raw: Any`), sin envolver.
#   `policy` se expone como `option`, con una advertencia real: run_zap_full
#   tiene una heurística interna que AUTODETECTA la policy por el propio
#   target (dvwa/webgoat/juice/testfire) y puede sobreescribir silenciosamente
#   el valor pasado — comportamiento preexistente, no introducido por esta
#   migración, documentado aquí para que no sorprenda a quien use
#   `options.policy` en una ejecución individual contra uno de esos targets.
#   `cookie` igual que en los casos anteriores. Sin estado compartido mutado
#   (usa run_with_timeout con kwargs limpios, mismo patrón que ffuf/Nuclei).
#
# SQLMap (Fase 2, Bloque 6) — orchestrator.run_sqlmap(target, params=None,
# cookie=None, data=None) -> List[Dict]:
#   Mismo patrón que Nuclei/Gobuster/ZAP: `target` es el primer parámetro
#   posicional real (subject_kwarg por default 'target' sirve sin cambios),
#   y los tres kwargs opcionales (`params`, `cookie`, `data`) se pasan tal
#   cual a scanner.scan() sin transformación. Se declaran como `option`, no
#   `dependency`: ninguno proviene obligatoriamente de otra Skill en el
#   código real — `cookie` es el mismo dato opcional de sesión que ya reciben
#   ffuf/nuclei/gobuster/zap como `option`, y `params`/`data` los conoce
#   directamente quien ejecuta la Skill (parámetro/endpoint a testear).
#   `level`/`risk`/`threads` NO se exponen: no son argumentos de
#   run_sqlmap(), se gestionan internamente vía variables de entorno
#   (SQLMAP_LEVEL/SQLMAP_RISK/SQLMAP_THREADS), igual para Web Scan e
#   individual — exponerlos violaría "sin campo sin consumidor real" (mismo
#   criterio ya aplicado a dry_run/retry_cfg de Nuclei). Cada llamada crea
#   una instancia nueva de SQLMapScanner como context manager (comportamiento
#   preexistente del Web Scan, no introducido aquí) — sin estado compartido
#   mutado. Resultado `List[Dict]` sin envolver, mismo patrón que nmap/ffuf/
#   nuclei (a diferencia de ZAP, que devuelve Dict).
#
# Injection Scanner (Fase 2, Bloque 7) — orchestrator.run_injection_scan(
# target, cookie=None, techniques=None) -> List[Dict]:
#   Mismo patrón que SQLMap: `target` es el primer parámetro posicional real
#   (subject_kwarg por default 'target' sirve sin cambios). `cookie` se
#   declara `option`, idéntico criterio que en ffuf/nuclei/gobuster/zap/
#   sqlmap (dato opcional de sesión, sin origen obligatorio en otra Skill).
#   `techniques` se declara `option` de tipo `list` (no `dependency`): es una
#   lista de nombres de técnica (sql, nosql, xpath, xxe, xss, command,
#   path_traversal, ssrf, ssti, ldap) que quien ejecuta la Skill puede elegir
#   directamente -- igual que `policy` en ZAP, nadie más la produce como
#   salida. Default `None` = todas las técnicas (comportamiento real de
#   InjectionScanner.scan() cuando no se pasa `techniques`).
#   IMPORTANTE (comportamiento preexistente, no alterado): run_injection_scan
#   tiene DOS modos reales, ya presentes antes de esta migración -- si
#   `self.injection_scanner` no está disponible (módulo no instalado), cae
#   enteramente a SQLMap vía _get_sqlmap_targets()/run_sqlmap(), IGNORANDO
#   `techniques` en ese caso. La Skill individual hereda este mismo
#   comportamiento tal cual, porque llama al mismo método real -- no se
#   duplica ni se intenta "arreglar" aquí.
#   El resultado sigue siendo `List[Dict]` con `tool: 'injection_scanner'`
#   (o `tool: 'sqlmap'` en cada item si cae al fallback) -- InjectionFinding
#   ya fija `tool="injection_scanner"` por default en injection_scanner.py,
#   así que la distinción con SQLMap viene del propio dato, no de wrapping
#   añadido por el Executor.
# ZAP Spider (Fase 2, Bloque 8) — orchestrator.run_zap_spider(target,
# max_children=50) -> List[Dict]:
#   Deja de ser un stub deprecated. Reutiliza la MISMA instancia self.zap
#   (ZapScanner) que ya usa 'zap' (ZAP Full Scan) -- mismo cliente/API,
#   misma sesión, misma apikey, misma configuración Docker/env -- vía el
#   nuevo método ZapScanner.spider_scan(), que ejecuta solo el crawling
#   (sin Active Scan) y usa un endpoint de la API de ZAP
#   (JSON/spider/view/results/) que no se usaba en ningún lugar del
#   proyecto hasta este bloque -- la única pieza de infraestructura que
#   faltaba, no una segunda integración ZAP.
#   `target` es el primer parámetro posicional real (subject_kwarg por
#   default 'target' sirve sin cambios). `max_children` se declara `option`
#   de tipo `int` (nuevo valor de Literal en SkillInputField.type -- no
#   cambia nada en skill_executor.py, que nunca ramifica por .type), con
#   default 50 igual que la firma real del runner.
#   Sigue siendo una Skill independiente de 'zap': no lo reemplaza, no
#   cambia su comportamiento ni su runner_attr ('run_zap_full').
SKILL_EXECUTION_REGISTRY: dict[str, SkillRunnerEntry] = {
    'nmap': SkillRunnerEntry(
        skill_id='nmap',
        schema=SkillInputSchema(subject_kind='target_url', fields=[]),
        runner_attr='run_nmap',
        status='available',
    ),
    'wappalyzer': SkillRunnerEntry(
        skill_id='wappalyzer',
        schema=SkillInputSchema(subject_kind='target_url', fields=[]),
        runner_attr='run_wappalyzer',
        status='available',
    ),
    'patator': SkillRunnerEntry(
        skill_id='patator',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('form_path', source='option', required=False, type='string', default=None),
        ]),
        runner_attr='run_patator',
        status='available',
    ),
    'ffuf': SkillRunnerEntry(
        skill_id='ffuf',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('fuzz_path', source='option', required=False, type='string', default='/FUZZ'),
            SkillInputField('cookie', source='option', required=False, type='string', default=None),
        ]),
        runner_attr='run_ffuf',
        status='available',
    ),
    'nuclei': SkillRunnerEntry(
        skill_id='nuclei',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('cookie', source='option', required=False, type='string', default=None),
        ]),
        runner_attr='run_nuclei',
        status='available',
    ),
    'gobuster': SkillRunnerEntry(
        skill_id='gobuster',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('cookie', source='option', required=False, type='string', default=None),
        ]),
        runner_attr='run_gobuster',
        status='available',
    ),
    'metasploit': SkillRunnerEntry(
        skill_id='metasploit',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('ports', source='dependency', required=False, type='list', default=None),
            SkillInputField('technologies', source='dependency', required=False, type='list', default=None),
        ]),
        runner_attr='run_metasploit',
        status='available',
    ),
    'searchsploit': SkillRunnerEntry(
        skill_id='searchsploit',
        schema=SkillInputSchema(
            subject_kind='target_url',
            subject_kwarg='target',   # explícito: ver comentario arriba — es el 3er parámetro real, no el 1ro
            fields=[
                SkillInputField('technologies', source='dependency', required=False, type='list', default=[]),
                SkillInputField('ports', source='dependency', required=False, type='list', default=[]),
            ],
        ),
        runner_attr='search_exploits',
        status='available',
    ),
    'zap': SkillRunnerEntry(
        skill_id='zap',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('policy', source='option', required=False, type='string', default='Default Policy'),
            SkillInputField('cookie', source='option', required=False, type='string', default=None),
        ]),
        runner_attr='run_zap_full',
        status='available',
    ),
    'sqlmap': SkillRunnerEntry(
        skill_id='sqlmap',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('params', source='option', required=False, type='string', default=None),
            SkillInputField('cookie', source='option', required=False, type='string', default=None),
            SkillInputField('data',   source='option', required=False, type='string', default=None),
        ]),
        runner_attr='run_sqlmap',
        status='available',
    ),
    'injection_scanner': SkillRunnerEntry(
        skill_id='injection_scanner',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('cookie',     source='option', required=False, type='string', default=None),
            SkillInputField('techniques', source='option', required=False, type='list',   default=None),
        ]),
        runner_attr='run_injection_scan',
        status='available',
    ),
    'zap-spider': SkillRunnerEntry(
        skill_id='zap-spider',
        schema=SkillInputSchema(subject_kind='target_url', fields=[
            SkillInputField('max_children', source='option', required=False, type='int', default=50),
        ]),
        runner_attr='run_zap_spider',
        status='available',
    ),
}


def get_runner_entry(skill_id: str) -> Optional[SkillRunnerEntry]:
    """None si el skill_id no existe en este registro — el caller decide
    qué código HTTP corresponde (ver server/skill_executor.py y las rutas
    /api/skills/<skill_id>/run en server/app.py)."""
    return SKILL_EXECUTION_REGISTRY.get(skill_id)
