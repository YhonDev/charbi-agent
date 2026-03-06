#!/usr/bin/env python3
"""
📊 Comando: charbi status
Muestra el estado avanzado del sistema consultando el kernel en tiempo real.
"""

import os
import json
import subprocess
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns
from rich.text import Text
from charbi.config.manager import ConfigManager

console = Console()

CHARBI_HOME = Path.home() / ".charbi-agent"

def get_kernel_status_json():
    """Ejecuta el puente TS para obtener el estado real del kernel"""
    try:
        # Intentamos ejecutar el status_cli.ts
        result = subprocess.run(
            ["npx", "ts-node", "kernel/status_cli.ts"],
            cwd=str(CHARBI_HOME),
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return None

def format_uptime(seconds):
    if not seconds: return "0s"
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h > 0: return f"{h}h {m}m {s}s"
    if m > 0: return f"{m}m {s}s"
    return f"{s}s"

def main():
    config_mgr = ConfigManager()
    data = get_kernel_status_json()
    
    # Header
    console.print("")
    console.print(Panel(
        Text.assemble(
            (" CHARBI AGENT ", "bold white on blue"),
            (" RUNTIME STATUS ", "bold cyan")
        ),
        border_style="cyan"
    ))

    if not data:
        console.print("[bold red]⚠ NO SE PUDO CONECTAR CON EL KERNEL[/bold red]")
        console.print("[dim]El kernel podría estar detenido o configurado incorrectamente.[/dim]\n")
        # Mostrar al menos estado estático básico
        return

    # 1. SYSTEM & MODEL
    sys = data.get("system", {})
    mod = data.get("model", {})
    
    sys_table = Table(title="[bold blue]💻 SYSTEM[/bold blue]", box=None)
    sys_table.add_column("Key", style="dim")
    sys_table.add_column("Value")
    sys_table.add_row("Kernel", f"[bold green]{sys.get('kernel', 'RUNNING')}[/bold green]")
    sys_table.add_row("Uptime", format_uptime(sys.get("uptime")))
    sys_table.add_row("Mode", sys.get("mode", "production"))
    
    mod_table = Table(title="[bold yellow]🤖 MODEL[/bold yellow]", box=None)
    mod_table.add_column("Key", style="dim")
    mod_table.add_column("Value")
    mod_table.add_row("Provider", mod.get("provider", "unknown"))
    mod_table.add_row("Model", mod.get("model", "unknown"))
    auth_status = "[green]CONNECTED[/green]" if mod.get("auth") == "CONNECTED" else "[red]DISCONNECTED[/red]"
    mod_table.add_row("Auth", auth_status)

    console.print(Columns([sys_table, mod_table], equal=True))

    # 2. CHANNELS
    console.print("\n[bold cyan]📡 CHANNELS[/bold cyan]")
    ch_table = Table(box=None, padding=(0, 2))
    ch_table.add_column("Channel", style="bold")
    ch_table.add_column("Status")
    
    for ch in data.get("channels", []):
        status = f"[green]{ch['status']}[/green]" if ch['status'] == 'ACTIVE' else "[red]STOPPED[/red]"
        ch_table.add_row(ch['name'].capitalize(), status)
    
    console.print(ch_table)

    # 3. SKILLS & TOOLS (Resumen)
    console.print("\n[bold magenta]🏗️ CAPABILITIES[/bold magenta]")
    cols = []
    
    # Skills
    skills_text = Text()
    for s in data.get("skills", []):
        skills_text.append(f"• {s['name']} ", style="dim")
    cols.append(Panel(skills_text, title="Skills Loaded", border_style="magenta"))
    
    # Tools
    tools_text = Text()
    for t in data.get("tools", []):
        tools_text.append(f"• {t} ", style="dim text")
    cols.append(Panel(tools_text, title="Tools Registered", border_style="blue"))
    
    console.print(Columns(cols))

    # 4. SECURITY & PERMISSIONS
    sec = data.get("security", {})
    console.print(f"\n[bold red]🛡️ SECURITY STATE[/bold red]")
    sec_table = Table(box=None, show_header=False)
    sec_table.add_column("Key", style="dim")
    sec_table.add_column("Value")
    
    sec_table.add_row("Engine", f"[green]{sec.get('engine', 'ACTIVE')}[/green]")
    sec_table.add_row("Rules Loaded", str(sec.get('rules_loaded', 0)))
    perm_list = ", ".join(sec.get("permissions", []))
    sec_table.add_row("Active Permissions", f"[dim]{perm_list}[/dim]")
    console.print(sec_table)

    # 5. MEMORY
    mem = data.get("memory", {})
    hybrid = mem.get("hybrid", {})
    
    console.print(f"\n[bold green]🧠 MEMORY[/bold green]")
    
    # Grid de memoria para mejor lectura
    mem_table = Table(box=None, show_header=False)
    mem_table.add_column("Type", style="cyan")
    mem_table.add_column("Value", style="bold")
    
    mem_table.add_row("JSON Entries", str(mem.get('count', 0)))
    mem_table.add_row("Vector Embeddings", f"[bold magenta]{hybrid.get('vectors', 0)}[/bold magenta]")
    mem_table.add_row("Knowledge Graph", f"[bold yellow]{hybrid.get('nodes', 0)} nodes, {hybrid.get('edges', 0)} edges[/bold yellow]")
    
    console.print(mem_table)

    # 6. RECENT LOGS (Audit Trail)
    logs = data.get("recent_logs", [])
    if logs:
        log_text = Text()
        for line in logs:
            if "ERROR" in line or "FAIL" in line:
                log_text.append(f"{line}\n", style="bold red")
            elif "WARN" in line:
                log_text.append(f"{line}\n", style="yellow")
            elif "SUCCESS" in line or "✓" in line:
                log_text.append(f"{line}\n", style="green")
            else:
                log_text.append(f"{line}\n", style="dim")
        
        console.print(Panel(log_text, title="[bold white]📄 RECENT KERNEL LOGS[/bold white]", border_style="dim"))

    # Footer
    console.print(f"\n[dim]Config: {config_mgr.config_path} | Home: {CHARBI_HOME}[/dim]\n")

if __name__ == "__main__":
    main()
