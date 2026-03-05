#!/usr/bin/env python3
"""
🔐 charbi auth — Gestión de autenticación y tokens
Interfaz CLI para AuthManager.

Uso:
  charbi auth <provider>          — Inicia login interactivo (ej: Qwen)
  charbi auth <provider> --key <K> — Guarda API Key manualmente
  charbi auth list                — Lista estado de autenticación
"""

import sys
import os
import subprocess
from pathlib import Path
from rich.console import Console
from rich.table import Table

console = Console()
CHARBI_HOME = Path.home() / ".charbi-agent"

def run_ts_auth(args):
    """Llama al puente de autenticación en TypeScript"""
    cmd = ["npx", "ts-node", "kernel/auth_cli.ts"] + args
    try:
        # Usar inherit para permitir entrada/salida interactiva si es necesario
        subprocess.run(cmd, cwd=str(CHARBI_HOME), check=True)
    except subprocess.CalledProcessError as e:
        console.print(f"[red]Error ejecutando el comando de autenticación: {e}[/red]")
        sys.exit(1)

def cmd_list():
    """Muestra el estado de autenticación"""
    console.print("[dim]Consultando estado de proveedores...[/dim]")
    # Llamamos al kernel para obtener el JSON de estado
    cmd = ["npx", "ts-node", "kernel/auth_cli.ts", "any", "status"]
    try:
        res = subprocess.run(cmd, cwd=str(CHARBI_HOME), capture_output=True, text=True, check=True)
        import json
        status_list = json.loads(res.stdout)
        
        table = Table(title="🔐 Estado de Autenticación", border_style="cyan")
        table.add_column("Proveedor", style="bold")
        table.add_column("Estado", style="bold")
        
        for s in status_list:
            status_text = "[green]✓ Autenticado[/green]" if s['authenticated'] else "[red]✗ No autenticado[/red]"
            table.add_row(s['provider'].upper(), status_text)
            
        console.print(table)
    except Exception as e:
        console.print(f"[red]Error cargando estado: {e}[/red]")

def main():
    args = sys.argv[1:]
    if not args:
        console.print("[red]Uso: charbi auth <provider> | list[/red]")
        sys.exit(1)

    provider = args[0].lower()
    
    if provider == "list":
        cmd_list()
        return

    # Caso: charbi auth openai --key SK-...
    if "--key" in args:
        idx = args.index("--key")
        if len(args) > idx + 1:
            key = args[idx + 1]
            run_ts_auth([provider, "key", key])
        else:
            console.print("[red]Falta el valor de la API Key.[/red]")
            sys.exit(1)
    else:
        # Caso: charbi auth qwen (interactivo)
        run_ts_auth([provider])

if __name__ == "__main__":
    main()
