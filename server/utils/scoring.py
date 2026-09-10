"""
Security Scoring Module
Calculate security scores using CVSS and EPSS methodologies
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from utils.i18n_backend import get_t
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class Severity(Enum):
    """Severity levels with numeric values"""
    CRITICAL = 5
    HIGH = 4
    MEDIUM = 3
    LOW = 2
    INFO = 1


@dataclass
class SecurityWeights:
    """Configurable weights for scoring calculation"""
    critical: float = 20.0
    high: float = 10.0
    medium: float = 5.0
    low: float = 2.0
    info: float = 0.5
    exploit_with_vuln: float = 8.0  # Peso adicional si hay exploit para vuln
    exploit_without_vuln: float = 3.0  # Peso si hay exploit relacionado


# Pesos por defecto
DEFAULT_WEIGHTS = SecurityWeights()


def calculate_security_score(
    vulnerabilities: List[Dict[str, Any]],
    exploits: List[Dict[str, Any]],
    brute_force_results: Optional[List[Dict[str, Any]]] = None,
    weights: Optional[SecurityWeights] = None,
    locale: str = 'es',
) -> Dict[str, Any]:
    """
    Calculate overall security score based on findings
    
    Uses a weighted scoring system where:
    - Base score starts at 100
    - Critical vulns deduct 20 points each
    - High vulns deduct 10 points each
    - Medium vulns deduct 5 points each
    - Low vulns deduct 2 points each
    - Info vulns deduct 0.5 points each
    - Exploits add penalty based on correlation
    
    Args:
        vulnerabilities: List of vulnerabilities from scanners
        exploits: List of exploits from ExploitDB
        weights: Optional custom weights for calculation
        
    Returns:
        Score object with total, grade, breakdown and recommendations
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    breakdown = {
        'critical': 0,
        'high': 0,
        'medium': 0,
        'low': 0,
        'info': 0
    }

    # ── Fase 1: Deduplicar por (nombre, severidad, tool) ──────────────────────
    seen_vulns: set = set()
    deduped_vulns: List[Dict[str, Any]] = []
    for vuln in vulnerabilities:
        key = (
            vuln.get('name', '').lower().strip(),
            vuln.get('severity', 'info').lower(),
            vuln.get('tool', ''),
        )
        if key not in seen_vulns:
            seen_vulns.add(key)
            deduped_vulns.append(vuln)

    # ── Fase 2: Cap de contribución por herramienta y severidad ───────────────
    _TOOL_CAPS: Dict[str, int] = {
        'critical': 9999,
        'high':     15,
        'medium':   10,
        'low':      8,
        'info':     5,
    }
    _tool_sev_count: Dict[str, int] = {}
    capped_vulns: List[Dict[str, Any]] = []
    over_cap_count = 0

    for vuln in deduped_vulns:
        tool     = vuln.get('tool', 'unknown')
        severity = vuln.get('severity', 'info').lower()
        cap      = _TOOL_CAPS.get(severity, 5)
        bucket   = f"{tool}:{severity}"
        current  = _tool_sev_count.get(bucket, 0)

        if current < cap:
            _tool_sev_count[bucket] = current + 1
            capped_vulns.append(vuln)
        else:
            over_cap_count += 1

    if over_cap_count:
        logger.info(
            "Scoring cap aplicado: %d hallazgos excluidos del cálculo",
            over_cap_count,
        )

    deduped_vulns = capped_vulns

    # Contar vulnerabilidades por severidad (deduplicadas)
    total_vulns = 0
    max_cvss = 0.0

    for vuln in deduped_vulns:
        severity = vuln.get('severity', 'info').lower()
        if severity in breakdown:
            breakdown[severity] += 1
            total_vulns += 1

        # Trackear CVSS máximo encontrado
        cvss = vuln.get('cvss', 0)
        if isinstance(cvss, (int, float)) and cvss > max_cvss:
            max_cvss = cvss

    # Calcular penalización por exploits
    exploit_penalty = 0
    correlated_exploits = 0
    
    for exploit in exploits:
        # Verificar si el exploit está directamente relacionado con una vulnerabilidad
        is_correlated = any(
            e.get('matchedTerm', '').lower() in str(v.get('name', '')).lower()
            for v in vulnerabilities
            for e in [exploit]
        )
        
        if is_correlated:
            exploit_penalty += weights.exploit_with_vuln
            correlated_exploits += 1
        else:
            exploit_penalty += weights.exploit_without_vuln

    # Limitar penalización de exploits
    exploit_penalty = min(exploit_penalty, 40)
    
    # Penalización por credenciales débiles encontradas
    brute_penalty = 0
    found_credentials = []
    if brute_force_results:
        for bf in brute_force_results:
            if bf.get('success') and bf.get('credentials'):
                found_credentials.extend(bf['credentials'])
                brute_penalty += 20 * len(bf['credentials'])
    brute_penalty = min(brute_penalty, 30)

    # Calcular score base (máximo 100)
    raw_score = 100.0
    raw_score -= breakdown['critical'] * weights.critical
    raw_score -= breakdown['high'] * weights.high
    raw_score -= breakdown['medium'] * weights.medium
    raw_score -= breakdown['low'] * weights.low
    raw_score -= breakdown['info'] * weights.info
    raw_score -= exploit_penalty
    raw_score -= brute_penalty

    # Ajustar por factores adicionales
    # Penalización extra por acumulación de vulnerabilidades medias/altas
    medium_high_count = breakdown['medium'] + breakdown['high']
    if medium_high_count > 10:
        raw_score -= (medium_high_count - 10) * 0.5  # -0.5 por cada una sobre 10

    # Clamp score a 0-100
    total = max(0.0, min(100.0, raw_score))
    
    # Calcular porcentajes
    total_findings = sum(breakdown.values()) + len(exploits)
    
    # Calcular grado
    grade, grade_description = calculate_grade(total, breakdown, max_cvss)
    
    # Generar recomendaciones
    recommendations = generate_recommendations(
        breakdown, exploits, found_credentials, locale=locale
    )

    return {
        'total': round(total),
        'grade': grade,
        'gradeDescription': grade_description,
        'breakdown': breakdown,
        'percentages': calculate_percentages(breakdown, total_findings),
        'exploitImpact': {
            'totalExploits': len(exploits),
            'correlatedExploits': correlated_exploits,
            'penalty': round(exploit_penalty, 1)
        },
        'metrics': {
            'totalVulnerabilities': total_vulns,
            'totalExploits': len(exploits),
            'maxCvss': max_cvss,
            'criticalCount': breakdown['critical'],
            'highCount': breakdown['high']
        },
        'recommendations': recommendations,
        'riskLevel': get_risk_level(total, breakdown['critical'])
    }


