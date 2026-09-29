"""
server/skill_executor.py — SecureScan Pro v5.0 · Fase 1

SkillExecutor: la capa GENÉRICA de ejecución individual de una Skill.

Responsabilidad exclusiva: validar la entrada contra el SkillInputSchema de
la Skill, resolver sus `dependencies` (sección 5 del documento de Fase 0.1)
y llamar al runner EXISTENTE (un método de la instancia `orchestrator` que
server/app.py ya usa dentro del Web Scan) — nada más.

Lo que este archivo NO hace, a propósito:
  - No contiene ningún `if skill_id == 'nmap'` ni equivalente. Toda la
    diferencia entre Skills vive como datos en
    server/skill_execution_registry.py.
  - No crea job_id, no llama a job_executor.submit_job, no llama a
    save_scan/get_scan/update_step. Ese ciclo de vida asíncrono vive en
    server/app.py (función run_skill_job), exactamente con el mismo patrón
    que ya usan run_sherlock_scan/run_harvester_scan — SkillExecutor.run()
    es la parte SÍNCRONA ("ejecutá esta Skill con esta entrada ya
    resuelta"), igual que orchestrator.run_nmap() en sí misma es síncrona
    dentro del Web Scan.
  - No sabe nada de Redis, Flask, ni HTTP.

Ver el documento de diseño Fase 0 (secciones D-G) y Fase 0.1 (secciones
2-7) para el razonamiento completo detrás de este contrato.
"""

from typing import Any, Callable, Optional

from skill_execution_registry import SkillRunnerEntry, get_runner_entry


class SkillNotFoundError(Exception):
    """skill_id no registrado, o registrado pero status != 'available'
    (una Skill 'planned' se trata igual que una inexistente: NO ejecutable —
    mismo principio que ya aplican los helpers de lib/skills.ts)."""
    def __init__(self, skill_id: str):
        self.skill_id = skill_id
        super().__init__(f"Skill no disponible para ejecución individual: {skill_id}")


class SkillValidationError(Exception):
    """Entrada inválida contra el SkillInputSchema de la Skill."""
    def __init__(self, skill_id: str, errors: list[str]):
        self.skill_id = skill_id
        self.errors = errors
        super().__init__(f"{skill_id}: {'; '.join(errors)}")


class SkillExecutor:
    """
    Instancia única por proceso (como `orchestrator` en server/app.py).
    `get_scan_fn` es una función inyectada (normalmente el `get_scan` de
    server/app.py) usada SOLO para resolver dependencias del tipo
    `{'from_job': '<job_id>', 'field': '<campo>'}` — ver resolve_dependencies.
    Ninguna Skill de esta fase (solo Nmap) usa `dependencies`, pero el
    mecanismo queda implementado y genérico desde ahora, tal como pide la
    Fase 0.1, para no tener que rediseñarlo cuando se agregue Metasploit.
    """

    def __init__(self, orchestrator: Any, get_scan_fn: Optional[Callable[[str], Optional[dict]]] = None):
        self._orchestrator = orchestrator
        self._get_scan = get_scan_fn

    # ── 1-4: validar skill_id / disponibilidad ──────────────────────────────
    def get_entry(self, skill_id: str) -> SkillRunnerEntry:
        entry = get_runner_entry(skill_id)
        if entry is None or entry.status != 'available':
            raise SkillNotFoundError(skill_id)
        return entry

    # ── 4-5: validar subject/options/dependencies contra el schema ─────────
    def validate(
        self,
        entry: SkillRunnerEntry,
        subject: str,
        options: Optional[dict] = None,
        dependencies: Optional[dict] = None,
    ) -> None:
        errors: list[str] = []
        if not subject or not str(subject).strip():
            errors.append('subject es obligatorio')

        options = options or {}
        dependencies = dependencies or {}
        for f in entry.schema.fields:
            bucket = options if f.source == 'option' else dependencies
            if f.required and f.name not in bucket:
                errors.append(f'{f.source}.{f.name} es obligatorio para la Skill "{entry.skill_id}"')

        if errors:
            raise SkillValidationError(entry.skill_id, errors)

    # ── 6-7: resolver dependencias (A: valor directo / B: from_job / C: default) ──
    def resolve_dependencies(self, entry: SkillRunnerEntry, dependencies: Optional[dict]) -> dict:
        resolved: dict[str, Any] = {}
        dependencies = dependencies or {}
        for f in entry.schema.fields:
            if f.source != 'dependency':
                continue
            raw = dependencies.get(f.name)
            if raw is None:
                resolved[f.name] = f.default                         # C) ausente → default del schema
            elif isinstance(raw, dict) and 'from_job' in raw:
                if self._get_scan is None:
                    resolved[f.name] = f.default
                else:
                    source_scan = self._get_scan(raw['from_job'])     # B) resultado de otro job
                    resolved[f.name] = (source_scan or {}).get(raw.get('field', f.name), f.default)
            else:
                resolved[f.name] = raw                                # A) valor directo suministrado
        return resolved

    # ── 8: construir kwargs a partir de options resueltas + dependencies ───
    def build_kwargs(self, entry: SkillRunnerEntry, options: Optional[dict], resolved_dependencies: dict) -> dict:
        options = options or {}
        kwargs: dict[str, Any] = {
            f.name: options.get(f.name, f.default)
            for f in entry.schema.fields
            if f.source == 'option'
        }
        kwargs.update(resolved_dependencies)
        return kwargs

    # ── 9: resolver el runner EXISTENTE (getattr sobre `orchestrator`) ─────
    def get_runner(self, entry: SkillRunnerEntry) -> Callable:
        return getattr(self._orchestrator, entry.runner_attr)

    # ── Punto de entrada único: valida, resuelve, y LLAMA al runner real ───
    def run(
        self,
        skill_id: str,
        subject: str,
        options: Optional[dict] = None,
        dependencies: Optional[dict] = None,
    ) -> Any:
        """
        Síncrono. Devuelve exactamente lo que devuelve el runner existente
        (ej. orchestrator.run_nmap(target) → List[Dict] de puertos), sin
        envolver ni transformar. El manejo de errores de la propia
        herramienta ya vive dentro de cada run_<tool>() (timeouts,
        reintentos, dict con 'error') — este método no lo duplica.
        """
        entry = self.get_entry(skill_id)
        self.validate(entry, subject, options, dependencies)
        resolved_deps = self.resolve_dependencies(entry, dependencies)
        kwargs = self.build_kwargs(entry, options, resolved_deps)
        runner = self.get_runner(entry)
        return runner(subject, **kwargs)
