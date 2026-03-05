"""
� Paso 1: Selección de Proveedor + Modelo
Usa ModelFetcher para Ollama auto-detect y multi-proveedor.
"""

import questionary
from rich.console import Console
from charbi.wizard.ui_helpers import clear_and_header, print_status, COLORS
from charbi.utils.models import ModelFetcher

console = Console()

PROVIDERS = [
    {"name": "ollama",     "label": " Ollama (Local)",        "auth": "none",    "endpoint": "http://localhost:11434/v1"},
    {"name": "openai",     "label": " OpenAI",               "auth": "api_key", "endpoint": "https://api.openai.com/v1"},
    {"name": "anthropic",  "label": " Anthropic (Claude)",    "auth": "api_key", "endpoint": "https://api.anthropic.com"},
    {"name": "google",     "label": "✨ Google (Gemini)",       "auth": "api_key", "endpoint": "https://generativelanguage.googleapis.com"},
    {"name": "qwen",       "label": "🧠 Qwen Auth (OAuth)",    "auth": "oauth",   "endpoint": "https://chat.qwen.ai/api/v1"},
    {"name": "qwen",       "label": "🧠 Qwen (with API Key)",  "auth": "api_key", "endpoint": "https://chat.qwen.ai/api/v1"},
    {"name": "openrouter", "label": " OpenRouter (Multi)",    "auth": "api_key", "endpoint": "https://openrouter.ai/api/v1"},
]


def provider_step(options: dict = None) -> dict:
    """Ejecuta el paso de selección de proveedor y modelo"""
    clear_and_header(1, "Proveedor de IA", "Selecciona qué motor de inteligencia usará Charbi")

    # Si el proveedor viene por CLI flag, usarlo directamente
    if options and options.get("provider"):
        provider_name = options["provider"]
        provider = next((p for p in PROVIDERS if p["name"] == provider_name), None)
        if provider:
            print_status(f"Proveedor pre-seleccionado: {provider['label']}", "info")
        else:
            print_status(f"Proveedor '{provider_name}' no reconocido, selecciona uno:", "warning")
            provider = None
    else:
        provider = None

    if not provider:
        choices = [p["label"] for p in PROVIDERS] + ["⏩ Saltar / Mantener actual (Next)"]
        selected_label = questionary.select(
            "Selecciona tu proveedor de IA:",
            choices=choices,
            style=questionary.Style([
                ("selected", "fg:cyan bold"),
                ("pointer", "fg:cyan bold"),
            ])
        ).ask()

        if not selected_label or "Saltar" in selected_label:
            return {}

        provider = next(p for p in PROVIDERS if p["label"] == selected_label)

    print_status(f"Proveedor: {provider['label']}", "success")

    # --- Obtener API Key si es necesario ---
    api_key = None
    if provider["auth"] == "api_key":
        console.print(f"\n[{COLORS['dim']}]Necesitas una API Key para {provider['name'].upper()}[/{COLORS['dim']}]")
        api_key = questionary.password(
            f"API Key de {provider['name'].upper()}:"
        ).ask()

        if api_key:
            # Guardar en TokenStore vía charbi auth
            try:
                subprocess.run(["charbi", "auth", provider["name"], "--key", api_key], check=False)
            except Exception:
                pass
        else:
            print_status("API Key requerida. Puedes configurarla después con 'charbi auth'.", "warning")
            
    elif provider["auth"] == "oauth":
        from pathlib import Path
        charbi_home = Path.home() / ".charbi-agent"
        
        print_status(f"Iniciando flujo de autenticación [bold]OAuth Device Flow[/bold] para {provider['name'].upper()}...", "info")
        console.print(f"[dim]Ejecutando: npx ts-node kernel/auth_cli.ts {provider['name']}[/dim]\n")
        
        try:
            # Ejecutar el puente TS directamente para asegurar interactividad completa
            subprocess.run(["npx", "ts-node", "kernel/auth_cli.ts", provider["name"]], cwd=str(charbi_home), check=True)
            print_status(f"Autenticación para {provider['name'].upper()} completada con éxito.", "success")
        except Exception as e:
            print_status(f"No se pudo completar el flujo automático: {e}", "warning")
            print_status(f"Por favor, completa la autenticación después con: [bold]charbi auth {provider['name']}[/bold]", "info")

    # --- Seleccionar Modelo ---
    console.print(f"\n[{COLORS['header']}]Selecciona el modelo:[/{COLORS['header']}]")

    with console.status(f"[{COLORS['accent']}]Buscando modelos disponibles...[/{COLORS['accent']}]", spinner="dots"):
        # Intentar obtener modelos. Si no hay API key todavía (OAuth), esto puede fallar
        models = ModelFetcher.fetch_models(provider["name"], api_key)

    if not models:
        print_status("No se pudieron auto-detectar modelos. Usando configuración manual.", "warning")
        model_id = questionary.text(
            "Nombre del modelo (ej: llama3.2, gpt-4, gpt-4o, qwen2.5-coder):"
        ).ask() or ( "qwen2.5-coder" if provider["name"] == "ollama" else "default")
    else:
        model_choices = [f"{m['name']} ({m['id']})" for m in models]
        selected_model = questionary.select(
            f"Modelos de {provider['name'].upper()} ({len(models)} disponibles):",
            choices=model_choices,
            style=questionary.Style([
                ("selected", "fg:cyan bold"),
                ("pointer", "fg:cyan bold"),
            ])
        ).ask()

        if selected_model:
            idx = model_choices.index(selected_model)
            model_id = models[idx]["id"]
        else:
            model_id = models[0]["id"]

    print_status(f"Modelo seleccionado: {model_id}", "success")

    # --- Construir resultado ---
    result = {
        "provider": {
            "name": provider["name"],
            "enabled": True,
            "model": model_id,
            "auth_type": provider["auth"],
            "endpoint": provider["endpoint"],
        },
        "models": {
            "router": model_id,
            "fallback": "openrouter-auto",
        }
    }

    # Mantener env para compatibilidad si el usuario lo prefiere
    if api_key:
        result["provider"]["api_key_env"] = f"{provider['name'].upper()}_API_KEY"
        result["_env"] = {f"{provider['name'].upper()}_API_KEY": api_key}

    return result
