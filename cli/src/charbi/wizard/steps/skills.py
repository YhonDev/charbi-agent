"""
� Paso 4: Skills y Agentes
Toggles para habilitar/deshabilitar skills y mostrar agentes disponibles.
"""

import questionary
from rich.console import Console
from rich.table import Table
from charbi.wizard.ui_helpers import clear_and_header, print_status, COLORS

console = Console()

DEFAULT_SKILLS = {
    "allow_openclaw": {"label": "� OpenClaw Integration", "default": True, "desc": "Permite uso de herramientas OpenClaw"},
    "clawhub": {"label": "� ClawHub (Marketplace)", "default": True, "desc": "Acceso al marketplace de skills"},
    "github": {"label": "� GitHub Tools", "default": True, "desc": "Integración con repositorios GitHub"},
    "web_search": {"label": "� Web Search", "default": True, "desc": "Búsqueda web vía Brave/Google"},
    "filesystem": {"label": "� Filesystem", "default": True, "desc": "Acceso al sistema de archivos (sandbox)"},
    "shell": {"label": "�️ Shell Commands", "default": False, "desc": "Ejecución de comandos (requiere supervisor)"},
}

DEFAULT_AGENTS = [
    {"name": "main",    "label": "� Charbi (Director)",     "path": "agents/main"},
    {"name": "coder",   "label": "� Coder (Especialista)",   "path": "agents/coder"},
    {"name": "scholar", "label": "� Scholar (Universidad)",  "path": "agents/scholar"},
    {"name": "scout",   "label": "�️ Scout (Mantenimiento)",  "path": "agents/scout"},
]


async def skills_step(options: dict = None) -> dict:
    """Configura skills y muestra agentes disponibles"""
    clear_and_header(4, "Skills y Agentes", "Configura las habilidades del sistema y revisa los agentes")

    # --- Skills ---
    console.print(f"[{COLORS['header']}]Skills disponibles:[/{COLORS['header']}]\n")

    selected_skills = questionary.checkbox(
        "Habilita las skills que Charbi podrá usar:",
        choices=[
            questionary.Choice(
                f"{info['label']} — {info['desc']}",
                value=skill_name,
                checked=info["default"]
            )
            for skill_name, info in DEFAULT_SKILLS.items()
        ],
        style=questionary.Style([
            ("selected", "fg:cyan bold"),
            ("pointer", "fg:cyan bold"),
            ("highlighted", "fg:cyan"),
        ])
    ).ask()

    if not selected_skills:
        selected_skills = [k for k, v in DEFAULT_SKILLS.items() if v["default"]]

    skills_config = {}
    for skill_name in DEFAULT_SKILLS:
        skills_config[skill_name] = skill_name in selected_skills

    skills_config["auto_load_directory"] = "charbi/agents"

    # --- Agentes ---
    console.print(f"\n[{COLORS['header']}]Agentes registrados:[/{COLORS['header']}]\n")
    table = Table(border_style="cyan", show_header=True)
    table.add_column("Agente", style="cyan")
    table.add_column("Ruta", style="dim")
    for agent in DEFAULT_AGENTS:
        table.add_row(agent["label"], agent["path"])
    console.print(table)

    print_status(f"Skills activas: {len(selected_skills)}/{len(DEFAULT_SKILLS)}", "success")

    return {"skills": skills_config}
