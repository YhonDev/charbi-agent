#!/usr/bin/env python3
"""
🎛️ OpenClaw CLI - Sistema de Configuración Multiagente
"""

from ui.menus import MainMenu
from config.manager import ConfigManager
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()

def show_banner():
    """Muestra el banner de bienvenida"""
    banner = Text("""
    ╔═══════════════════════════════════════════════════════════╗
    ║                    🎛️ OPENCLAW CLI                        ║
    ║           Sistema de Configuración Multiagente            ║
    ╚═══════════════════════════════════════════════════════════╝
    """, style="bold cyan")
    console.print(Panel(banner, border_style="cyan"))

def main():
    """Función principal"""
    show_banner()
    
    # Inicializar gestor de configuración
    config_manager = ConfigManager()
    
    # Iniciar menú principal
    menu = MainMenu(config_manager)
    menu.run()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]👋 Sesión terminada por el usuario[/yellow]")
    except Exception as e:
        console.print(f"\n[red]❌ Error crítico: {str(e)}[/red]")