def calculate_grade(
    score: float,
    breakdown: Dict[str, int],
    max_cvss: float = 0.0
) -> Tuple[str, str]:
    """
    Calculate letter grade based on score and findings
    
    Args:
        score: Numeric score 0-100
        breakdown: Count of vulnerabilities by severity
        max_cvss: Highest CVSS score found
        
    Returns:
        Tuple of (grade, description)
    """
    critical = breakdown['critical']
    high = breakdown['high']
    
    # Downgrades automáticos por hallazgos críticos
    if critical >= 3:
        return 'F', 'Critical: Multiple critical vulnerabilities require immediate attention'
    if critical >= 1:
        return 'D', 'Poor: Critical vulnerability detected - immediate remediation required'
    if high >= 5:
        return 'C', 'Fair: Multiple high severity issues present'
    
    # Grade basado en score numérico
    if score >= 95:
        return 'A+', 'Excellent: Strong security posture'
    if score >= 90:
        return 'A', 'Very Good: Minor issues only'
    if score >= 85:
        return 'A-', 'Good: Few low-risk findings'
    if score >= 80:
        return 'B+', 'Above Average: Some areas need attention'
    if score >= 75:
        return 'B', 'Average: Moderate security issues present'
    if score >= 70:
        return 'B-', 'Below Average: Several issues to address'
    if score >= 65:
        return 'C+', 'Fair: Security improvements needed'
    if score >= 60:
        return 'C', 'Weak: Significant vulnerabilities found'
    if score >= 55:
        return 'C-', 'Very Weak: Major security gaps'
    if score >= 50:
        return 'D+', 'Poor: Critical fixes required'
    if score >= 45:
        return 'D', 'Very Poor: Immediate action required'
    
    return 'F', 'Critical: System is highly vulnerable'


