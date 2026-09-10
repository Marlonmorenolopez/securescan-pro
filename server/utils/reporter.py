"""
Report Generator Module
Generate security reports in various formats (HTML, JSON, PDF, CSV)
"""

import re
import os
import json
import csv
import html
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from utils.i18n_backend import get_t

logger = logging.getLogger(__name__)

# Directorio de reportes
REPORTS_DIR = os.environ.get(
    'REPORTS_DIR',
    os.path.join(os.path.dirname(__file__), '..', 'reports'),
)
os.makedirs(REPORTS_DIR, exist_ok=True)

def _render_recommendations(recommendations, sanitize_fn):
    def get_icon(r):
        if 'URGENT' in r:
            return '🔴'
        elif 'HIGH' in r:
            return '🟠'
        elif 'MEDIUM' in r:
            return '🟡'
        return 'ℹ️'
    items = []
    for r in recommendations:
        icon = get_icon(r)
        text = sanitize_fn(r)
        items.append(
            f'<div class="recommendation">'
            f'<span class="recommendation-icon">{icon}</span>'
            f'<span class="recommendation-text">{text}</span>'
            f'</div>'
        )
    return "\n".join(items)


def _render_vulnerabilities(vulnerabilities, sanitize_fn, t=None):
    if not vulnerabilities:
        return '<div class="empty-state">No se detectaron vulnerabilidades</div>'
    items = []
    for v in vulnerabilities:
        severity = v.get('severity', 'info')
        name = sanitize_fn(v.get('name', 'Unknown'))
        desc = sanitize_fn(v.get('description', 'No description available'))
        cwe = (
            f"<div class='vuln-meta'>"
            f"<span class='badge badge-info'>CWE-{sanitize_fn(v.get('cweid'))}</span>"
            f"</div>"
        ) if v.get('cweid') else ''
        solution_label = t('report.solution') if t else 'Solution'
        sol = (
            f"<div class='vuln-solution'>"
            f"<strong>{solution_label}:</strong> {sanitize_fn(v.get('solution'))}"
            f"</div>"
        ) if v.get('solution') else ''
        items.append(
            f'<div class="vuln-item {severity}">'
            f'<div class="vuln-header">'
            f'<div class="vuln-title">{name}</div>'
            f'<span class="badge badge-{severity}">{severity.upper()}</span>'
            f'</div>'
            f'<div class="vuln-desc">{desc}</div>'
            f'{cwe}{sol}'
            f'</div>'
        )
    return '<div class="vuln-list">' + "\n".join(items) + '</div>'


def _render_technologies(technologies, sanitize_fn):
    if not technologies:
        return '<div class="empty-state">No se detectaron tecnologías</div>'
    rows = []
    for tech in technologies:
        rows.append(
            f'<tr>'
            f'<td><strong>{sanitize_fn(tech.get("name", "-"))}</strong></td>'
            f'<td>{sanitize_fn(tech.get("version", "-"))}</td>'
            f'<td><span class="badge badge-info">{sanitize_fn(tech.get("category", "-"))}</span></td>'
            f'<td>{tech.get("confidence", "-")}%</td>'
            f'</tr>'
        )
    return (
        '<div class="table-container">'
        '<table><thead><tr>'
        '<th>Tecnología</th><th>Versión</th><th>Categoría</th><th>Confianza</th>'
        '</tr></thead><tbody>'
        + "\n".join(rows) +
        '</tbody></table></div>'
    )


def _render_ports(ports, sanitize_fn):
    if not ports:
        return '<div class="empty-state">No se detectaron puertos abiertos</div>'
    rows = []
    for p in ports:
        rows.append(
            f'<tr>'
            f'<td><code>{p.get("port", "-")}</code></td>'
            f'<td><span class="badge badge-low">{sanitize_fn(p.get("state", "-"))}</span></td>'
            f'<td>{sanitize_fn(p.get("service", "-"))}</td>'
            f'<td>{sanitize_fn(p.get("product", "-"))}</td>'
            f'<td>{sanitize_fn(p.get("version", "-"))}</td>'
            f'</tr>'
        )
    return (
        '<div class="table-container">'
        '<table><thead><tr>'
        '<th>Puerto</th><th>Estado</th><th>Servicio</th><th>Producto</th><th>Versión</th>'
        '</tr></thead><tbody>'
        + "\n".join(rows) +
        '</tbody></table></div>'
    )


def _render_directories(directories, sanitize_fn):
    if not directories:
        return ''
    rows = []
    for d in directories:
        rows.append(
            f'<tr>'
            f'<td><code>{sanitize_fn(d.get("path", "-"))}</code></td>'
            f'<td><span class="badge badge-{d.get("type", "info")}">{d.get("status", "-")}</span></td>'
            f'<td>{d.get("size", 0)} bytes</td>'
            f'<td>{sanitize_fn(d.get("type", "-"))}</td>'
            f'</tr>'
        )
    return (
        '<div class="table-container">'
        '<table><thead><tr>'
        '<th>Ruta</th><th>Estado</th><th>Tamaño</th><th>Tipo</th>'
        '</tr></thead><tbody>'
        + "\n".join(rows) +
        '</tbody></table></div>'
    )


def _render_exploits(exploits, sanitize_fn):
    if not exploits:
        return '<div class="empty-state">No se encontraron exploits relacionados</div>'
    items = []
    for e in exploits:
        sev_badge = (
            f"<span class='badge badge-{e.get('severity', 'info')}'>{e.get('severity', '-').upper()}</span>"
            if e.get('severity') else ''
        )
        matched = (
            f"<div class='vuln-desc'>Relacionado con: {sanitize_fn(e.get('matchedTerm', ''))}</div>"
            if e.get('matchedTerm') else ''
        )
        exploit_link = (
            f"<div style='margin-top: 0.5rem;'>"
            f"<a href='{sanitize_fn(e.get('exploit_url', '#'))}' target='_blank' "
            f"style='color: var(--primary-light);'>Ver en Exploit-DB →</a></div>"
            if e.get('exploit_url') else ''
        )
        items.append(
            f'<div class="vuln-item">'
            f'<div class="vuln-header">'
            f'<div class="vuln-title">{sanitize_fn(e.get("title", "Unknown"))}</div>'
            f'<div style="display: flex; gap: 0.5rem;">'
            f'<span class="badge badge-critical">EDB-{sanitize_fn(e.get("id", "-"))}</span>'
            f'<span class="badge badge-info">{sanitize_fn(e.get("type", "-"))}</span>'
            f'</div></div>'
            f'<div class="vuln-meta">'
            f'<span class="badge badge-info">{sanitize_fn(e.get("platform", "-"))}</span>'
            f'<span class="badge badge-info">CVSS: {e.get("cvss", "-")}</span>'
            f'{sev_badge}'
            f'</div>'
            f'{matched}{exploit_link}'
            f'</div>'
        )
    return '<div class="vuln-list">' + "\n".join(items) + '</div>'


