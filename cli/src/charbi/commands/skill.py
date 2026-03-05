#!/usr/bin/env python3
"""
🧩 charbi skill — Gestión de skills del sistema
Interfaz CLI para el Skill Hub de Charbi.

Uso:
  charbi skill list              — Lista skills instaladas
  charbi skill search <query>    — Busca skills en los hubs
  charbi skill install <ref>     — Instala (ej: openclaw:weather)
  charbi skill remove <ref>      — Elimina una skill
  charbi skill info <name>       — Info de una skill
"""

import sys
import os
import json
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()

CHARBI_HOME = Path.home() / ".charbi-agent"
AGENTS_DIR = CHARBI_HOME / "agents"
SKILLS_DIR = CHARBI_HOME / "skills"


def scan_installed():
    """Escanea agents/ y skills/ buscando manifiestos"""
    installed = []
    for base_dir in [AGENTS_DIR, SKILLS_DIR]:
        if not base_dir.exists():
            continue
        for entry in sorted(base_dir.iterdir()):
            if not entry.is_dir():
                continue
            manifest_path = entry / "manifest.json"
            if manifest_path.exists():
                try:
                    with open(manifest_path) as f:
                        manifest = json.load(f)
                    manifest["_path"] = str(entry)
                    manifest["_source"] = base_dir.name
                    installed.append(manifest)
                except Exception:
                    pass
            # También revisar subdirectorios (ej: skills/openclaw/weather)
            for sub in entry.iterdir():
                if sub.is_dir():
                    sub_manifest = sub / "manifest.json"
                    if sub_manifest.exists():
                        try:
                            with open(sub_manifest) as f:
                                manifest = json.load(f)
                            manifest["_path"] = str(sub)
                            manifest["_source"] = f"{base_dir.name}/{entry.name}"
                            installed.append(manifest)
                        except Exception:
                            pass
    return installed


def cmd_list():
    """Lista skills instaladas"""
    skills = scan_installed()
    if not skills:
        console.print("[yellow]No hay skills instaladas.[/yellow]")
        console.print("[dim]Usa 'charbi skill install openclaw:<skill>' para instalar.[/dim]")
        return

    table = Table(title="🧩 Skills Instaladas", border_style="cyan")
    table.add_column("Nombre", style="cyan bold")
    table.add_column("Tipo", style="magenta")
    table.add_column("Versión", style="green")
    table.add_column("Origen", style="dim")
    table.add_column("Descripción")

    for s in skills:
        table.add_row(
            s.get("name", "?"),
            s.get("type", "?"),
            s.get("version", "?"),
            s.get("_source", "local"),
            s.get("description", "")[:50],
        )

    console.print(table)
    console.print(f"\n[dim]Total: {len(skills)} skills/agentes registrados[/dim]")


def cmd_info(name: str):
    """Muestra info detallada de una skill"""
    skills = scan_installed()
    skill = next((s for s in skills if s.get("name") == name), None)
    if not skill:
        console.print(f"[red]Skill '{name}' no encontrada.[/red]")
        return

    info = (
        f"[cyan]Nombre:[/cyan]      {skill.get('name')}\n"
        f"[cyan]Tipo:[/cyan]        {skill.get('type')}\n"
        f"[cyan]Versión:[/cyan]     {skill.get('version')}\n"
        f"[cyan]Entry:[/cyan]       {skill.get('entry')}\n"
        f"[cyan]Permisos:[/cyan]    {', '.join(skill.get('permissions', []))}\n"
        f"[cyan]Ruta:[/cyan]        {skill.get('_path')}\n"
        f"[cyan]Descripción:[/cyan] {skill.get('description')}"
    )
    console.print(Panel(info, title=f"[bold cyan]🧩 {name}[/bold cyan]", border_style="cyan"))


def cmd_search(query: str):
    """Búsqueda en hubs (placeholder — requiere kernel TS running)"""
    console.print(f"[dim]Buscando '{query}' en hubs conectados...[/dim]")
    console.print("[yellow]⚠ La búsqueda en OpenClaw Hub requiere que el kernel esté corriendo.[/yellow]")
    console.print("[dim]Usa 'charbi skill install openclaw:<nombre>' si conoces el nombre.[/dim]")


def cmd_install(ref: str):
    """Instala una skill (placeholder — la instalación real es vía kernel TS)"""
    console.print(f"[cyan]→ Solicitando instalación de '{ref}'...[/cyan]")
    if ":" in ref:
        provider, name = ref.split(":", 1)
    else:
        provider, name = "openclaw", ref

    console.print(f"[dim]Provider: {provider}[/dim]")
    console.print(f"[dim]Skill: {name}[/dim]")
    console.print(f"\n[yellow]⚠ La instalación desde hubs externos requiere el kernel corriendo.[/yellow]")
    console.print(f"[dim]Ejecuta 'charbi start' primero, luego intenta de nuevo.[/dim]")


def cmd_remove(ref: str):
    """Elimina una skill"""
    skills = scan_installed()
    skill = next((s for s in skills if s.get("name") == ref), None)
    if not skill:
        console.print(f"[red]Skill '{ref}' no encontrada.[/red]")
        return

    skill_path = Path(skill["_path"])
    import shutil
    shutil.rmtree(skill_path)
    console.print(f"[green]✔ Skill '{ref}' eliminada de {skill_path}[/green]")


def main():
    args = sys.argv[1:]
    if not args:
        cmd_list()
        return

    cmd = args[0].lower()
    if cmd == "list":
        cmd_list()
    elif cmd == "search" and len(args) >= 2:
        cmd_search(args[1])
    elif cmd == "install" and len(args) >= 2:
        cmd_install(args[1])
    elif cmd == "remove" and len(args) >= 2:
        cmd_remove(args[1])
    elif cmd == "info" and len(args) >= 2:
        cmd_info(args[1])
    else:
        console.print("[red]Uso: charbi skill [list|search|install|remove|info][/red]")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelled[/yellow]")
        sys.exit(0)