def calculate_percentages(
    breakdown: Dict[str, int],
    total: int
) -> Dict[str, float]:
    """Calculate percentage distribution"""
    if total == 0:
        return {
            'critical': 0.0,
            'high': 0.0,
            'medium': 0.0,
            'low': 0.0,
            'info': 0.0
        }
    
    return {
        'critical': round((breakdown['critical'] / total) * 100, 1),
        'high': round((breakdown['high'] / total) * 100, 1),
        'medium': round((breakdown['medium'] / total) * 100, 1),
        'low': round((breakdown['low'] / total) * 100, 1),
        'info': round((breakdown['info'] / total) * 100, 1)
    }


def get_risk_level(score: float, critical_count: int) -> str:
    """Determine risk level category"""
    if critical_count > 0 or score < 40:
        return 'CRITICAL'
    if score < 60:
        return 'HIGH'
    if score < 75:
        return 'MEDIUM'
    if score < 90:
        return 'LOW'
    return 'MINIMAL'


def generate_recommendations(
    breakdown: Dict[str, int],
    exploits: List[Dict[str, Any]],
    found_credentials: Optional[List[Dict]] = None,
    locale: str = 'es',
) -> List[str]:
    """
    Genera recomendaciones accionables en el idioma indicado.

    Args:
        breakdown:         Conteo de vulns por severidad.
        exploits:          Lista de exploits encontrados.
        found_credentials: Credenciales débiles detectadas por Patator.
        locale:            Idioma de salida ('es' o 'en'). Default: 'es'.
    """
    t = get_t(locale)
    recommendations = []

    # Prioridad 1: Críticas
    if breakdown['critical'] > 0:
        recommendations.append(t('scoring.critical', count=breakdown['critical']))

    # Prioridad 2: Altas
    if breakdown['high'] > 0:
        recommendations.append(t('scoring.high', count=breakdown['high']))

    # Prioridad 3: Medias
    if breakdown['medium'] > 3:
        recommendations.append(t('scoring.medium', count=breakdown['medium']))

    # Prioridad: Credenciales débiles
    if found_credentials:
        creds_str = ', '.join(
            [f"{c['username']}/{c['password']}" for c in found_credentials[:3]]
        )
        recommendations.append(t('scoring.weakCredentials', creds=creds_str))

    # Prioridad 4: Exploits de alta severidad
    if exploits:
        high_severity_exploits = [e for e in exploits if e.get('cvss', 0) >= 7.0]
        if high_severity_exploits:
            recommendations.append(
                t('scoring.exploitIntel', count=len(high_severity_exploits))
            )

    # Prioridad 5: Hardening
    if breakdown['low'] > 10 or breakdown['info'] > 20:
        recommendations.append(t('scoring.hardening'))

    # Exploits públicos (aunque no haya vulns confirmadas)
    total_exploits = len(exploits)
    if total_exploits >= 20:
        recommendations.append(t('scoring.exploitIntelHigh', count=total_exploits))
    elif total_exploits >= 5:
        recommendations.append(t('scoring.exploitIntelLow', count=total_exploits))

    # Postura positiva
    if not recommendations:
        recommendations.append(t('scoring.goodPosture'))

    return recommendations