def _render_metasploit(metasploit_findings, sanitize_fn, t=None):
    if not metasploit_findings:
        return ''
    items = []
    for m in metasploit_findings:
        cvss_badge = (
            f"<span class='badge badge-info'>CVSS {m.get('cvss', 0)}</span>"
            if m.get('cvss') else ''
        )
        port_badge = (
            f"<span class='badge badge-info'>:{m.get('port')}/{m.get('protocol', 'tcp')}</span>"
            if m.get('port') else ''
        )
        desc_block = (
            f"<div class='vuln-desc'>{sanitize_fn(m.get('description', ''))}</div>"
            if m.get('description') else ''
        )
        err_block = (
            f"<div class='vuln-desc' style='color:#ef4444;font-family:monospace;font-size:0.75rem'>"
            f"Error: {sanitize_fn(m.get('error', ''))}</div>"
            if m.get('error') else ''
        )
        sev = sanitize_fn(m.get('severity', 'info'))
        items.append(
            f'<div class="vuln-item">'
            f'<div class="vuln-header">'
            f'<div class="vuln-title">{sanitize_fn(m.get("title", "MSF Finding"))}</div>'
            f'<div style="display: flex; gap: 0.5rem;">'
            f'<span class="badge badge-{m.get("severity", "info")}">{sev.upper()}</span>'
            f'{cvss_badge}'
            f'</div></div>'
            f'<div class="vuln-meta">'
            f'<span class="badge badge-info" style="font-family:monospace;font-size:0.7rem">'
            f'{sanitize_fn(m.get("module", "-"))}</span>'
            f'{port_badge}'
            f'</div>'
            f'{desc_block}{err_block}'
            f'</div>'
        )
    msf_count = len(metasploit_findings)
    msf_label = t('report.metasploitFindings') if t else 'Metasploit Findings'
    return (
        f'<div class="card">'
        f'<h2>🎯 {msf_label} ({msf_count})</h2>'
        f'<div class="vuln-list">' + "\n".join(items) + '</div>'
        f'</div>'
    )


def generate_report(scan: Dict[str, Any], format_type: str = 'html', locale: str = 'es') -> Optional[str]:
    """
    Generate a security report from scan results

    Args:
        scan: Complete scan data
        format_type: 'html', 'pdf', 'json', 'csv'
        locale: idioma del reporte ('es' o 'en'), usado por html/pdf

    Returns:
        Path to generated report file or None if failed
    """
    try:
        if not scan or 'id' not in scan:
            logger.error("Invalid scan data provided")
            return None

        format_type = format_type.lower().strip()
        scan_type   = _detect_scan_family(scan)

        # json es 100% genérico (vuelca el dict completo) — sirve para
        # cualquier scan_type sin cambios. html/pdf/csv sí dependen de la
        # forma de los datos, así que se despachan por familia de scan.
        if format_type == 'json':
            return generate_json_report(scan)

        if scan_type == 'code':
            generators = {
                'html': lambda s: generate_code_scan_html_report(s, locale),
                'pdf':  lambda s: generate_pdf_report(s, locale, html_generator=generate_code_scan_html_report),
                'csv':  lambda s: generate_code_scan_csv_report(s),
            }
        elif scan_type == 'osint':
            generators = {
                'html': lambda s: generate_osint_html_report(s, locale),
                'pdf':  lambda s: generate_pdf_report(s, locale, html_generator=generate_osint_html_report),
                'csv':  lambda s: generate_osint_csv_report(s),
            }
        else:
            # Comportamiento original (web scan) — sin cambios.
            generators = {
                'html': lambda s: generate_html_report(s, locale),
                'csv':  lambda s: generate_csv_report(s),
                'pdf':  lambda s: generate_pdf_report(s, locale),
            }

        if format_type not in generators:
            logger.warning(f"Unknown format '{format_type}', defaulting to HTML")
            format_type = 'html'

        return generators[format_type](scan)

    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        return None


def _detect_scan_family(scan: Dict[str, Any]) -> str:
    """
    Determina a qué familia de reporte pertenece un scan, sin depender
    únicamente de 'scan_type' (los OSINT síncronos persistidos como Job
    -- breach/username-quick -- también usan esta convención, ver app.py).

    Devuelve: 'web' | 'code' | 'osint'
    """
    scan_type = (scan.get('scan_type') or '').strip()
    if scan_type == 'code':
        return 'code'
    if scan_type.startswith('osint'):
        return 'osint'
    return 'web'


def generate_code_scan_html_report(scan: Dict[str, Any], locale: str = 'es') -> str:
    """
    Reporte HTML para Code Scan (Semgrep, Gitleaks, TruffleHog, Trivy,
    Dependency-Check, backdoors). Reutiliza sanitize_html/get_grade_class
    y el mismo REPORTS_DIR/convención de nombre de archivo que el reporte
    web -- NO es un segundo sistema de reportes, es una vista adicional
    sobre los mismos datos ya persistidos en Redis.
    """
    t = get_t(locale)
    sec = lambda k, **kw: t(k, **kw)

    def badge(sev: str) -> str:
        sev = (sev or 'info').lower()
        return f'<span class="badge badge-{sev}">{sev.upper()}</span>'

    def render_findings(findings: List[dict], title: str) -> str:
        if not findings:
            return ''
        rows = []
        for f in findings:
            rows.append(
                '<div class="vuln-item">'
                f'<div class="vuln-header"><div class="vuln-title">{sanitize_html(f.get("rule") or f.get("title") or f.get("description") or "Finding")}</div>'
                f'{badge(f.get("severity"))}</div>'
                f'<div class="vuln-desc">{sanitize_html(f.get("description") or f.get("message") or "")}</div>'
                + (f'<div class="vuln-meta">{sanitize_html(f.get("file"))}:{sanitize_html(f.get("line", ""))}</div>' if f.get('file') else '')
                + (f'<div class="vuln-meta">CVE: {sanitize_html(f.get("cve"))}</div>' if f.get('cve') else '')
                + '</div>'
            )
        return f'<h3>{sanitize_html(title)} ({len(findings)})</h3><div class="vuln-list">' + ''.join(rows) + '</div>'

    sections = []
    gl = scan.get('gitleaks') or {}
    sections.append(render_findings(gl.get('findings', []), 'Gitleaks — Secretos'))
    th = scan.get('trufflehog') or {}
    sections.append(render_findings(th.get('findings', []), 'TruffleHog — Secretos'))
    bd = scan.get('backdoors') or {}
    sections.append(render_findings(bd.get('findings', []), 'Backdoors'))
    sg = scan.get('semgrep') or {}
    sections.append(render_findings(sg.get('findings', []), 'Semgrep — Análisis Estático'))
    tv = scan.get('trivy') or {}
    sections.append(render_findings(tv.get('findings', []), 'Trivy'))
    dc = scan.get('dependency_check') or {}
    sections.append(render_findings(dc.get('findings', []), 'OWASP Dependency-Check'))

    summary = scan.get('summary') or {}
    generated_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')

    html_doc = f"""<!DOCTYPE html>
<html lang="{locale}"><head><meta charset="utf-8">
<title>SecureScan Pro — Code Scan Report</title>
<style>
body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0b0f19; color:#e2e8f0; margin:0; padding:32px; }}
h1 {{ color:#38bdf8; }} h3 {{ color:#94a3b8; margin-top:28px; }}
.meta {{ color:#94a3b8; font-size:14px; margin-bottom:24px; }}
.vuln-list {{ display:flex; flex-direction:column; gap:8px; }}
.vuln-item {{ background:#111827; border-left:4px solid #475569; border-radius:6px; padding:12px 16px; }}
.vuln-header {{ display:flex; justify-content:space-between; align-items:center; }}
.vuln-title {{ font-weight:600; }}
.vuln-desc {{ color:#cbd5e1; font-size:14px; margin-top:4px; }}
.vuln-meta {{ color:#64748b; font-size:12px; margin-top:4px; font-family:monospace; }}
.badge {{ font-size:11px; padding:2px 8px; border-radius:10px; }}
.badge-critical {{ background:#7f1d1d; color:#fecaca; }}
.badge-high {{ background:#7c2d12; color:#fed7aa; }}
.badge-medium {{ background:#78350f; color:#fde68a; }}
.badge-low {{ background:#14532d; color:#bbf7d0; }}
.badge-info {{ background:#1e3a8a; color:#bfdbfe; }}
</style></head><body>
<h1>SecureScan Pro — Code Security Report</h1>
<div class="meta">
  Objetivo: {sanitize_html(scan.get('source') or scan.get('id'))} &nbsp;|&nbsp;
  Tipo de fuente: {sanitize_html(scan.get('source_type', ''))} &nbsp;|&nbsp;
  Job ID: {sanitize_html(scan.get('id'))} &nbsp;|&nbsp;
  Generado: {generated_at}
</div>
{''.join(s for s in sections if s)}
</body></html>"""

    filename = f"code-report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.html"
    filepath = os.path.join(REPORTS_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_doc)
    return filepath


