"""
Menús Interactivos del Sistema
"""

import questionary
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt, Confirm
from config.manager import ConfigManager

console = Console()

class MainMenu:
    """Menú Principal del Sistema"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
        self.running = True
    
    def run(self):
        """Ejecuta el menú principal"""
        while self.running:
            choice = questionary.select(
                "🎛️ ¿Qué deseas configurar?",
                choices=[
                    "🔑 Gestión de API Keys",
                    "🌐 Configurar Proveedores",
                    "🤖 Selector de Modelos",
                    "⚙️ Panel de Parámetros",
                    "🧩 Hub de Skills/Agentes",
                    "💬 Chat con Comandos",
                    "📊 Ver Configuración Actual",
                    "❌ Salir"
                ],
                style=questionary.Style([
                    ("selected", "fg:cyan bold"),
                    ("pointer", "fg:cyan bold"),
                ])
            ).ask()
            
            if choice == "🔑 Gestión de API Keys":
                APIKeyMenu(self.config).run()
            elif choice == "🌐 Configurar Proveedores":
                ProviderMenu(self.config).run()
            elif choice == "🤖 Selector de Modelos":
                ModelMenu(self.config).run()
            elif choice == "⚙️ Panel de Parámetros":
                ParametersMenu(self.config).run()
            elif choice == "🧩 Hub de Skills/Agentes":
                AgentsHubMenu(self.config).run()
            elif choice == "💬 Chat con Comandos":
                ChatMenu(self.config).run()
            elif choice == "📊 Ver Configuración Actual":
                self.show_config_summary()
            elif choice == "❌ Salir":
                self.running = False
                console.print("[green]✅ ¡Hasta la próxima![/green]")
    
    def show_config_summary(self):
        """Muestra resumen de configuración"""
        console.print("\n[bold cyan]📊 CONFIGURACIÓN ACTUAL[/bold cyan]\n")
        
        # Proveedores activos
        table = Table(title="Proveedores Habilitados")
        table.add_column("Proveedor", style="cyan")
        table.add_column("Estado", style="green")
        table.add_column("Modelo por Defecto", style="yellow")
        
        for provider, config in self.config.config["providers"].items():
            status = "✅ Activo" if config.get("enabled") else "❌ Inactivo"
            table.add_row(
                provider.upper(),
                status,
                config.get("default_model", "N/A")
            )
        console.print(table)
        
        # Parámetros
        console.print("\n[bold yellow]⚙️ Parámetros del Modelo[/bold yellow]")
        for param, value in self.config.get_parameters().items():
            console.print(f"  • {param}: [cyan]{value}[/cyan]")
        
        # Agentes y Skills
        console.print("\n[bold magenta]🧩 Agentes Activos[/bold magenta]")
        agents = self.config.get_active_agents()
        if agents:
            for agent in agents:
                console.print(f"  • {agent}")
        else:
            console.print("  [dim]Ningún agente activo[/dim]")
        
        console.print("\n[bold green]🔧 Skills Habilitadas[/bold green]")
        skills = self.config.get_enabled_skills()
        if skills:
            for skill in skills:
                console.print(f"  • {skill}")
        else:
            console.print("  [dim]Ninguna skill habilitada[/dim]")


class APIKeyMenu:
    """Menú de Gestión de API Keys"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
    
    def run(self):
        """Ejecuta el menú de API Keys"""
        while True:
            choice = questionary.select(
                "🔑 Gestión de API Keys",
                choices=[
                    "➕ Añadir/Actualizar API Key",
                    "👁️ Ver Keys Guardadas (ocultas)",
                    "🗑️ Eliminar API Key",
                    "↩️ Volver al Menú Principal"
                ]
            ).ask()
            
            if choice == "➕ Añadir/Actualizar API Key":
                self.add_api_key()
            elif choice == "👁️ Ver Keys Guardadas (ocultas)":
                self.view_keys()
            elif choice == "🗑️ Eliminar API Key":
                self.delete_key()
            elif choice == "↩️ Volver al Menú Principal":
                break
    
    def add_api_key(self):
        """Añade o actualiza una API Key"""
        provider = questionary.select(
            "Selecciona el proveedor:",
            choices=["openai", "anthropic", "local"]
        ).ask()
        
        key = Prompt.ask(
            f"Introduce API Key para {provider}",
            password=True
        )
        
        if key:
            self.config.set_api_key(provider, key)
            console.print(f"[green]✅ API Key de {provider} guardada correctamente[/green]")
        else:
            console.print("[yellow]⚠️ No se introdujo ninguna key[/yellow]")
    
    def view_keys(self):
        """Muestra las keys guardadas (ocultas)"""
        console.print("\n[bold]🔑 API Keys Guardadas[/bold]\n")
        
        for provider, config in self.config.config["providers"].items():
            key = config.get("api_key", "")
            if key:
                masked = key[:4] + "•" * (len(key) - 8) + key[-4:] if len(key) > 8 else "••••"
                status = "✅ Configurada"
            else:
                masked = "No configurada"
                status = "❌ Pendiente"
            
            console.print(f"  {provider.upper()}: [cyan]{masked}[/cyan] - {status}")
    
    def delete_key(self):
        """Elimina una API Key"""
        provider = questionary.select(
            "Selecciona el proveedor para eliminar:",
            choices=["openai", "anthropic", "local"]
        ).ask()
        
        if Confirm.ask(f"¿Seguro que deseas eliminar la API Key de {provider}?"):
            self.config.update_provider(provider, {"api_key": "", "enabled": False})
            console.print(f"[green]✅ API Key de {provider} eliminada[/green]")


