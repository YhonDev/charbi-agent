#!/usr/bin/env python3
"""
📊 Comando: charbi status
Muestra el estado real del sistema y canales
"""

import os
import subprocess
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from charbi.config.manager import ConfigManager

console = Console()

def is_process_running(name_pattern: str) -> bool:
    """Verifica si un proceso está activo en WSL"""
    try:
        # Buscamos procesos node o ts-node que contengan 'charbi'
        cmd = f"pgrep -af '{name_pattern}'"
        result = subprocess.run(["bash", "-c", cmd], capture_output=True, text=True)
        return len(result.stdout.strip()) > 0
    except Exception:
        return False

def get_kernel_version() -> str:
    pkg_path = Path.home() / ".charbi-agent" / "package.json"
    if pkg_path.exists():
        try:
            import json
            with open(pkg_path) as f:
                return json.load(f).get("version", "1.0.0")
        except:
            pass
    return "Unknown"

def main():
    config_mgr = ConfigManager()
    config = config_mgr.config
    
    console.print(Panel(f"[bold cyan]📊 ESTADO DEL SISTEMA CHARBI (v{get_kernel_version()})[/bold cyan]"))
    
    # 1. Estado del Kernel
    kernel_running = is_process_running("charbi/kernel")
    status_str = "[bold green]● RUNNING[/bold green]" if kernel_running else "[bold red]○ STOPPED[/bold red]"
    
    # 2. Canales
    channels = config.get("channels", {})
    
    # Crear Tabla de Estado
    table = Table(box=None, padding=(0, 2))
    table.add_column("Componente", style="cyan", no_wrap=True)
    table.add_column("Estado", no_wrap=True)
    table.add_column("Detalles", style="dim")
    
    table.add_row("🧠 Kernel Engine", status_str, "Node.js Process Cluster")
    
    # Canales
    for ch_name, ch_cfg in channels.items():
        enabled = ch_cfg.get("enabled", False)
        ch_status = "[green]Enabled[/green]" if enabled else "[yellow]Disabled[/yellow]"
        table.add_row(f"📡 Channel: {ch_name.capitalize()}", ch_status, ch_cfg.get("token_env", "-"))

    console.print(table)
    
    # 3. Modelos Activos
    models = config.get("models", {})
    if models:
        console.print("\n[bold]🤖 Modelos Configurados:[/bold]")
        for role, model in models.items():
            console.print(f"  • {role.capitalize()}: [yellow]{model}[/yellow]")
            
    # 4. Información de sesión
    console.print(f"\n[dim]Config: {config_mgr.config_path}[/dim]")
    console.print(f"[dim]Backups: {len(list(config_mgr.backup_dir.glob('*.bak')))} archivos[/dim]")

if __name__ == "__main__":
    main()
