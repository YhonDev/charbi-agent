"""
🚀 Paso 5: Seguridad y Autonomía
Autonomía, límites del supervisor, sandbox.
"""

import questionary
from rich.console import Console
from charbi.wizard.ui_helpers import clear_and_header, print_status, print_section, COLORS

console = Console()

def security_step(options: dict = None) -> dict:
    """Configura seguridad, autonomía y límites del runtime"""
    clear_and_header(5, "Seguridad y Autonomía", "Define los límites y la libertad del agente")

    if not questionary.confirm("¿Deseas configurar Seguridad y Autonomía ahora o saltar? (Next)", default=True).ask():
        return {}

    print_section("Nivel de Seguridad")

    mode_choice = questionary.select(
        "Selecciona el nivel de seguridad y autonomía del agente:",
        choices=[
            "🛡️  Seguro: Seguridad total (Producción, Supervisor Estricto)",
            "⚖️  Medio: Flexible (Desarrollo, Supervisor Permisivo)",
            "🚀 Autónomo: Sin Seguridad (Libertad Total, Modo Autónomo)",
        ],
        style=questionary.Style([
            ("selected", "fg:cyan bold"),
            ("pointer", "fg:cyan bold"),
        ])
    ).ask()

    # Valores base
    supervisor_enabled = True
    system_mode = "production"
    
    # Defaults de supervisor
    max_tool_calls = 20
    max_cpu_time = 5000
    emergency_kill = True

    # Defaults de autonomía
    autonomy_enabled = False
    autonomy_mode = "governed"
    allow_shell = False
    allow_network = False

    if "Seguro" in mode_choice:
        supervisor_enabled = True
        system_mode = "production"
        autonomy_enabled = False
        print_status("Modo Seguro activado. El agente tiene restricciones estrictas.", "success")
        
    elif "Medio" in mode_choice:
        supervisor_enabled = True
        system_mode = "development"
        max_tool_calls, max_cpu_time = 30, 10000
        autonomy_enabled = True
        autonomy_mode = "governed"
        allow_shell = True
        allow_network = True
        print_status("Modo Medio activado. El agente tiene mayor libertad pero es supervisado.", "info")

    elif "Autónomo" in mode_choice:
        supervisor_enabled = False
        system_mode = "autonomous"
        max_tool_calls, max_cpu_time = 100, 30000
        emergency_kill = False
        autonomy_enabled = True
        autonomy_mode = "free"
        allow_shell = True
        allow_network = True
        print_status("Modo Autónomo activado. ⚠️ ADVERTENCIA: El agente tiene control total de los recursos.", "warning")

    # --- Workspace ---
    print_section("Workspace")
    isolate = questionary.confirm(
        "¿Aislar workspace por sesión? (sandbox)",
        default=True
    ).ask()

    return {
        "system": {
            "mode": system_mode
        },
        "supervisor": {
            "enabled": supervisor_enabled,
            "policy_file": "charbi/config/policies/default.yaml",
            "max_cpu_time": max_cpu_time,
            "max_tool_calls": max_tool_calls,
            "emergency_kill": emergency_kill,
        },
        "runtime": {
            "session_path": "charbi/runtime/sessions",
            "isolate_workspace": isolate,
            "autonomy": {
                "enabled": autonomy_enabled,
                "mode": autonomy_mode,
                "maxDepth": 5 if autonomy_mode == "free" else 2,
                "maxActionsPerSession": 50 if autonomy_mode == "free" else 15,
                "maxExecutionTimeMs": max_cpu_time * 2,
                "allowShell": allow_shell,
                "allowNetwork": allow_network,
            },
        },
    }
