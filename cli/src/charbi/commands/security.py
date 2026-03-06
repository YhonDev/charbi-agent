"""
🛡️ charbi security --mode <seguro|medio|autonomo>
Configura rápidamente el nivel de seguridad y autonomía del agente.
"""

import sys
import argparse
from rich.console import Console
from rich import print as rprint

from charbi.config.manager import ConfigManager
from charbi.wizard.ui_helpers import print_status

console = Console()

def set_security_mode(mode: str):
    mode = mode.lower()
    if mode not in ['seguro', 'medio', 'autonomo']:
        console.print(f"[red]❌ Modo inválido: '{mode}'. Opciones válidas: seguro, medio, autonomo.[/red]")
        sys.exit(1)

    config_manager = ConfigManager()
    state = config_manager.config.copy()
    
    # Defaults
    supervisor_enabled = True
    system_mode = "production"
    max_tool_calls = 20
    max_cpu_time = 5000
    emergency_kill = True

    autonomy_enabled = False
    autonomy_mode = "governed"
    allow_shell = False
    allow_network = False
    
    if mode == "seguro":
        supervisor_enabled = True
        system_mode = "production"
        autonomy_enabled = False
    elif mode == "medio":
        supervisor_enabled = True
        system_mode = "development"
        max_tool_calls, max_cpu_time = 30, 10000
        autonomy_enabled = True
        autonomy_mode = "governed"
        allow_shell = True
        allow_network = True
    elif mode == "autonomo":
        supervisor_enabled = False
        system_mode = "autonomous"
        max_tool_calls, max_cpu_time = 100, 30000
        emergency_kill = False
        autonomy_enabled = True
        autonomy_mode = "free"
        allow_shell = True
        allow_network = True

    # Actualizar state
    if "system" not in state:
        state["system"] = {}
    state["system"]["mode"] = system_mode

    if "supervisor" not in state:
        state["supervisor"] = {}
    state["supervisor"]["enabled"] = supervisor_enabled
    state["supervisor"]["max_cpu_time"] = max_cpu_time
    state["supervisor"]["max_tool_calls"] = max_tool_calls
    state["supervisor"]["emergency_kill"] = emergency_kill

    if "runtime" not in state:
        state["runtime"] = {}
    if "autonomy" not in state["runtime"]:
        state["runtime"]["autonomy"] = {}
    
    state["runtime"]["autonomy"]["enabled"] = autonomy_enabled
    state["runtime"]["autonomy"]["mode"] = autonomy_mode
    state["runtime"]["autonomy"]["maxDepth"] = 5 if autonomy_mode == "free" else 2
    state["runtime"]["autonomy"]["maxActionsPerSession"] = 50 if autonomy_mode == "free" else 15
    state["runtime"]["autonomy"]["maxExecutionTimeMs"] = max_cpu_time * 2
    state["runtime"]["autonomy"]["allowShell"] = allow_shell
    state["runtime"]["autonomy"]["allowNetwork"] = allow_network

    # Guardar
    config_manager.save_config(state)
    print_status(f"Modo de Seguridad configurado exitosamente a: {mode.upper()}", "success")
    
    if mode == "autonomo":
        print_status("⚠️ ADVERTENCIA: El agente ahora tiene control total de los recursos (Supervisor desactivado).", "warning")
        
    console.print("\n[dim]Reinicia el kernel ('charbi restart') para aplicar los cambios si está en ejecución.[/dim]")

def main():
    parser = argparse.ArgumentParser(description="Configura el nivel de seguridad de Charbi.")
    parser.add_argument("--mode", type=str, required=True, help="El modo de seguridad: seguro, medio, autonomo")
    
    # Parsear args
    try:
        args = parser.parse_args(sys.argv[1:])
        set_security_mode(args.mode)
    except SystemExit:
        console.print("[dim]Uso: charbi security --mode <seguro|medio|autonomo>[/dim]")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]👋 Cancelado[/yellow]")
        sys.exit(0)
