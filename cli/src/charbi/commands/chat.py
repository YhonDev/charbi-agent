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
import subprocess
import time
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown

console = Console()

class KernelChatClient:
    """Cliente que delega el chat al Kernel de Charbi vía API"""
    def __init__(self, endpoint=None):
        if not endpoint:
            config_mgr = ConfigManager()
            gw_config = config_mgr.get_gateway()
            port = gw_config.get("port", 5005)
            host = gw_config.get("host", "127.0.0.1")
            
            # 0.0.0.0 is for binding, but for dialing we must use 127.0.0.1 or localhost
            target_host = "127.0.0.1" if host == "0.0.0.0" else host
            endpoint = f"http://{target_host}:{port}"
        self.endpoint = endpoint
        self.ensure_kernel_running()

    def ensure_kernel_running(self):
        """Verifica si el kernel responde, de lo contrario lo inicia automáticamente"""
        console.print("[dim]Verificando estado del Kernel...[/dim]")
        try:
            # Una simple petición GET para ver si el servidor web levanta la conexión (retornará 404 pero no ConnectionError)
            requests.get(self.endpoint, timeout=2)
            console.print("[dim]Kernel detectado de manera exitosa.[/dim]")
        except requests.exceptions.ConnectionError:
            console.print("[yellow]⚠️ El Kernel no está activo o el puerto está ocupado. Iniciando entorno limpio...[/yellow]")
            with console.status("[cyan]Limpiando puertos e iniciando Charbi Kernel...[/cyan]", spinner="dots"):
                # Delegamos al script bash wrapper que ya sabe manejar stop_kernel y start_kernel maravillosamente
                subprocess.run(["charbi", "restart"], capture_output=True, text=True)
                
                # Polling para esperar a que el servidor de Express esté listo
                max_retries = 15
                for _ in range(max_retries):
                    try:
                        requests.get(self.endpoint, timeout=2)
                        console.print("[green]✔ Kernel iniciado y listo para chatear.[/green]\n")
                        return
                    except requests.exceptions.ConnectionError:
                        time.sleep(1)
                
                console.print("[red]❌ Falló el inicio del Kernel tras varios intentos. Revisa los logs en ~/.charbi-agent/run/kernel.log[/red]")
                sys.exit(1)

    def chat(self, user_input: str) -> str:
        """Envia el mensaje al Kernel y espera la respuesta procesada (autónoma)"""
        try:
            url = f"{self.endpoint}/chat"
            payload = {
                "text": user_input,
                "chatId": "cli_user"
            }
            response = requests.post(url, json=payload, timeout=180) # Increased timeout to match kernel
            
            if response.status_code == 200:
                data = response.json()
                return data.get("response", "⚠️ El kernel no devolvió una respuesta válida.")
            else:
                return f"[bold red]✗ Error en el Kernel (Status {response.status_code}):[/bold red] {response.text}"
                
        except requests.exceptions.ConnectionError:
            return f"[bold red]✗ El Kernel de Charbi no está respondiendo en {self.endpoint}.[/bold red]\n[dim]Asegúrate de que el kernel esté corriendo (charbi start).[/dim]"
        except Exception as e:
            return f"[Error] {str(e)}"

def main():
    console.print(Panel("[bold green]💬 CHAT CON CHARBI (Cognitive Mode)[/bold green]"))
    
    # Iniciar cliente del Kernel
    chat_client = KernelChatClient()
    
    console.print(f"[dim]Conectado al Kernel Local en {chat_client.endpoint}[/dim]")
    console.print("[dim]Escribe '/exit' para salir[/dim]\n")
    
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
        except EOFError:
            break
        except Exception as e:
            console.print(f"\n[bold red]Error inesperado: {e}[/bold red]")
            break

if __name__ == "__main__":
    main()

if __name__ == "__main__":
    main()