def generate_code_scan_csv_report(scan: Dict[str, Any]) -> str:
    """CSV con todos los hallazgos de code scan (una fila por hallazgo)."""
    filename = f"code-report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
    filepath = os.path.join(REPORTS_DIR, filename)
    tools = ('gitleaks', 'trufflehog', 'backdoors', 'semgrep', 'trivy', 'dependency_check')
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Tool', 'Rule/Title', 'Severity', 'File', 'Line', 'CVE', 'Description', 'Scan ID', 'Source'])
        for tool in tools:
            section = scan.get(tool) or {}
            for finding in section.get('findings', []):
                writer.writerow([
                    tool,
                    finding.get('rule') or finding.get('title') or '',
                    finding.get('severity', ''),
                    finding.get('file', ''),
                    finding.get('line', ''),
                    finding.get('cve', ''),
                    finding.get('description') or finding.get('message') or '',
                    scan.get('id', ''),
                    scan.get('source', ''),
                ])
    return filepath


def generate_osint_html_report(scan: Dict[str, Any], locale: str = 'es') -> str:
    """
    Reporte HTML para resultados OSINT: breach-check (XposedOrNot),
    username search (rápida y profunda/Sherlock) y theHarvester.
    Detecta qué sub-tipo es por las claves presentes en el scan.
    """
    generated_at = datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')
    body_parts = []

    if 'breaches' in scan or scan.get('scan_type') == 'osint-breach':
        breaches = scan.get('breaches') or []
        rows = ''.join(
            f'<div class="item"><strong>{sanitize_html(b.get("name") or b.get("source", "Breach"))}</strong>'
            f'<div class="meta">{sanitize_html(b.get("date", ""))} — {sanitize_html(b.get("description", ""))}</div></div>'
            for b in breaches
        ) or '<div class="empty">Sin brechas conocidas para este objetivo.</div>'
        body_parts.append(f"<h2>Verificación de brecha de datos — {sanitize_html(scan.get('email', ''))}</h2>{rows}")

    if 'found' in scan and 'unknown_sites' in scan:
        found = scan.get('found') or []
        rows = ''.join(
            f'<div class="item"><a href="{sanitize_html(r.get("url",""))}">{sanitize_html(r.get("site") or r.get("url",""))}</a></div>'
            for r in found
        ) or '<div class="empty">No se encontraron coincidencias.</div>'
        body_parts.append(
            f"<h2>Búsqueda de username — {sanitize_html(scan.get('username', ''))}</h2>"
            f"<div class='meta'>Sitios verificados: {scan.get('checked_count', len(scan.get('unknown_sites', [])) + len(found))}</div>{rows}"
        )

    if 'emails' in scan or 'hosts' in scan or 'sources_used' in scan:
        emails = scan.get('emails') or []
        hosts  = scan.get('hosts') or []
        ips    = scan.get('ips') or []
        body_parts.append(
            f"<h2>theHarvester — {sanitize_html(scan.get('domain', ''))}</h2>"
            f"<div class='meta'>Fuentes: {sanitize_html(', '.join(scan.get('sources_used') or []))}</div>"
            f"<h3>Correos ({len(emails)})</h3>" + ''.join(f'<div class="item">{sanitize_html(e)}</div>' for e in emails)
            + f"<h3>Hosts ({len(hosts)})</h3>" + ''.join(f'<div class="item">{sanitize_html(h)}</div>' for h in hosts)
            + f"<h3>IPs ({len(ips)})</h3>" + ''.join(f'<div class="item">{sanitize_html(i)}</div>' for i in ips)
        )

    if not body_parts:
        body_parts.append('<div class="empty">Sin datos OSINT para este Job.</div>')

    html_doc = f"""<!DOCTYPE html>
<html lang="{locale}"><head><meta charset="utf-8">
<title>SecureScan Pro — OSINT Report</title>
<style>
body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#0b0f19; color:#e2e8f0; margin:0; padding:32px; }}
h1 {{ color:#38bdf8; }} h2 {{ color:#a78bfa; margin-top:28px; }} h3 {{ color:#94a3b8; }}
.meta {{ color:#94a3b8; font-size:13px; margin:6px 0; }}
.item {{ background:#111827; border-radius:6px; padding:8px 12px; margin:4px 0; font-size:14px; }}
.empty {{ color:#64748b; font-style:italic; }}
a {{ color:#38bdf8; }}
</style></head><body>
<h1>SecureScan Pro — OSINT Report</h1>
<div class="meta">Job ID: {sanitize_html(scan.get('id'))} &nbsp;|&nbsp; Generado: {generated_at}</div>
{''.join(body_parts)}
</body></html>"""

    filename = f"osint-report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.html"
    filepath = os.path.join(REPORTS_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html_doc)
    return filepath