class ProviderMenu:
    """Menú de Configuración de Proveedores"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
    
    def run(self):
        """Ejecuta el menú de proveedores"""
        provider = questionary.select(
            "🌐 Selecciona un proveedor:",
            choices=["openai", "anthropic", "local"]
        ).ask()
        
        config = self.config.get_provider(provider)
        
        console.print(f"\n[bold cyan]Configuración de {provider.upper()}[/bold cyan]\n")
        
        # Mostrar configuración actual
        for key, value in config.items():
            if key != "api_key":
                console.print(f"  • {key}: [yellow]{value}[/yellow]")
        
        # Opciones de modificación
        action = questionary.select(
            "¿Qué deseas hacer?",
            choices=[
                "✏️ Editar configuración",
                "🔄 Cambiar modelo por defecto",
                "↩️ Volver"
            ]
        ).ask()
        
        if action == "✏️ Editar configuración":
            self.edit_provider(provider)
        elif action == "🔄 Cambiar modelo por defecto":
            self.change_default_model(provider)
    
    def edit_provider(self, provider: str):
        """Edita configuración del proveedor"""
        if provider == "local":
            endpoint = Prompt.ask(
                "Endpoint del servidor local",
                default=self.config.get_provider(provider).get("endpoint", "http://localhost:11434")
            )
            self.config.update_provider(provider, {"endpoint": endpoint})
            console.print("[green]✅ Endpoint actualizado[/green]")
    
    def change_default_model(self, provider: str):
        """Cambia el modelo por defecto"""
        models = self.config.get_provider(provider).get("models", [])
        
        if models:
            model = questionary.select(
                "Selecciona el modelo por defecto:",
                choices=models
            ).ask()
            
            self.config.update_provider(provider, {"default_model": model})
            console.print(f"[green]✅ Modelo por defecto cambiado a {model}[/green]")


class ModelMenu:
    """Menú Selector de Modelos"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
    
    def run(self):
        """Ejecuta el selector de modelos"""
        active_providers = [
            p for p, c in self.config.config["providers"].items() 
            if c.get("enabled", False)
        ]
        
        if not active_providers:
            console.print("[red]❌ No hay proveedores activos. Configura primero las API Keys.[/red]")
            return
        
        provider = questionary.select(
            "🤖 Selecciona proveedor:",
            choices=active_providers
        ).ask()
        
        models = self.config.get_provider(provider).get("models", [])
        
        current_model = self.config.get_provider(provider).get("default_model", "")
        console.print(f"\n[bold]Modelo actual: [cyan]{current_model}[/cyan][/bold]\n")
        
        model = questionary.select(
            "Selecciona un modelo:",
            choices=models
        ).ask()
        
        self.config.update_provider(provider, {"default_model": model})
        console.print(f"[green]✅ Modelo cambiado a {model}[/green]")


