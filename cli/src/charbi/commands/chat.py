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

import sys
import requests
import json
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown

console = Console()

class KernelChatClient:
    """Cliente que delega el chat al Kernel de Charbi vía API"""
    def __init__(self, endpoint="http://localhost:5005"):
        self.endpoint = endpoint

    def chat(self, user_input: str) -> str:
        """Envia el mensaje al Kernel y espera la respuesta procesada (autónoma)"""
        try:
            url = f"{self.endpoint}/chat"
            payload = {
                "text": user_input,
                "chatId": "cli_user"
            }
            response = requests.post(url, json=payload, timeout=65)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("response", "⚠️ El kernel no devolvió una respuesta válida.")
            else:
                return f"[bold red]✗ Error en el Kernel (Status {response.status_code}):[/bold red] {response.text}"
                
        except requests.exceptions.ConnectionError:
            return "[bold red]✗ El Kernel de Charbi no está respondiendo.[/bold red]\n[dim]Asegúrate de que el kernel esté corriendo (charbi start).[/dim]"
        except Exception as e:
            return f"[Error] {str(e)}"

def main():
    console.print(Panel("[bold green]💬 CHAT CON CHARBI (Cognitive Mode)[/bold green]"))
    
    console.print(f"[dim]Conectado al Kernel Local (Autónomo)[/dim]")
    console.print("[dim]Escribe '/exit' para salir[/dim]\n")
    
    # Iniciar cliente del Kernel
    chat_client = KernelChatClient()
    
    while True:
        try:
            user_input = Prompt.ask("\n[cyan]Tú[/cyan]")
            if not user_input.strip():
                continue
            if user_input.lower() in ['/exit', '/quit']:
                console.print("[dim]Saliendo...[/dim]")
                break
                
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

if __name__ == "__main__":
    main()