def generate_osint_csv_report(scan: Dict[str, Any]) -> str:
    filename = f"osint-report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
    filepath = os.path.join(REPORTS_DIR, filename)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Type', 'Value', 'Extra'])
        for b in (scan.get('breaches') or []):
            writer.writerow(['breach', b.get('name', ''), b.get('date', '')])
        for r in (scan.get('found') or []):
            writer.writerow(['username_match', r.get('site', ''), r.get('url', '')])
        for e in (scan.get('emails') or []):
            writer.writerow(['email', e, ''])
        for h in (scan.get('hosts') or []):
            writer.writerow(['host', h, ''])
        for i in (scan.get('ips') or []):
            writer.writerow(['ip', i, ''])
    return filepath


def sanitize_html(text: Any) -> str:
    """Sanitize text for HTML output to prevent XSS"""
    if text is None:
        return ''
    text = str(text)
    return html.escape(text, quote=True)


def get_grade_class(grade: str) -> str:
    """Get CSS class for grade"""
    grade_map = {
        'A+': 'a', 'A': 'a', 'A-': 'a',
        'B+': 'b', 'B': 'b', 'B-': 'b',
        'C+': 'c', 'C': 'c', 'C-': 'c',
        'D+': 'd', 'D': 'd',
        'F': 'f'
    }
    return grade_map.get(grade, 'f')


