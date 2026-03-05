"""
Menús Interactivos del Sistema (Modular)
"""

import questionary
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm
from charbi.config.manager import ConfigManager

console = Console()

class MainMenu:
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
        self.running = True
    
    def run(self):
        while self.running:
            choice = questionary.select(
                "🎛️ ¿Qué deseas configurar?",
                choices=[
                    "🔑 Gestión de API Keys",
                    "🌐 Configurar Proveedores",
                    "🤖 Selector de Modelos",
                    "⚙️ Panel de Parámetros",
                    "🧩 Hub de Skills/Agentes",
                    "📊 Ver Configuración Actual",
                    "❌ Salir"
                ],
                style=questionary.Style([
                    ("selected", "fg:cyan bold"),
                    ("pointer", "fg:cyan bold"),
                ])
            ).ask()
            
            if choice == "🔑 Gestión de API Keys":
                self.api_key_menu()
            elif choice == "🌐 Configurar Proveedores":
                self.provider_menu()
            elif choice == "🤖 Selector de Modelos":
                self.model_menu()
            elif choice == "⚙️ Panel de Parámetros":
                self.parameters_menu()
            elif choice == "🧩 Hub de Skills/Agentes":
                self.hub_menu()
            elif choice == "📊 Ver Configuración Actual":
                self.show_config_summary()
            elif choice == "❌ Salir":
                self.running = False

    def show_config_summary(self):
        console.print("\n[bold cyan]📊 CONFIGURACIÓN ACTUAL[/bold cyan]\n")
        table = Table(title="Proveedores")
        table.add_column("Proveedor", style="cyan")
        table.add_column("Estado", style="green")
        for p, c in self.config.config["providers"].items():
            table.add_row(p.upper(), "✅" if c.get("enabled") else "❌")
        console.print(table)

    def api_key_menu(self):
        # Implementation of API key management
        console.print("[yellow]Menú de API Keys...[/yellow]")

    def provider_menu(self):
        console.print("[yellow]Menú de Proveedores...[/yellow]")

    def model_menu(self):
        console.print("[yellow]Menú de Modelos...[/yellow]")

    def parameters_menu(self):
        console.print("[yellow]Menú de Parámetros...[/yellow]")

    def hub_menu(self):
        console.print("[yellow]Hub de Agentes...[/yellow]")
