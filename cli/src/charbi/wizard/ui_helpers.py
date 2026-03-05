"""
� UI Helpers para el Wizard de Charbi
Paleta cyberpunk + utilidades de pantalla compartidas entre steps
"""

import os
import sys
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

# Paleta Cyberpunk — fondo transparente, solo acentos
COLORS = {
    'cyan': 'bold cyan',
    'magenta': 'bold magenta',
    'green': 'bold green',
    'yellow': 'bold yellow',
    'red': 'bold red',
    'dim': 'dim',
    'header': 'bold cyan',
    'accent': 'bold magenta',
    'success': 'bold green',
    'warning': 'bold yellow',
    'error': 'bold red',
    'border': 'cyan',
}

TOTAL_STEPS = 5

LOGO = """
 ██████╗██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗
██╔════╝██║  ██║██╔══██╗██╔══██╗██╔══██╗██║
██║     ███████║███████║██████╔╝██████╔╝██║
██║     ██╔══██║██╔══██║██╔══██╗██╔══██╗██║
╚██████╗██║  ██║██║  ██║██║  ██║██████╔╝██║
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝
"""


def clear_screen():
    """Limpia la terminal"""
    os.system('cls' if os.name == 'nt' else 'clear')


def show_logo():
    """Muestra el logo de Charbi"""
    console.print(f"[{COLORS['cyan']}]{LOGO}[/{COLORS['cyan']}]")


def clear_and_header(step_num: int, title: str, subtitle: str = ""):
    """Limpia pantalla y muestra header con progreso"""
    clear_screen()
    show_logo()

    # Barra de progreso visual
    filled = "█" * step_num
    empty = "░" * (TOTAL_STEPS - step_num)
    progress = f"{filled}{empty}"

    console.print(
        Panel(
            f"[{COLORS['header']}]Paso {step_num}/{TOTAL_STEPS}: {title}[/{COLORS['header']}]\n"
            f"[{COLORS['dim']}]{subtitle}[/{COLORS['dim']}]",
            border_style="cyan",
            title=f"[{COLORS['accent']}]� Charbi Onboard[/{COLORS['accent']}]",
            subtitle=f"[{COLORS['dim']}]{progress} {step_num}/{TOTAL_STEPS}[/{COLORS['dim']}]"
        )
    )
    console.print()


def print_status(message: str, status: str = "info"):
    """Imprime un mensaje con formato según tipo"""
    symbols = {
        "success": f"[{COLORS['success']}]✔[/{COLORS['success']}]",
        "error":   f"[{COLORS['error']}]✗[/{COLORS['error']}]",
        "warning": f"[{COLORS['warning']}]⚠[/{COLORS['warning']}]",
        "info":    f"[{COLORS['dim']}]○[/{COLORS['dim']}]",
        "process": f"[{COLORS['accent']}]→[/{COLORS['accent']}]",
    }
    symbol = symbols.get(status, symbols["info"])
    console.print(f"  {symbol} {message}")


def print_section(title: str):
    """Imprime un separador de sección"""
    console.print(f"\n[{COLORS['header']}]─── {title} ───[/{COLORS['header']}]\n")


def show_summary(config: dict):
    """Muestra resumen final de la configuración"""
    clear_screen()
    show_logo()
    console.print(
        Panel(
            f"[{COLORS['success']}]✅ Configuración Completa[/{COLORS['success']}]",
            border_style="green",
            title="[bold green]� Charbi Ready[/bold green]"
        )
    )

    provider = config.get("provider", {})
    channels = config.get("channels", {})

    console.print(f"\n  [{COLORS['cyan']}]Proveedor:[/{COLORS['cyan']}] {provider.get('name', 'N/A')} ({provider.get('model', 'N/A')})")

    for ch_name, ch_cfg in channels.items():
        status = "✅" if ch_cfg.get("enabled") else "❌"
        console.print(f"  [{COLORS['cyan']}]{ch_name.title()}:[/{COLORS['cyan']}] {status}")

    console.print(f"\n[{COLORS['dim']}]Config guardada en: ~/.charbi-agent/config/charbi-agent.yaml[/{COLORS['dim']}]")
    console.print(f"[{COLORS['dim']}]Ejecuta [bold]charbi start[/bold] para iniciar el kernel.[/{COLORS['dim']}]\n")