def generate_html_report(scan: Dict[str, Any], locale: str = 'es') -> str:
    """
    Generate premium enterprise-grade HTML/PDF security report.
    Design: dark SOC aesthetic using absolute hex colors (wkhtmltopdf compatible).
    """
    t = get_t(locale)
    scan_id = sanitize_html(scan['id'])
    target = sanitize_html(scan.get('target', 'Unknown'))
    status = sanitize_html(scan.get('status', 'unknown'))
    start_time = sanitize_html(scan.get('startTime', 'N/A'))
    end_time = sanitize_html(scan.get('endTime', 'N/A'))

    score = scan.get('score', {})
    grade = score.get('grade', 'F')
    total_score = score.get('total', 0)
    breakdown = score.get('breakdown', {})

    vulnerabilities = scan.get('vulnerabilities', [])
    technologies = scan.get('technologies', [])
    ports = scan.get('ports', [])
    directories = scan.get('directories', [])
    exploits = scan.get('exploits', [])
    metasploit_findings = scan.get('metasploit', [])
    recommendations = score.get('recommendations', [])

    # Duration
    duration_str = "N/A"
    if start_time != 'N/A' and end_time != 'N/A':
        try:
            start = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            duration = (end - start).total_seconds()
            duration_str = f"{int(duration // 60)}m {int(duration % 60)}s"
        except Exception:
            pass

    # Score color — absolute hex for wkhtmltopdf
    if total_score >= 80:
        score_color = '#00e5a0'
    elif total_score >= 60:
        score_color = '#3b9fff'
    elif total_score >= 40:
        score_color = '#ffb800'
    else:
        score_color = '#ff3b3b'

    status_color = '#00e5a0' if status == 'completed' else '#ffb800'

    # Grade badge colors
    grade_colors = {
        'A+': '#00e5a0', 'A': '#00e5a0', 'A-': '#00e5a0',
        'B+': '#3b9fff', 'B': '#3b9fff', 'B-': '#3b9fff',
        'C+': '#ffb800', 'C': '#ffb800', 'C-': '#ffb800',
        'D+': '#ff6b2b', 'D': '#ff6b2b',
        'F': '#ff3b3b',
    }
    grade_color = grade_colors.get(grade, '#ff3b3b')

    # Severity bar widths (out of total)
    total_vulns = max(1, sum([
        breakdown.get('critical', 0),
        breakdown.get('high', 0),
        breakdown.get('medium', 0),
        breakdown.get('low', 0),
    ]))
    def pct(key):
        return round((breakdown.get(key, 0) / total_vulns) * 100)

    # Sections
    rec_html = ''
    if recommendations:
        items_html = ''.join(
            f'<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;'
            f'background:#12192a;border-radius:8px;margin-bottom:8px;">'
            f'<span style="font-size:18px;flex-shrink:0;">{"🔴" if "URGENT" in r else "🟠" if "HIGH" in r else "🟡"}</span>'
            f'<span style="font-size:13px;color:#c8d8f0;line-height:1.5;">{sanitize_html(r)}</span></div>'
            for r in recommendations[:5]
        )
        rec_html = f'''
        <div class="card">
            <div class="card-header">
                <span class="card-icon">💡</span>
                <h2>{t("report.recommendations")}</h2>
            </div>
            {items_html}
        </div>'''

    dir_html = ''
    if directories:
        rows = ''.join(
            f'<tr><td><code>{sanitize_html(d.get("path","-"))}</code></td>'
            f'<td><span class="badge badge-{d.get("type","info")}">{d.get("status","-")}</span></td>'
            f'<td>{d.get("size",0)} bytes</td>'
            f'<td>{sanitize_html(d.get("type","-"))}</td></tr>'
            for d in directories
        )
        dir_html = f'''
        <div class="card">
            <div class="card-header">
                <span class="card-icon">📁</span>
                <h2>Directorios Encontrados ({len(directories)})</h2>
            </div>
            <div class="table-wrap">
                <table><thead><tr>
                    <th>Ruta</th><th>Estado</th><th>Tamaño</th><th>Tipo</th>
                </tr></thead><tbody>{rows}</tbody></table>
            </div>
        </div>'''

    msf_html = ''
    if metasploit_findings:
        msf_label = t('report.metasploitFindings') if t else 'Metasploit Findings'
        items = []
        for m in metasploit_findings:
            sev = sanitize_html(m.get('severity', 'info'))
            sev_colors = {'critical':'#ff3b3b','high':'#ff6b2b','medium':'#ffb800','low':'#3b9fff'}
            sc = sev_colors.get(sev, '#8899aa')
            port_html = f'<span class="badge badge-info">:{m.get("port")}/{m.get("protocol","tcp")}</span>' if m.get("port") else ""
            desc_html = f'<div class="vuln-desc">{sanitize_html(m.get("description",""))}</div>' if m.get("description") else ""
            items.append(
                f'<div class="vuln-item" style="border-left-color:{sc};">'
                f'<div class="vuln-header">'
                f'<div class="vuln-title">{sanitize_html(m.get("title","MSF Finding"))}</div>'
                f'<span class="badge" style="background:{sc}22;color:{sc};border:1px solid {sc}44;">{sev.upper()}</span>'
                f'</div>'
                f'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">'
                f'<span class="badge badge-info" style="font-family:monospace;font-size:11px;">{sanitize_html(m.get("module","-"))}</span>'
                f'{port_html}'
                f'</div>'
                f'{desc_html}'
                f'</div>'
            )
        msf_html = f'''
        <div class="card">
            <div class="card-header">
                <span class="card-icon">🎯</span>
                <h2>{msf_label} ({len(metasploit_findings)})</h2>
            </div>
            <div class="vuln-list">{"".join(items)}</div>
        </div>'''

    # Vulnerabilities section
    if vulnerabilities:
        vuln_items = []
        for v in vulnerabilities:
            sev = v.get('severity', 'info')
            sev_colors = {'critical':'#ff3b3b','high':'#ff6b2b','medium':'#ffb800','low':'#3b9fff','info':'#8899aa','informational':'#8899aa'}
            sc = sev_colors.get(sev.lower(), '#8899aa')
            name = sanitize_html(v.get('name', 'Unknown'))
            desc = sanitize_html(v.get('description', 'No description available'))
            cwe = f'<span class="badge badge-info">CWE-{sanitize_html(v.get("cweid"))}</span>' if v.get('cweid') else ''
            solution_label = t('report.solution') if t else 'Solution'
            sol = (
                f'<div class="vuln-solution"><strong style="color:#60a5fa;">{solution_label}:</strong> {sanitize_html(v.get("solution"))}</div>'
                if v.get('solution') else ''
            )
            cwe_html = f'<div style="margin-top:6px;">{cwe}</div>' if cwe else ""
            vuln_items.append(
                f'<div class="vuln-item" style="border-left-color:{sc};">'
                f'<div class="vuln-header">'
                f'<div class="vuln-title">{name}</div>'
                f'<span class="badge" style="background:{sc}22;color:{sc};border:1px solid {sc}44;">{sev.upper()}</span>'
                f'</div>'
                f'<div class="vuln-desc">{desc}</div>'
                f'{cwe_html}'
                f'{sol}'
                f'</div>'
            )
        vuln_html = f'<div class="vuln-list">{"".join(vuln_items)}</div>'
    else:
        vuln_html = '<div class="empty-state">✓ No se detectaron vulnerabilidades</div>'

    # Technologies section
    if technologies:
        tech_rows = ''.join(
            f'<tr><td><strong>{sanitize_html(tech.get("name","-"))}</strong></td>'
            f'<td>{sanitize_html(tech.get("version","-"))}</td>'
            f'<td><span class="badge badge-info">{sanitize_html(tech.get("category","-"))}</span></td>'
            f'<td>{tech.get("confidence","-")}%</td></tr>'
            for tech in technologies
        )
        tech_html = f'<div class="table-wrap"><table><thead><tr><th>Tecnología</th><th>Versión</th><th>Categoría</th><th>Confianza</th></tr></thead><tbody>{tech_rows}</tbody></table></div>'
    else:
        tech_html = '<div class="empty-state">No se detectaron tecnologías</div>'

    # Ports section
    if ports:
        port_rows = ''.join(
            f'<tr><td><code>{p.get("port","-")}</code></td>'
            f'<td><span class="badge badge-low">{sanitize_html(p.get("state","-"))}</span></td>'
            f'<td>{sanitize_html(p.get("service","-"))}</td>'
            f'<td>{sanitize_html(p.get("product","-"))}</td>'
            f'<td>{sanitize_html(p.get("version","-"))}</td></tr>'
            for p in ports
        )
        ports_html = f'<div class="table-wrap"><table><thead><tr><th>Puerto</th><th>Estado</th><th>Servicio</th><th>Producto</th><th>Versión</th></tr></thead><tbody>{port_rows}</tbody></table></div>'
    else:
        ports_html = '<div class="empty-state">No se detectaron puertos abiertos</div>'

    # Exploits section
    if exploits:
        exploit_items = []
        for e in exploits:
            title = sanitize_html(e.get('title', 'Unknown'))
            edb = sanitize_html(str(e.get('id', '-')))
            etype = sanitize_html(e.get('type', '-'))
            plat = sanitize_html(e.get('platform', '-'))
            cvss = e.get('cvss', '-')
            matched = f'<div class="vuln-desc">Relacionado con: {sanitize_html(e.get("matchedTerm",""))}</div>' if e.get('matchedTerm') else ''
            link = (
                f'<div style="margin-top:8px;"><a href="{sanitize_html(e.get("exploit_url","#"))}" '
                f'target="_blank" style="color:#60a5fa;font-size:13px;">Ver en Exploit-DB →</a></div>'
                if e.get('exploit_url') else ''
            )
            exploit_items.append(
                f'<div class="vuln-item" style="border-left-color:#ff3b3b;">'
                f'<div class="vuln-header">'
                f'<div class="vuln-title">{title}</div>'
                f'<div style="display:flex;gap:6px;">'
                f'<span class="badge badge-critical">EDB-{edb}</span>'
                f'<span class="badge badge-info">{etype}</span>'
                f'</div></div>'
                f'<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">'
                f'<span class="badge badge-info">{plat}</span>'
                f'<span class="badge badge-info">CVSS: {cvss}</span>'
                f'</div>'
                f'{matched}{link}'
                f'</div>'
            )
        exploits_html = f'<div class="vuln-list">{"".join(exploit_items)}</div>'
    else:
        exploits_html = '<div class="empty-state">No se encontraron exploits relacionados</div>'

    html_content = f"""<!DOCTYPE html>
<html lang="{locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SecureScan Pro — Security Report | {target}</title>
    <style>
        /* ── Reset ── */
        *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

        /* ── Base — absolute hex only, wkhtmltopdf compatible ── */
        body {{
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background-color: #070d18;
            color: #e8f0ff;
            line-height: 1.65;
            font-size: 14px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}

        .page {{
            max-width: 1100px;
            margin: 0 auto;
            padding: 32px 24px;
        }}

        /* ── Header ── */
        .report-header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 28px 32px;
            background-color: #0a1220;
            border: 1px solid #162135;
            border-radius: 16px;
            margin-bottom: 24px;
            position: relative;
            overflow: hidden;
        }}
        .report-header::before {{
            content: '';
            position: absolute;
            top: 0; left: 40px; right: 40px; height: 1px;
            background: linear-gradient(to right, transparent, #00c8ff55, transparent);
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 16px;
        }}
        .brand-shield {{
            width: 52px; height: 52px;
            background-color: #0f1929;
            border: 1px solid #00c8ff33;
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px;
        }}
        .brand-text h1 {{
            font-size: 22px;
            font-weight: 700;
            letter-spacing: -0.02em;
            color: #00c8ff;
        }}
        .brand-text p {{
            font-size: 12px;
            color: #7a8fa8;
            margin-top: 2px;
        }}
        .grade-circle {{
            width: 76px; height: 76px;
            border-radius: 50%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            font-weight: 700;
            text-align: center;
            flex-shrink: 0;
            background-color: {grade_color}22;
            border: 2px solid {grade_color};
        }}
        .grade-letter {{
            font-size: 26px;
            font-weight: 800;
            color: {grade_color};
            line-height: 1;
        }}
        .grade-label {{
            font-size: 9px;
            color: {grade_color};
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 2px;
        }}
        .report-meta {{
            text-align: right;
        }}
        .report-meta .target {{
            font-size: 18px;
            font-weight: 600;
            color: #e8f0ff;
            font-family: 'Consolas', monospace;
        }}
        .report-meta .date {{
            font-size: 12px;
            color: #7a8fa8;
            margin-top: 4px;
        }}

        /* ── Cards ── */
        .card {{
            background-color: #0a1220;
            border: 1px solid #162135;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            position: relative;
            page-break-inside: avoid;
        }}
        .card::before {{
            content: '';
            position: absolute;
            top: 0; left: 32px; right: 32px; height: 1px;
            background: linear-gradient(to right, transparent, #00c8ff33, transparent);
        }}
        .card-header {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
            padding-bottom: 14px;
            border-bottom: 1px solid #162135;
        }}
        .card-icon {{ font-size: 18px; }}
        .card h2 {{
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #00c8ff;
        }}

        /* ── Score summary ── */
        .score-section {{
            display: flex;
            align-items: center;
            gap: 24px;
        }}
        .score-ring {{
            position: relative;
            flex-shrink: 0;
        }}
        .score-value {{
            font-size: 36px;
            font-weight: 800;
            color: {score_color};
            text-align: center;
        }}
        .score-label {{
            font-size: 10px;
            color: #7a8fa8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            text-align: center;
        }}
        .score-bar-wrap {{
            flex: 1;
        }}
        .score-bar-row {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
        }}
        .score-bar-label {{
            width: 60px;
            font-size: 12px;
            color: #7a8fa8;
            flex-shrink: 0;
        }}
        .score-bar-track {{
            flex: 1;
            height: 8px;
            background-color: #162135;
            border-radius: 4px;
            overflow: hidden;
        }}
        .score-bar-fill {{
            height: 100%;
            border-radius: 4px;
        }}
        .score-bar-count {{
            width: 28px;
            text-align: right;
            font-size: 13px;
            font-weight: 600;
            flex-shrink: 0;
        }}

        /* ── Info grid ── */
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
        }}
        .info-cell {{
            background-color: #0f1929;
            border: 1px solid #162135;
            border-radius: 8px;
            padding: 14px;
        }}
        .info-cell-label {{
            font-size: 10px;
            color: #445566;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 6px;
        }}
        .info-cell-value {{
            font-size: 14px;
            font-weight: 500;
            color: #e8f0ff;
            font-family: 'Consolas', monospace;
            word-break: break-all;
        }}

        /* ── Stat grid ── */
        .stat-grid {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
        }}
        .stat-card {{
            background-color: #0f1929;
            border-radius: 10px;
            padding: 18px;
            text-align: center;
            border: 1px solid #162135;
        }}
        .stat-number {{
            font-size: 36px;
            font-weight: 800;
            line-height: 1;
            margin-bottom: 6px;
        }}
        .stat-name {{
            font-size: 11px;
            color: #7a8fa8;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }}

        /* ── Badges ── */
        .badge {{
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }}
        .badge-critical {{ background-color: #ff3b3b22; color: #ff3b3b; border: 1px solid #ff3b3b44; }}
        .badge-high     {{ background-color: #ff6b2b22; color: #ff6b2b; border: 1px solid #ff6b2b44; }}
        .badge-medium   {{ background-color: #ffb80022; color: #ffb800; border: 1px solid #ffb80044; }}
        .badge-low      {{ background-color: #3b9fff22; color: #3b9fff; border: 1px solid #3b9fff44; }}
        .badge-info     {{ background-color: #8899aa18; color: #8899aa; border: 1px solid #8899aa33; }}

        /* ── Tables ── */
        .table-wrap {{ overflow-x: auto; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th {{
            background-color: #0f1929;
            color: #445566;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.1em;
            padding: 10px 14px;
            text-align: left;
            border-bottom: 1px solid #162135;
        }}
        td {{
            padding: 10px 14px;
            border-bottom: 1px solid #0f1929;
            color: #c0d0e8;
        }}
        tr:last-child td {{ border-bottom: none; }}
        tr:hover td {{ background-color: #0f192966; }}
        code {{
            font-family: 'Consolas', monospace;
            background-color: #162135;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            color: #00c8ff;
        }}

        /* ── Vulnerability items ── */
        .vuln-list {{ display: flex; flex-direction: column; gap: 10px; }}
        .vuln-item {{
            padding: 16px;
            background-color: #0f1929;
            border: 1px solid #162135;
            border-radius: 8px;
            border-left: 4px solid #8899aa;
            page-break-inside: avoid;
        }}
        .vuln-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
            margin-bottom: 8px;
        }}
        .vuln-title {{
            font-weight: 600;
            font-size: 14px;
            color: #e8f0ff;
            flex: 1;
        }}
        .vuln-desc {{
            font-size: 13px;
            color: #7a8fa8;
            line-height: 1.6;
            margin-top: 6px;
        }}
        .vuln-solution {{
            margin-top: 10px;
            padding: 10px 14px;
            background-color: #00c8ff11;
            border: 1px solid #00c8ff22;
            border-radius: 6px;
            font-size: 13px;
            color: #c0d0e8;
        }}

        /* ── Recommendation items ── */
        .rec-item {{
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px 14px;
            background-color: #0f1929;
            border-radius: 8px;
            margin-bottom: 8px;
        }}
        .rec-icon {{ font-size: 18px; flex-shrink: 0; }}
        .rec-text {{ font-size: 13px; color: #c0d0e8; line-height: 1.5; }}

        /* ── Empty state ── */
        .empty-state {{
            text-align: center;
            padding: 28px;
            color: #445566;
            font-size: 14px;
        }}

        /* ── Footer ── */
        .report-footer {{
            text-align: center;
            padding: 28px 0 8px;
            margin-top: 24px;
            border-top: 1px solid #162135;
        }}
        .report-footer p {{ font-size: 12px; color: #445566; margin: 4px 0; }}
        .report-footer .logo {{ font-size: 15px; color: #00c8ff; font-weight: 700; margin-bottom: 8px; }}

        /* ── Print / PDF optimizations ── */
        @page {{
            size: A4;
            margin: 18mm 16mm;
        }}
        @media print {{
            body {{ background-color: #070d18 !important; }}
            .card, .stat-card, .info-cell, .vuln-item {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
<div class="page">

    <!-- ── HEADER ── -->
    <div class="report-header">
        <div class="brand">
            <div class="brand-shield">🔒</div>
            <div class="brand-text">
                <h1>SecureScan Pro</h1>
                <p>Enterprise Security Assessment Report</p>
            </div>
        </div>
        <div class="report-meta">
            <div class="target">{target}</div>
            <div class="date">Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</div>
            <div class="date" style="margin-top:4px;">Scan ID: {scan_id[:16]}…</div>
        </div>
        <div class="grade-circle">
            <div class="grade-letter">{grade}</div>
            <div class="grade-label">Grade</div>
        </div>
    </div>

    <!-- ── EXECUTIVE SUMMARY ── -->
    <div class="card">
        <div class="card-header">
            <span class="card-icon">📊</span>
            <h2>Executive Summary</h2>
        </div>
        <div class="score-section">
            <div class="score-ring">
                <div class="score-value">{total_score}</div>
                <div class="score-label">Risk Score</div>
            </div>
            <div class="score-bar-wrap">
                <div class="score-bar-row">
                    <div class="score-bar-label">Critical</div>
                    <div class="score-bar-track"><div class="score-bar-fill" style="width:{pct("critical")}%;background-color:#ff3b3b;"></div></div>
                    <div class="score-bar-count" style="color:#ff3b3b;">{breakdown.get("critical",0)}</div>
                </div>
                <div class="score-bar-row">
                    <div class="score-bar-label">High</div>
                    <div class="score-bar-track"><div class="score-bar-fill" style="width:{pct("high")}%;background-color:#ff6b2b;"></div></div>
                    <div class="score-bar-count" style="color:#ff6b2b;">{breakdown.get("high",0)}</div>
                </div>
                <div class="score-bar-row">
                    <div class="score-bar-label">Medium</div>
                    <div class="score-bar-track"><div class="score-bar-fill" style="width:{pct("medium")}%;background-color:#ffb800;"></div></div>
                    <div class="score-bar-count" style="color:#ffb800;">{breakdown.get("medium",0)}</div>
                </div>
                <div class="score-bar-row">
                    <div class="score-bar-label">Low</div>
                    <div class="score-bar-track"><div class="score-bar-fill" style="width:{pct("low")}%;background-color:#3b9fff;"></div></div>
                    <div class="score-bar-count" style="color:#3b9fff;">{breakdown.get("low",0)}</div>
                </div>
            </div>
        </div>
        <div class="info-grid" style="margin-top:20px;">
            <div class="info-cell">
                <div class="info-cell-label">Target</div>
                <div class="info-cell-value" style="font-size:12px;">{target}</div>
            </div>
            <div class="info-cell">
                <div class="info-cell-label">Status</div>
                <div class="info-cell-value" style="color:{status_color};">{status.upper()}</div>
            </div>
            <div class="info-cell">
                <div class="info-cell-label">Started</div>
                <div class="info-cell-value" style="font-size:11px;">{start_time}</div>
            </div>
            <div class="info-cell">
                <div class="info-cell-label">Duration</div>
                <div class="info-cell-value">{duration_str}</div>
            </div>
        </div>
    </div>

    <!-- ── FINDINGS OVERVIEW ── -->
    <div class="card">
        <div class="card-header">
            <span class="card-icon">🎯</span>
            <h2>{t("report.breakdown")}</h2>
        </div>
        <div class="stat-grid">
            <div class="stat-card">
                <div class="stat-number" style="color:#ff3b3b;">{breakdown.get("critical",0)}</div>
                <div class="stat-name">Critical</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" style="color:#ff6b2b;">{breakdown.get("high",0)}</div>
                <div class="stat-name">High</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" style="color:#ffb800;">{breakdown.get("medium",0)}</div>
                <div class="stat-name">Medium</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" style="color:#3b9fff;">{breakdown.get("low",0)}</div>
                <div class="stat-name">Low</div>
            </div>
        </div>
    </div>

    <!-- ── RECOMMENDATIONS ── -->
    {rec_html}

    <!-- ── VULNERABILITIES ── -->
    <div class="card">
        <div class="card-header">
            <span class="card-icon">🛡️</span>
            <h2>{t("report.vulnerabilities")} ({len(vulnerabilities)})</h2>
        </div>
        {vuln_html}
    </div>

    <!-- ── TECHNOLOGIES ── -->
    <div class="card">
        <div class="card-header">
            <span class="card-icon">🔧</span>
            <h2>Tecnologías Detectadas ({len(technologies)})</h2>
        </div>
        {tech_html}
    </div>

    <!-- ── PORTS ── -->
    <div class="card">
        <div class="card-header">
            <span class="card-icon">🌐</span>
            <h2>Puertos Abiertos ({len(ports)})</h2>
        </div>
        {ports_html}
    </div>

    <!-- ── DIRECTORIES ── -->
    {dir_html}

    <!-- ── EXPLOITS ── -->
    <div class="card">
        <div class="card-header">
            <span class="card-icon">⚠️</span>
            <h2>Exploits Relacionados ({len(exploits)})</h2>
        </div>
        {exploits_html}
    </div>

    <!-- ── METASPLOIT ── -->
    {msf_html}

    <!-- ── FOOTER ── -->
    <div class="report-footer">
        <div class="logo">🔒 SecureScan Pro v3.0</div>
        <p>{t("report.generatedOn")} {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")} UTC</p>
        <p>Proyecto Académico SENA · Solo para uso ético y autorizado</p>
        <p style="margin-top:8px;font-size:11px;color:#2a3a50;">{t("report.confidential")}</p>
    </div>

</div>
</body>
</html>"""

    # Guardar archivo
    filename = f"report-{scan_id}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.html"
    filepath = os.path.join(REPORTS_DIR, filename)

    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        logger.info(f"HTML report generated: {filepath}")
        return filepath
    except Exception as e:
        logger.error(f"Error saving HTML report: {e}")
        return None