def calculate_cvss_v3(
    attack_vector: str = 'N',
    attack_complexity: str = 'L',
    privileges_required: str = 'N',
    user_interaction: str = 'N',
    scope: str = 'U',
    confidentiality: str = 'H',
    integrity: str = 'H',
    availability: str = 'H'
) -> float:
    """
    Calculate CVSS v3.1 base score (simplified implementation)
    
    CVSS v3.1 Formula:
    Base Score = f(Impact, Exploitability)
    
    Where:
    - Impact depends on Confidentiality, Integrity, Availability
    - Exploitability depends on Attack Vector, Complexity, Privileges, User Interaction
    
    Args:
        attack_vector: N(etwork), A(djacent), L(ocal), P(hysical)
        attack_complexity: L(ow), H(igh)
        privileges_required: N(one), L(ow), H(igh)
        user_interaction: N(one), R(equired)
        scope: U(nchanged), C(hanged)
        confidentiality: H(igh), L(ow), N(one)
        integrity: H(igh), L(ow), N(one)
        availability: H(igh), L(ow), N(one)
        
    Returns:
        CVSS score 0.0-10.0
    """
    # CVSS v3.1 Metric Weights
    av_weights = {'N': 0.85, 'A': 0.62, 'L': 0.55, 'P': 0.20}
    ac_weights = {'L': 0.77, 'H': 0.44}
    pr_weights_unchanged = {'N': 0.85, 'L': 0.62, 'H': 0.27}
    pr_weights_changed = {'N': 0.85, 'L': 0.68, 'H': 0.50}
    ui_weights = {'N': 0.85, 'R': 0.62}
    impact_weights = {'H': 0.56, 'L': 0.22, 'N': 0.0}

    # Get metric values
    av = av_weights.get(attack_vector, 0.85)
    ac = ac_weights.get(attack_complexity, 0.77)
    pr = (pr_weights_changed if scope == 'C' else pr_weights_unchanged).get(
        privileges_required, 0.85
    )
    ui = ui_weights.get(user_interaction, 0.85)

    c = impact_weights.get(confidentiality, 0.0)
    i = impact_weights.get(integrity, 0.0)
    a = impact_weights.get(availability, 0.0)

    # Calculate Impact Sub-Score (ISS)
    iss = 1 - ((1 - c) * (1 - i) * (1 - a))

    # Calculate Impact
    if scope == 'U':
        impact = 6.42 * iss
    else:
        impact = 7.52 * (iss - 0.029) - 3.25 * pow(iss - 0.02, 15)

    # Calculate Exploitability
    exploitability = 8.22 * av * ac * pr * ui

    # Calculate Base Score
    if impact <= 0:
        return 0.0

    if scope == 'U':
        base_score = min(impact + exploitability, 10.0)
    else:
        base_score = min(1.08 * (impact + exploitability), 10.0)

    return round(base_score, 1)


def calculate_risk_priority(
    cvss_score: float,
    epss_score: float,
    asset_value: float = 5.0
) -> float:
    """
    Calculate risk priority score combining CVSS and EPSS
    
    Risk Priority = CVSS * EPSS * AssetValue
    
    Args:
        cvss_score: CVSS base score (0-10)
        epss_score: EPSS probability (0-1)
        asset_value: Asset importance (1-10, default 5)
        
    Returns:
        Priority score (higher = more urgent)
    """
    # Normalizar CVSS a 0-1
    normalized_cvss = cvss_score / 10.0
    
    # Calcular riesgo
    risk = normalized_cvss * epss_score * (asset_value / 5.0)
    
    return round(risk * 100, 2)


def estimate_epss(
    cvss_score: float,
    exploit_exists: bool = False,
    exploit_in_the_wild: bool = False,
    days_since_publish: int = 0
) -> float:
    """
    Estimate EPSS (Exploit Prediction Scoring System) probability
    
    Simplified model based on:
    - CVSS score (higher = more likely)
    - Exploit existence (public exploits increase probability)
    - Time since publication (older = less likely to be exploited)
    
    Args:
        cvss_score: CVSS v3 score 0-10
        exploit_exists: Public exploit available
        exploit_in_the_wild: Actively exploited in the wild
        days_since_publish: Days since CVE publication
        
    Returns:
        EPSS probability 0.0-1.0
    """
    # Base probability from CVSS
    if cvss_score >= 9.0:
        base_prob = 0.40
    elif cvss_score >= 7.0:
        base_prob = 0.20
    elif cvss_score >= 4.0:
        base_prob = 0.08
    else:
        base_prob = 0.02

    # Multiplicadores
    if exploit_exists:
        base_prob *= 2.5
    
    if exploit_in_the_wild:
        base_prob *= 2.0
    
    # Decay por tiempo (vulnerabilidades antiguas menos probables)
    if days_since_publish > 730:  # 2 años
        base_prob *= 0.3
    elif days_since_publish > 365:  # 1 año
        base_prob *= 0.6
    elif days_since_publish > 180:  # 6 meses
        base_prob *= 0.8
    
    # Cap en 0.95
    return round(min(base_prob, 0.95), 4)


