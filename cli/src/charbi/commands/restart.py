#!/usr/bin/env python3
"""
🔄 Comando: charbi restart
Reinicia el kernel de Charbi para aplicar cambios.
"""

import os
import time
import subprocess
from pathlib import Path
from rich.console import Console
from rich.panel import Panel

console = Console()
CHARBI_HOME = Path.home() / ".charbi-agent"
PID_FILE = CHARBI_HOME / "run" / "kernel.pid"

def get_kernel_pid():
    if PID_FILE.exists():
        try:
            return int(PID_FILE.read_text().strip())
        except:
            pass
    return None

def stop_kernel():
    pid = get_kernel_pid()
    if pid:
        console.print(f"[yellow]⏳ Deteniendo kernel (PID: {pid})...[/yellow]")
        try:
            os.kill(pid, 15) # SIGTERM
            # Esperar a que el archivo PID desaparezca
            for _ in range(10):
                if not PID_FILE.exists():
                    break
                time.sleep(0.5)
        except ProcessLookupError:
            if PID_FILE.exists(): PID_FILE.unlink()
    
    # Asegurarnos con pgrep por si acaso
    try:
        subprocess.run(["pkill", "-f", "charbi/kernel"], capture_output=True)
    except:
        pass

def start_kernel():
    console.print("[green]🚀 Iniciando kernel...[/green]")
    try:
        # Iniciamos el kernel en segundo plano
        log_file = CHARBI_HOME / "logs" / "kernel.log"
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(log_file, "a") as f:
            subprocess.Popen(
                ["npx", "ts-node", "kernel/bootstrap.ts"],
                cwd=str(CHARBI_HOME),
                stdout=f,
                stderr=f,
                start_new_session=True
            )
        
        # Esperar un poco para ver si se crea el PID
        time.sleep(2)
        if PID_FILE.exists():
            console.print("[bold green]✓ Kernel reiniciado con éxito.[/bold green]")
        else:
            console.print("[yellow]⚠ El kernel se está iniciando. Verifica 'charbi status' en unos segundos.[/yellow]")
            
    except Exception as e:
        console.print(f"[red]❌ Error al iniciar el kernel: {e}[/red]")

def main():
    console.print(Panel("[bold cyan]🔄 REINICIANDO CHARBI AGENT[/bold cyan]"))
    
    stop_kernel()
    time.sleep(1)
    start_kernel()

if __name__ == "__main__":
    main()