def generate_json_report(scan: Dict[str, Any]) -> str:
    """Generate JSON report"""
    try:
        report_data = {
            'reportVersion': '3.0',
            'generatedAt': datetime.utcnow().isoformat(),
            'tool': 'SecureScan Pro',
            'scan': scan
        }

        filename = f"report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.json"
        filepath = os.path.join(REPORTS_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False, default=str)

        logger.info(f"JSON report generated: {filepath}")
        return filepath

    except Exception as e:
        logger.error(f"Error generating JSON report: {e}")
        return None


def generate_csv_report(scan: Dict[str, Any]) -> str:
    """Generate CSV report with vulnerabilities"""
    try:
        filename = f"report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.csv"
        filepath = os.path.join(REPORTS_DIR, filename)

        vulnerabilities = scan.get('vulnerabilities', [])

        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)

            writer.writerow([
                'ID', 'Name', 'Severity', 'Description', 'Solution',
                'URL', 'CVSS', 'Tool', 'Scan ID', 'Target'
            ])

            for vuln in vulnerabilities:
                writer.writerow([
                    vuln.get('id', ''),
                    vuln.get('name', ''),
                    vuln.get('severity', ''),
                    vuln.get('description', ''),
                    vuln.get('solution', ''),
                    vuln.get('url', ''),
                    vuln.get('cvss', ''),
                    vuln.get('tool', ''),
                    scan.get('id', ''),
                    scan.get('target', '')
                ])

            for m in scan.get('metasploit', []):
                writer.writerow([
                    m.get('module', ''),
                    m.get('title', ''),
                    m.get('severity', ''),
                    m.get('description', ''),
                    '',
                    f"{m.get('host','')}:{m.get('port','')}" if m.get('port') else m.get('host', ''),
                    m.get('cvss', ''),
                    'Metasploit',
                    scan.get('id', ''),
                    scan.get('target', '')
                ])

        logger.info(f"CSV report generated: {filepath}")
        return filepath

    except Exception as e:
        logger.error(f"Error generating CSV report: {e}")
        return None