def severity_from_cvss(cvss: float) -> str:
    """Convert CVSS score to severity rating"""
    if cvss >= 9.0:
        return 'critical'
    if cvss >= 7.0:
        return 'high'
    if cvss >= 4.0:
        return 'medium'
    if cvss > 0:
        return 'low'
    return 'info'


def get_grade_color(grade: str) -> str:
    """Get color code for grade (for UI)"""
    colors = {
        'A+': '#10B981',  # Emerald 500
        'A': '#10B981',
        'A-': '#34D399',
        'B+': '#3B82F6',  # Blue 500
        'B': '#60A5FA',
        'B-': '#93C5FD',
        'C+': '#F59E0B',  # Amber 500
        'C': '#FBBF24',
        'C-': '#FCD34D',
        'D+': '#EF4444',  # Red 500
        'D': '#F87171',
        'F': '#DC2626'    # Red 600
    }
    return colors.get(grade, '#6B7280')  # Gray 500 default


# Backwards compatibility
score_to_grade = lambda score: calculate_grade(score, {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0})[0]
max_grade = lambda limit, current: min([limit, current], key=lambda x: ['F', 'D', 'C', 'B', 'A', 'A+'].index(x))


# ── Scoring genérico basado en Findings unificados (Code Scan / OSINT) ──────
# FIX (auditoría): calculate_security_score() de arriba está atada a la
# forma específica de un Web Scan (vulnerabilities/exploits/brute_force).
# Code Scan y OSINT nunca tuvieron score/grade -- en el historial, un Code
# Scan con 40 secretos filtrados y uno limpio se veían "iguales" (ambos
# 'completed', sin ninguna señal de prioridad). Esta función NO toca
# calculate_security_score (cero riesgo de romper el scoring de Web Scan
# ya en producción) -- es un camino nuevo y paralelo que reutiliza los
# mismos pesos/umbrales de grado para que el significado de un "B+" sea
# consistente entre familias de scan.
def calculate_score_from_findings(
    findings: List[Dict[str, Any]],
    weights: Optional[SecurityWeights] = None,
    locale: str = 'es',
) -> Dict[str, Any]:
    """
    Calcula score/grade a partir de una lista de Findings unificados
    (ver server/findings.py -- normalize_findings()). Pensado para Code
    Scan y OSINT, que no tienen la forma vulnerabilities/exploits que
    calculate_security_score() espera.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    breakdown = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'info': 0}
    for f in findings:
        sev = (f.get('severity') or 'info').lower()
        if sev not in breakdown:
            sev = 'info'
        breakdown[sev] += 1

    raw_score = 100.0
    raw_score -= breakdown['critical'] * weights.critical
    raw_score -= breakdown['high'] * weights.high
    raw_score -= breakdown['medium'] * weights.medium
    raw_score -= breakdown['low'] * weights.low
    raw_score -= breakdown['info'] * weights.info

    total = max(0.0, min(100.0, raw_score))
    grade, grade_description = calculate_grade(total, breakdown, max_cvss=0.0)
    total_findings = sum(breakdown.values())

    return {
        'total': round(total),
        'grade': grade,
        'gradeDescription': grade_description,
        'breakdown': breakdown,
        'percentages': calculate_percentages(breakdown, total_findings),
        'metrics': {
            'totalFindings': total_findings,
            'criticalCount': breakdown['critical'],
            'highCount': breakdown['high'],
        },
        'riskLevel': get_risk_level(total, breakdown['critical']),
    }