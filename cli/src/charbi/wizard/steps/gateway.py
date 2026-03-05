"""
� Paso 2: Configuración del Gateway
Puerto, host, auth token para el servidor del kernel.
"""

import questionary
from rich.console import Console
from charbi.wizard.ui_helpers import clear_and_header, print_status, COLORS

console = Console()


def gateway_step(options: dict = None) -> dict:
    """Configura el gateway del kernel"""
    clear_and_header(2, "Gateway del Kernel", "Configura cómo se expone el servidor interno de Charbi")

    # Puerto
    port_str = questionary.text(
        "Puerto del Gateway:",
        default="18789",
    ).ask()
    port = int(port_str) if port_str and port_str.isdigit() else 18789

    # Host
    host = questionary.select(
        "Dirección de escucha:",
        choices=[
            "127.0.0.1 (solo local — recomendado)",
            "0.0.0.0 (todas las interfaces)",
        ],
        style=questionary.Style([
            ("selected", "fg:cyan bold"),
            ("pointer", "fg:cyan bold"),
        ])
    ).ask()
    host_value = "127.0.0.1" if "127.0.0.1" in (host or "") else "0.0.0.0"

    # Auth token
    enable_auth = questionary.confirm(
        "¿Habilitar token de autenticación?",
        default=True
    ).ask()

    auth_token = None
    if enable_auth:
        import secrets
        auto_token = secrets.token_hex(16)
        use_auto = questionary.confirm(
            f"¿Usar token generado automáticamente?",
            default=True
        ).ask()

        if use_auto:
            auth_token = auto_token
            print_status(f"Token generado: {auto_token[:8]}...{auto_token[-4:]}", "success")
        else:
            auth_token = questionary.password("Ingresa tu token personalizado:").ask()

    print_status(f"Gateway: {host_value}:{port}", "success")
    print_status(f"Auth: {'Habilitado' if enable_auth else 'Deshabilitado'}", "success")

    return {
        "gateway": {
            "port": port,
            "host": host_value,
            "auth_enabled": enable_auth,
            "auth_token": auth_token,
        }
    }