def generate_pdf_report(scan: Dict[str, Any], locale: str = 'es', html_generator=None) -> Optional[str]:
    """
    Generate PDF report using pdfkit (wkhtmltopdf).
    Falls back to an HTML file with a .pdf extension that browsers can render
    if wkhtmltopdf is not available. The HTML already includes @media print
    styles so it prints cleanly.

    html_generator: función opcional (scan, locale) -> filepath que reemplaza
    a generate_html_report. La usan los reportes de Code Scan / OSINT para
    reutilizar exactamente esta misma lógica de conversión a PDF sin
    duplicarla (ver generate_code_scan_html_report / generate_osint_html_report).
    """
    _html_gen = html_generator or generate_html_report
    try:
        import pdfkit  # type: ignore

        # Generate the full HTML (same as HTML report)
        html_path = _html_gen(scan, locale)
        if not html_path or not os.path.exists(html_path):
            logger.error("No se pudo generar el HTML base para el PDF")
            return None

        with open(html_path, 'r', encoding='utf-8') as f:
            html_content = f.read()

        filename = f"report-{scan['id']}-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.pdf"
        filepath = os.path.join(REPORTS_DIR, filename)

        options = {
            'page-size': 'A4',
            'margin-top': '0.75in',
            'margin-right': '0.75in',
            'margin-bottom': '0.75in',
            'margin-left': '0.75in',
            'encoding': 'UTF-8',
            'no-outline': None,
            'enable-local-file-access': None,
            'disable-smart-shrinking': None,
            'print-media-type': None,
        }

        pdfkit.from_string(html_content, filepath, options=options)
        logger.info(f"PDF report generated: {filepath}")

        # Remove the temporary HTML once PDF is ready
        try:
            os.remove(html_path)
        except Exception:
            pass

        return filepath

    except ImportError:
        # pdfkit / wkhtmltopdf not available — generate HTML and rename to .pdf
        # so the endpoint can still serve something useful. The browser will
        # render the HTML correctly even with a .pdf extension, or the user
        # can open it manually.
        logger.warning("pdfkit not installed — generating HTML fallback for PDF request")
        html_path = _html_gen(scan, locale)
        if not html_path:
            return None
        # Rename to .pdf so send_file sets the correct Content-Disposition
        pdf_path = html_path.replace('.html', '.pdf')
        try:
            os.rename(html_path, pdf_path)
            return pdf_path
        except Exception:
            return html_path

    except Exception as e:
        logger.error(f"Error generating PDF with pdfkit: {e}")
        # Same fallback: serve the HTML as .pdf
        html_path = _html_gen(scan, locale)
        if not html_path:
            return None
        pdf_path = html_path.replace('.html', '.pdf')
        try:
            os.rename(html_path, pdf_path)
            return pdf_path
        except Exception:
            return html_path