class ParametersMenu:
    """Menú de Parámetros del Modelo"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
    
    def run(self):
        """Ejecuta el menú de parámetros"""
        params = self.config.get_parameters()
        
        console.print("\n[bold cyan]⚙️ PARÁMETROS DEL MODELO[/bold cyan]\n")
        
        for param, value in params.items():
            console.print(f"  {param}: [yellow]{value}[/yellow]")
        
        console.print()
        
        param_to_edit = questionary.select(
            "Selecciona parámetro a editar:",
            choices=list(params.keys()) + ["↩️ Volver"]
        ).ask()
        
        if param_to_edit != "↩️ Volver":
            try:
                new_value = float(Prompt.ask(f"Nuevo valor para {param_to_edit}"))
                self.config.update_parameters({param_to_edit: new_value})
                console.print(f"[green]✅ {param_to_edit} actualizado a {new_value}[/green]")
            except ValueError:
                console.print("[red]❌ Valor inválido. Debe ser un número.[/red]")


class AgentsHubMenu:
    """Menú del Hub de Agentes/Skills"""
    
    AVAILABLE_SKILLS = [
        "web_search",
        "code_executor",
        "file_manager",
        "image_generator",
        "data_analyzer",
        "email_sender"
    ]
    
    AVAILABLE_AGENTS = [
        "intel",      # Orquestador
        "dot",        # Investigación
        "pulse",      # Newsletter
        "sage",       # Comunidad
        "cpi",        # Frontend
        "zape"        # Backend
    ]
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
    
    def run(self):
        """Ejecuta el hub de agentes"""
        while True:
            choice = questionary.select(
                "🧩 Hub de Skills/Agentes",
                choices=[
                    "🤖 Gestionar Agentes",
                    "🔧 Gestionar Skills",
                    "📋 Ver Activos",
                    "↩️ Volver"
                ]
            ).ask()
            
            if choice == "🤖 Gestionar Agentes":
                self.manage_agents()
            elif choice == "🔧 Gestionar Skills":
                self.manage_skills()
            elif choice == "📋 Ver Activos":
                self.show_active()
            elif choice == "↩️ Volver":
                break
    
    def manage_agents(self):
        """Gestiona agentes activos"""
        action = questionary.select(
            "Acción con agentes:",
            choices=["➕ Activar agente", "➖ Desactivar agente"]
        ).ask()
        
        agent = questionary.select(
            "Selecciona agente:",
            choices=self.AVAILABLE_AGENTS
        ).ask()
        
        if action == "➕ Activar agente":
            self.config.add_agent(agent)
            console.print(f"[green]✅ Agente {agent} activado[/green]")
        else:
            self.config.remove_agent(agent)
            console.print(f"[yellow]⚠️ Agente {agent} desactivado[/yellow]")
    
    def manage_skills(self):
        """Gestiona skills habilitadas"""
        action = questionary.select(
            "Acción con skills:",
            choices=["➕ Habilitar skill", "➖ Deshabilitar skill"]
        ).ask()
        
        skill = questionary.select(
            "Selecciona skill:",
            choices=self.AVAILABLE_SKILLS
        ).ask()
        
        if action == "➕ Habilitar skill":
            self.config.enable_skill(skill)
            console.print(f"[green]✅ Skill {skill} habilitada[/green]")
        else:
            self.config.disable_skill(skill)
            console.print(f"[yellow]⚠️ Skill {skill} deshabilitada[/yellow]")
    
    def show_active(self):
        """Muestra agentes y skills activos"""
        console.print("\n[bold cyan]📋 ELEMENTOS ACTIVOS[/bold cyan]\n")
        
        console.print("[bold]Agentes:[/bold]")
        for agent in self.config.get_active_agents():
            console.print(f"  ✅ {agent}")
        
        console.print("\n[bold]Skills:[/bold]")
        for skill in self.config.get_enabled_skills():
            console.print(f"  ✅ {skill}")


class ChatMenu:
    """Menú de Chat con Comandos"""
    
    COMMANDS = {
        "/help": "Muestra ayuda de comandos",
        "/config": "Muestra configuración actual",
        "/model": "Cambia el modelo activo",
        "/clear": "Limpia el historial del chat",
        "/agents": "Lista agentes disponibles",
        "/skills": "Lista skills habilitadas",
        "/exit": "Sale del chat"
    }
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
        self.history = []
    
    def run(self):
        """Ejecuta el chat"""
        console.print("\n[bold green]💬 CHAT CON COMANDOS[/bold green]")
        console.print("[dim]Escribe /help para ver comandos disponibles[/dim]\n")
        
        while True:
            try:
                user_input = Prompt.ask("[cyan]Tú[/cyan]")
                
                if user_input.startswith("/"):
                    self.handle_command(user_input)
                else:
                    self.history.append({"role": "user", "content": user_input})
                    console.print("[yellow]🤖 [dim]Enviando a modelo... (implementar llamada API)[/dim][/yellow]")
                    self.history.append({"role": "assistant", "content": "Respuesta simulada del modelo"})
                    console.print("[green]🤖 Asistente:[/green] Respuesta simulada del modelo")
                    
            except KeyboardInterrupt:
                break
    
    def handle_command(self, command: str):
        """Procesa comandos del chat"""
        cmd = command.lower().split()[0]
        
        if cmd == "/help":
            console.print("\n[bold]📚 COMANDOS DISPONIBLES[/bold]\n")
            for cmd_name, description in self.COMMANDS.items():
                console.print(f"  [cyan]{cmd_name}[/cyan] - {description}")
            console.print()
        
        elif cmd == "/config":
            params = self.config.get_parameters()
            console.print("\n[bold]⚙️ Configuración Actual[/bold]")
            for k, v in params.items():
                console.print(f"  {k}: {v}")
        
        elif cmd == "/clear":
            self.history = []
            console.print("[green]✅ Historial limpiado[/green]")
        
        elif cmd == "/agents":
            agents = self.config.get_active_agents()
            console.print(f"\n[bold]🤖 Agentes activos:[/bold] {', '.join(agents) if agents else 'Ninguno'}")
        
        elif cmd == "/skills":
            skills = self.config.get_enabled_skills()
            console.print(f"\n[bold]🔧 Skills habilitadas:[/bold] {', '.join(skills) if skills else 'Ninguna'}")
        
        elif cmd == "/exit":
            raise KeyboardInterrupt
        
        else:
            console.print(f"[red]❌ Comando desconocido: {cmd}[/red]")
