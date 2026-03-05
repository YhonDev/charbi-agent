"""
� Paso 5: Seguridad y Runtime
Autonomía, límites del supervisor, sandbox.
"""

import questionary
from rich.console import Console
from charbi.wizard.ui_helpers import clear_and_header, print_status, print_section, COLORS

console = Console()


async def security_step(options: dict = None) -> dict:
    """Configura seguridad, autonomía y límites del runtime"""
    clear_and_header(5, "Seguridad y Runtime", "Define los límites y el nivel de autonomía del kernel")

    # --- Supervisor ---
    print_section("Supervisor")

    supervisor_enabled = questionary.confirm(
        "¿Habilitar el Supervisor de seguridad? (recomendado)",
        default=True
    ).ask()

    max_tool_calls = 20
    max_cpu_time = 5000
    emergency_kill = True

    if supervisor_enabled:
        preset = questionary.select(
            "Nivel de restricción del Supervisor:",
            choices=[
                "� Relajado (30 tool calls, 10s timeout)",
                "� Estándar (20 tool calls, 5s timeout) — recomendado",
                "� Estricto (10 tool calls, 3s timeout)",
                "⚙️ Personalizado",
            ],
            default="� Estándar (20 tool calls, 5s timeout) — recomendado",
            style=questionary.Style([
                ("selected", "fg:cyan bold"),
                ("pointer", "fg:cyan bold"),
            ])
        ).ask()

        if "Relajado" in (preset or ""):
            max_tool_calls, max_cpu_time = 30, 10000
        elif "Estricto" in (preset or ""):
            max_tool_calls, max_cpu_time = 10, 3000
        elif "Personalizado" in (preset or ""):
            tc = questionary.text("Max tool calls por sesión:", default="20").ask()
            max_tool_calls = int(tc) if tc and tc.isdigit() else 20
            ct = questionary.text("Max CPU time (ms):", default="5000").ask()
            max_cpu_time = int(ct) if ct and ct.isdigit() else 5000
            emergency_kill = questionary.confirm("¿Habilitar emergency kill?", default=True).ask()

    print_status(f"Supervisor: {'Habilitado' if supervisor_enabled else 'Deshabilitado'}", "success")
    print_status(f"Límites: {max_tool_calls} tool calls, {max_cpu_time}ms timeout", "info")

    # --- Autonomía ---
    print_section("Autonomía del Agente")

    autonomy_enabled = questionary.confirm(
        "¿Permitir ejecución autónoma? (sin intervención humana)",
        default=False
    ).ask()

    autonomy_config = {"enabled": autonomy_enabled}
    if autonomy_enabled:
        mode = questionary.select(
            "Modo de autonomía:",
            choices=[
                "governed — con límites estrictos (recomendado)",
                "free — sin límites (peligroso)",
            ],
            style=questionary.Style([
                ("selected", "fg:cyan bold"),
                ("pointer", "fg:cyan bold"),
            ])
        ).ask()
        autonomy_config["mode"] = "governed" if "governed" in (mode or "") else "free"
        autonomy_config["maxDepth"] = 2
        autonomy_config["maxActionsPerSession"] = 15
        autonomy_config["maxExecutionTimeMs"] = 30000
        autonomy_config["allowShell"] = False
        autonomy_config["allowNetwork"] = False

    print_status(f"Autonomía: {'Activada (' + autonomy_config.get('mode', 'N/A') + ')' if autonomy_enabled else 'Desactivada'}", "success")

    # --- Workspace ---
    print_section("Workspace")
    isolate = questionary.confirm(
        "¿Aislar workspace por sesión? (sandbox)",
        default=True
    ).ask()

    return {
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
            "autonomy": autonomy_config,
        },
    }
