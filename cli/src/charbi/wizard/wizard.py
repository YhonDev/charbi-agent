"""
� Motor del Wizard de Charbi
Ejecuta los 5 steps en secuencia, merge la config y guarda.
Equivalente al runWizard() de OpenClaw.
"""


import os
from pathlib import Path
from rich.console import Console
from charbi.config.manager import ConfigManager
from charbi.wizard.ui_helpers import show_summary, print_status, COLORS
from charbi.wizard.steps.provider import provider_step
from charbi.wizard.steps.gateway import gateway_step
from charbi.wizard.steps.channels import channels_step
from charbi.wizard.steps.skills import skills_step
from charbi.wizard.steps.security import security_step

console = Console()


def deep_merge(base: dict, override: dict) -> dict:
    """Merge profundo de dos diccionarios"""
    result = base.copy()
    for key, value in override.items():
        if key.startswith('_'):
            continue  # Ignorar claves internas como _env
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def save_env_vars(env_vars: dict):
    """Guarda variables de entorno en .env"""
    env_path = Path.home() / ".charbi-agent" / ".env"
    existing = {}

    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    existing[k] = v

    existing.update(env_vars)

    with open(env_path, 'w') as f:
        for k, v in existing.items():
            f.write(f"{k}={v}\n")


def run_wizard(options: dict = None):
    """
    Ejecuta el wizard completo paso a paso.
    Cada step retorna un dict parcial que se merge en la config final.
    """
    if options is None:
        options = {}

    config_manager = ConfigManager()
    state = config_manager.config.copy()

    # Asegurar que system siempre exista
    if "system" not in state:
        state["system"] = {"name": "Charbi", "version": 1.0, "mode": "development"}

    env_vars = {}

    # === PASO 1: Proveedor ===
    result = provider_step(options)
    if result:
    try:
        # === PASO 1: Proveedor ===
        result = provider_step(options)
        if result:
            if "_env" in result:
                env_vars.update(result["_env"])
            state = deep_merge(state, result)

        # === PASO 2: Gateway ===
        result = gateway_step(options)
        if result:
            state = deep_merge(state, result)

        # === PASO 3: Canales ===
        result = channels_step(options)
        if result:
            state = deep_merge(state, result)

        # === PASO 4: Skills ===
        result = skills_step(options)
        if result:
            state = deep_merge(state, result)

        # === PASO 5: Seguridad ===
        result = security_step(options)
        if result:
            state = deep_merge(state, result)

    except KeyboardInterrupt:
        console.print("\n\n" + Panel("[yellow]⚠️  CONFIGURACIÓN ABORTADA POR EL USUARIO[/yellow]", border_style="yellow"))
        print_status("Saliendo sin aplicar ningún cambio.", "info")
        return None

    # === GUARDAR ===
    config_manager.save_config(state)

    if env_vars:
        save_env_vars(env_vars)

    # === RESUMEN ===
    show_summary(state)

    return state


def run_wizard_sync(options: dict = None):
    """Wrapper sincrónico para el wizard"""
    return run_wizard(options)
