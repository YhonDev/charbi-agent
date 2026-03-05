#!/usr/bin/env python3
"""
🔐 Comando: charbi auth
"""

import sys
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm
from charbi.auth.qwen_oauth import QwenOAuth

console = Console()

def main():
    if len(sys.argv) < 2:
        console.print("[yellow]Uso: charbi auth <qwen|status|revoke>[/yellow]")
        return

    cmd = sys.argv[1].lower()
    oauth = QwenOAuth()

    if cmd == "qwen":
        console.print(Panel("[bold cyan]🔐 AUTENTICACIÓN QWEN (OAuth)[/bold cyan]"))
        tokens = oauth.authenticate()
        if tokens:
            console.print("[green]✅ Autenticado correctamente.[/green]")
    
    elif cmd == "status":
        console.print(Panel("[bold cyan]📊 ESTADO DE AUTENTICACIONES[/bold cyan]"))
        tokens = oauth.load_tokens()
        if tokens:
            console.print(f"[green]✅ Qwen:[/green] Autenticado (Expira: {tokens.get('expires_at')})")
        else:
            console.print("[red]❌ Qwen:[/red] No autenticado")

    elif cmd == "revoke":
        if Confirm.ask("¿Seguro que deseas revocar todas las autenticaciones?"):
            oauth.revoke_tokens()
            console.print("[green]✅ Ubicado/Revocado correctamente.[/green]")
    else:
        console.print(f"[red]❌ Comando desconocido: {cmd}[/red]")

if __name__ == "__main__":
    main()
