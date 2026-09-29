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

FASE 1: solo se registra 'nmap'. Las otras 28 Skills se agregan en fases
posteriores, una entrada de diccionario a la vez — sin tocar este mecanismo.
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
    type: Literal['string', 'list', 'dict'] = 'string'
    default: Any = None


@dataclass(frozen=True)
class SkillInputSchema:
    """
    subject_kind describe qué representa `subject` para esta Skill
    (documental por ahora — el propio dato ya viaja como string en
    SkillExecutionRequest.subject; ver server/skill_executor.py).
    """
    subject_kind: Literal[
        'target_url', 'username', 'domain', 'email', 'source_path', 'image_ref',
    ]
    fields: list = field(default_factory=list)


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


# ─── Registro — FASE 1: solo Nmap ───────────────────────────────────────────
#
# Nmap no depende de ninguna otra Skill (ni como entrada ni como salida
# requerida) — es exactamente por eso que se eligió como piloto en el
# documento de diseño de Fase 0 (sección M). Su schema no declara ningún
# `field`: orchestrator.run_nmap(target) no acepta más que el target.
SKILL_EXECUTION_REGISTRY: dict[str, SkillRunnerEntry] = {
    'nmap': SkillRunnerEntry(
        skill_id='nmap',
        schema=SkillInputSchema(subject_kind='target_url', fields=[]),
        runner_attr='run_nmap',
        status='available',
    ),
}


def get_runner_entry(skill_id: str) -> Optional[SkillRunnerEntry]:
    """None si el skill_id no existe en este registro — el caller decide
    qué código HTTP corresponde (ver server/skill_executor.py y las rutas
    /api/skills/<skill_id>/run en server/app.py)."""
    return SKILL_EXECUTION_REGISTRY.get(skill_id)