def _generate_pdf_html(scan: Dict[str, Any]) -> str:
    """Generate simplified HTML optimized for PDF conversion"""
    score = scan.get('score', {})
    score_color = '#10b981' if score.get('total', 0) >= 80 else '#ef4444'

    vuln_rows = []
    for v in scan.get('vulnerabilities', []):
        sev = v.get('severity', 'low')
        vuln_rows.append(
            f'<tr>'
            f'<td>{v.get("name", "")}</td>'
            f'<td><span class="badge {sev}">{sev.upper()}</span></td>'
            f'<td>{v.get("description", "")[:100]}...</td>'
            f'</tr>'
        )

    tech_items = ''.join(
        f'<li>{tech.get("name", "")} {tech.get("version", "")}</li>'
        for tech in scan.get('technologies', [])
    )

    msf_rows = []
    for m in scan.get('metasploit', []):
        sev = m.get('severity', 'info')
        msf_rows.append(
            f'<tr>'
            f'<td style="font-family:monospace;font-size:11px">{m.get("module", "")}</td>'
            f'<td><span class="badge {sev}">{sev.upper()}</span></td>'
            f'<td>{str(m.get("description", ""))[:120]}</td>'
            f'</tr>'
        )

    msf_section = ''
    if msf_rows:
        msf_count = len(scan.get('metasploit', []))
        msf_section = (
            f'<h2>Metasploit Findings ({msf_count})</h2>'
            f'<table><tr><th>Module</th><th>Severity</th><th>Description</th></tr>'
            + ''.join(msf_rows) +
            '</table>'
        )

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>SecureScan Pro Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; color: #333; }}
        h1 {{ color: #2563eb; }}
        h2 {{ color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }}
        .header {{ text-align: center; margin-bottom: 30px; }}
        .score {{ font-size: 48px; font-weight: bold; color: {score_color}; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #f3f4f6; }}
        .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }}
        .critical {{ background: #fee2e2; color: #991b1b; }}
        .high {{ background: #ffedd5; color: #9a3412; }}
        .medium {{ background: #fef3c7; color: #92400e; }}
        .low {{ background: #d1fae5; color: #065f46; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>SecureScan Pro - Security Report</h1>
        <div class="score">Grade: {score.get('grade', 'F')} ({score.get('total', 0)}/100)</div>
        <p>Target: {scan.get('target', 'Unknown')}</p>
        <p>Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}</p>
    </div>

    <h2>Vulnerabilities ({len(scan.get('vulnerabilities', []))})</h2>
    <table>
        <tr><th>Name</th><th>Severity</th><th>Description</th></tr>
        {''.join(vuln_rows)}
    </table>

    <h2>Technologies ({len(scan.get('technologies', []))})</h2>
    <ul>{tech_items}</ul>

    {msf_section}
</body>
</html>"""


def list_reports() -> List[Dict[str, Any]]:
    """List all generated reports"""
    try:
        reports = []
        for filename in os.listdir(REPORTS_DIR):
            if filename.startswith('report-'):
                filepath = os.path.join(REPORTS_DIR, filename)
                stat = os.stat(filepath)
                reports.append({
                    'filename': filename,
                    'path': filepath,
                    'size': stat.st_size,
                    'created': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    'format': filename.split('.')[-1]
                })

        reports.sort(key=lambda x: x['created'], reverse=True)
        return reports

    except Exception as e:
        logger.error(f"Error listing reports: {e}")
        return []


def delete_report(filename: str) -> bool:
    """Delete a specific report"""
    try:
        filepath = os.path.join(REPORTS_DIR, filename)
        if os.path.commonpath([filepath, REPORTS_DIR]) != REPORTS_DIR:
            logger.warning(f"Attempted directory traversal: {filename}")
            return False

        if os.path.exists(filepath):
            os.remove(filepath)
            logger.info(f"Deleted report: {filename}")
            return True
        return False

    except Exception as e:
        logger.error(f"Error deleting report: {e}")
        return False


def get_report_path(filename: str) -> Optional[str]:
    """Get full path for a report file (with security check)"""
    try:
        filepath = os.path.join(REPORTS_DIR, filename)

        real_filepath = os.path.realpath(filepath)
        real_reports_dir = os.path.realpath(REPORTS_DIR)

        if not real_filepath.startswith(real_reports_dir):
            logger.warning(f"Directory traversal attempt blocked: {filename}")
            return None

        return filepath if os.path.exists(filepath) else None

    except Exception as e:
        logger.error(f"Error getting report path: {e}")
        return None