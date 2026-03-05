#!/usr/bin/env python3
"""
💬 Comando: charbi chat
Interfaz de chat funcional interactuando con el proveedor configurado (Ollama, OpenAI, etc)
"""

import sys
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown

from charbi.config.manager import ConfigManager

console = Console()

class SimpleChatClient:
    """Cliente de chat simple que direcciona peticiones al proveedor usando el SDK correcto"""
    def __init__(self, provider_config: dict):
        self.config = provider_config
        self.provider = self.config.get("name", "openai")
        self.model = self.config.get("model", "gpt-4")
        self.messages = []
        
        # Inicializar cliente según proveedor
        self.client = None
        self._initialize_client()

    def _initialize_client(self):
        try:
            if self.provider == "ollama":
                from openai import OpenAI
                endpoint = self.config.get("endpoint", "http://localhost:11434/v1")
                self.client = OpenAI(base_url=endpoint, api_key="ollama")
            elif self.provider in ["openai", "qwen"]:
                from openai import OpenAI
                api_key = self.config.get("api_key")
                
                if self.provider == "qwen":
                    # Si es OAuth, habría que obtener el access_token. Por simplicidad usamos la API que está configurada.
                    # Asumiremos que self.config tiene 'api_key' o usamos fallback.
                    self.client = OpenAI(
                        api_key=api_key or "sk-fake", 
                        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    )
                else:
                    self.client = OpenAI(api_key=api_key)
            elif self.provider == "anthropic":
                from anthropic import Anthropic
                self.client = Anthropic(api_key=self.config.get("api_key"))
            elif self.provider == "google":
                import google.generativeai as genai
                genai.configure(api_key=self.config.get("api_key"))
                self.client = genai.GenerativeModel(self.model)
                self.chat_session = self.client.start_chat(history=[])
        except Exception as e:
            console.print(f"[bold red]✗ Error inicializando cliente {self.provider}: {e}[/bold red]")
            sys.exit(1)

    def chat(self, user_input: str) -> str:
        """Envía el mensaje y retorna la respuesta del modelo"""
        self.messages.append({"role": "user", "content": user_input})
        
        try:
            if self.provider in ["openai", "ollama", "qwen"]:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=self.messages
                )
                answer = response.choices[0].message.content
                self.messages.append({"role": "assistant", "content": answer})
                return answer
                
            elif self.provider == "anthropic":
                # Anthropic requiere formato distinto
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    messages=self.messages
                )
                answer = response.content[0].text
                self.messages.append({"role": "assistant", "content": answer})
                return answer
                
            elif self.provider == "google":
                # Gemini
                response = self.chat_session.send_message(user_input)
                answer = response.text
                # Gemini maneja su propio historial en chat_session
                return answer
                
            else:
                return f"[Error] Proveedor {self.provider} no implementado en chat simple."
                
        except Exception as e:
            return f"[Error del Modelo] {str(e)}"

def main():
    console.print(Panel("[bold green]💬 CHAT CON CHARBI (CLI)[/bold green]"))
    
    # 1. Cargar Configuración
    config_mgr = ConfigManager()
    provider_config = config_mgr.get_provider()
    
    if not provider_config or not provider_config.get("enabled"):
        console.print("[bold yellow]⚠️  No hay proveedor configurado.[/bold yellow]")
        console.print("Por favor, ejecuta [bold cyan]charbi config[/bold cyan] primero.\n")
        return
        
    provider_name = provider_config.get("name", "Unknown")
    model_name = provider_config.get("model", "Unknown")
        
    console.print(f"[dim]Conectado a: {provider_name.capitalize()} ({model_name})[/dim]")
    console.print("[dim]Escribe '/exit' para salir[/dim]\n")
    
    # 2. Iniciar cliente
    chat_client = SimpleChatClient(provider_config)
    
    # 3. Bucle de chat
    while True:
        try:
            user_input = Prompt.ask("\n[cyan]Tú[/cyan]")
            if not user_input.strip():
                continue
            if user_input.lower() in ['/exit', '/quit']:
                console.print("[dim]Saliendo...[/dim]")
                break
                
            # Procesando respuesta (con efecto visual simple)
            with console.status("[magenta]Charbi está pensando...[/magenta]", spinner="dots"):
                response = chat_client.chat(user_input)
            
            console.print("\n[green]🤖 Charbi:[/green]")
            console.print(Markdown(response))
            
        except KeyboardInterrupt:
            console.print("\n[dim]Saliendo...[/dim]")
            break
        except Exception as e:
            console.print(f"[bold red]Error inesperado: {e}[/bold red]")

if __name__ == "__main__":
    main()
