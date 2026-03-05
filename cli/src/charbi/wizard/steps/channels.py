"""
� Paso 3: Canales de Comunicación
Telegram, Discord, WhatsApp — con tokens por canal.
"""

import questionary
from rich.console import Console
from charbi.wizard.ui_helpers import clear_and_header, print_status, COLORS

console = Console()

AVAILABLE_CHANNELS = [
    {"name": "telegram",  "label": "� Telegram",  "needs": ["bot_token"]},
    {"name": "discord",   "label": "� Discord",   "needs": ["bot_token"]},
    {"name": "whatsapp",  "label": "� WhatsApp",  "needs": ["api_token"]},
    {"name": "cli",       "label": "� Terminal (CLI)", "needs": []},
]


def channels_step(options: dict = None) -> dict:
    """Configura los canales de comunicación"""
    clear_and_header(3, "Canales de Comunicación", "Selecciona cómo te comunicarás con Charbi")

    if not questionary.confirm("¿Deseas configurar Canales (Telegram/Discord) ahora o saltar? (Next)", default=True).ask():
        return {}

    if options and options.get("skip_channels"):
        print_status("Canales omitidos (flag --skip-channels)", "info")
        return {"channels": {"cli": {"enabled": True}}}

    # Selección múltiple con checkbox
    selected = questionary.checkbox(
        "Activa los canales que deseas usar:",
        choices=[
            questionary.Choice(c["label"], value=c["name"], checked=(c["name"] == "cli"))
            for c in AVAILABLE_CHANNELS
        ],
        style=questionary.Style([
            ("selected", "fg:white"),
            ("pointer", "fg:cyan bold"),
            ("highlighted", "fg:white"),
            ("answer", "fg:cyan bold"),
        ]),
        pointer="● "
    ).ask()

    if not selected:
        selected = ["cli"]

    channels_config = {}

    for ch_name in selected:
        channel_def = next(c for c in AVAILABLE_CHANNELS if c["name"] == ch_name)
        ch_config = {"enabled": True}

        for field in channel_def["needs"]:
            if field == "bot_token":
                token = questionary.password(
                    f"Token del bot de {channel_def['label']}:"
                ).ask()
                if token:
                    ch_config["bot_token"] = token
                    ch_config["token_env"] = f"{ch_name.upper()}_TOKEN"
                    print_status(f"{channel_def['label']}: Token configurado", "success")
                else:
                    print_status(f"{channel_def['label']}: Sin token (configúralo después)", "warning")
            elif field == "api_token":
                token = questionary.password(
                    f"API Token de {channel_def['label']}:"
                ).ask()
                if token:
                    ch_config["api_token"] = token
                    print_status(f"{channel_def['label']}: Token configurado", "success")

        channels_config[ch_name] = ch_config

    # Asegurar que CLI siempre esté habilitado
    if "cli" not in channels_config:
        channels_config["cli"] = {"enabled": True}

    enabled = [k for k, v in channels_config.items() if v.get("enabled")]
    print_status(f"Canales activos: {', '.join(enabled)}", "success")

    return {"channels": channels_config}
